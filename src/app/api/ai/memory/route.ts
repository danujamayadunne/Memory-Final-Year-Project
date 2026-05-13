import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { streamText, resolveConfig } from "@/lib/ai/provider";
import { getUserProviderConfig } from "@/lib/ai/keys";
import { generateEmbedding } from "@/lib/ai/provider";
import { embeddingCache } from "@/lib/embedding-cache";

const MEMORY_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "as",
  "by",
  "with",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "done",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "this",
  "that",
  "these",
  "those",
  "am",
  "if",
  "how",
  "why",
  "when",
  "where",
  "there",
  "here",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "also",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "then",
  "once",
  "tell",
  "show",
  "give",
  "get",
  "got",
  "make",
  "made",
  "know",
  "like",
  "want",
  "need",
  "see",
  "come",
  "use",
  "used",
  "using",
  "didn",
  "doesn",
  "don",
  "isn",
  "wasn",
  "weren",
  "won",
  "wouldn",
  "couldn",
  "shouldn",
  "new",
  "news",
  "whats",
  "wheres",
  "whens",
  "whos",
  "latest",
  "recent",
  "recently",
  "update",
  "updates",
]);

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[''`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Avoids substring false positives (e.g. token "man" matching "woman"). Short tokens must match a whole word. */
function lexicalTokenMatchesDoc(docNorm: string, token: string): boolean {
  if (!token) return false;
  if (token.length <= 3) {
    const words = docNorm.split(/\s+/).filter(Boolean);
    return words.some((w) => w === token);
  }
  return docNorm.includes(token);
}

function meaningfulQueryTokens(normalizedQuery: string): string[] {
  return normalizedQuery.split(/\s+/).filter((w) => w.length >= 2 && !MEMORY_STOPWORDS.has(w));
}

const IMAGE_QUERY_FRAMING_WORDS = new Set([
  "image",
  "images",
  "picture",
  "pictures",
  "photo",
  "photos",
  "pic",
  "pics",
  "screenshot",
  "screenshots",
]);

function substantiveImageQueryTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !IMAGE_QUERY_FRAMING_WORDS.has(t));
}

function imagePassesLexicalGate(
  docNorm: string,
  phraseMatched: boolean,
  semanticScore: number,
  queryTokens: string[]
): boolean {
  if (phraseMatched) return true;
  const substantive = substantiveImageQueryTokens(queryTokens);
  const gateTokens = substantive.length > 0 ? substantive : queryTokens;
  if (gateTokens.length === 0) return true;
  const significant = gateTokens.filter((t) => t.length >= 4);
  const required = significant.length > 0 ? significant : gateTokens;
  if (required.some((t) => lexicalTokenMatchesDoc(docNorm, t))) return true;
  // Topic queries need strong embedding alignment; 0.44 lets unrelated art rank too often.
  return semanticScore >= 0.63;
}

function isBroadImageListingQuery(norm: string): boolean {
  if (!/\b(images?|pictures?|photos?|screenshots?)\b/.test(norm)) return false;
  if (/\b(images?|pictures?|photos?)\s+(of|from|about|with|showing)\s+\w/.test(norm)) {
    return false;
  }
  return (
    /\b(what|which|any|how many)\b/.test(norm) ||
    /\b(have i|did i|do i)\b[\s\S]{0,40}\b(saved|save)\b/.test(norm) ||
    /\b(saved|save)\b[\s\S]{0,40}\b(images?|pictures?|photos?)\b/.test(norm) ||
    /\b(my|all)\s+(images?|pictures?|photos?)\b/.test(norm) ||
    /\b(list|show)\b[\s\S]{0,24}\b(images?|pictures?|photos?)\b/.test(norm) ||
    /\b(images?|pictures?|photos?)\b[\s\S]{0,32}\b(i have|i saved|ive saved)\b/.test(norm) ||
    /\bive\s+saved\b[\s\S]{0,24}\b(images?|pictures?|photos?)\b/.test(norm)
  );
}

function summaryPassesLexicalGate(
  docNorm: string,
  phraseMatched: boolean,
  semanticScore: number,
  contentTokens: string[]
): boolean {
  if (phraseMatched) return true;
  if (contentTokens.length === 0) return true;
  const significant = contentTokens.filter((t) => t.length >= 4);
  const required = significant.length > 0 ? significant : contentTokens;
  if (required.some((t) => lexicalTokenMatchesDoc(docNorm, t))) return true;
  return semanticScore >= 0.58;
}

function queryLikelyAboutImages(normalizedQuery: string): boolean {
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  return words.some((w) => IMAGE_QUERY_FRAMING_WORDS.has(w));
}

function orderMemorySourcesForDisplay(
  normalizedQuery: string,
  sources: SourceItem[]
): SourceItem[] {
  if (queryLikelyAboutImages(normalizedQuery)) {
    return [...sources].sort(
      (a, b) => (b.similarity || 0) - (a.similarity || 0)
    );
  }
  const text = sources.filter((s) => s.type !== "image");
  const images = sources.filter((s) => s.type === "image");
  const byScore = (a: SourceItem, b: SourceItem) =>
    (b.similarity || 0) - (a.similarity || 0);
  return [...text.sort(byScore), ...images.sort(byScore)];
}

function pruneSourcesByMargin(sources: SourceItem[]): SourceItem[] {
  const links = sources.filter((s) => s.type === "summary");
  const other = sources.filter((s) => s.type !== "summary");
  if (links.length <= 1) {
    return [...links, ...other].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }
  const best = Math.max(...links.map((g) => g.similarity || 0));
  if (best < 0.32) {
    return [...links, ...other].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }
  const floor = Math.max(0.36, best - 0.11);
  const keptLinks = links.filter((g) => (g.similarity || 0) >= floor);
  return [...keptLinks, ...other].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
}

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

function extractTextFromTiptap(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;

  let text = "";
  if (content.text) text += content.text;
  if (Array.isArray(content.content)) {
    for (const node of content.content) {
      text += extractTextFromTiptap(node) + "\n";
    }
  }
  return text.trim();
}

async function getCachedEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) return cached;
  const embedding = await generateEmbedding(text);
  embeddingCache.set(text, embedding);
  return embedding;
}

function parseEmbedding(raw: any): number[] | null {
  try {
    if (typeof raw === "string") {
      const parsed = raw
        .replace(/[\[\]]/g, "")
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((n) => !Number.isNaN(n));
      return parsed.length ? parsed : null;
    }
    if (Array.isArray(raw)) {
      const parsed = raw.map(Number).filter((n) => !Number.isNaN(n));
      return parsed.length ? parsed : null;
    }
    if (raw && typeof raw === "object") {
      const parsed = Object.values(raw).map((v: any) => Number(v)).filter((n) => !Number.isNaN(n));
      return parsed.length ? parsed : null;
    }
  } catch { }
  return null;
}

function pickBySemanticTier<T extends { semanticScore: number }>(
  items: T[]
): T[] {
  const high = items.filter((i) => i.semanticScore >= 0.5);
  if (high.length > 0) return high;
  return items.filter((i) => i.semanticScore >= 0.35);
}

function pickImageSemanticTier<T extends { semanticScore: number }>(
  items: T[]
): T[] {
  const high = items.filter((i) => i.semanticScore >= 0.62);
  if (high.length > 0) return high;
  return items.filter((i) => i.semanticScore >= 0.58);
}

type SourceItem = {
  type: "summary" | "note" | "image";
  id: string;
  title: string;
  url?: string;
  imageUrl?: string;
  snippet: string;
  similarity?: number;
};

export async function POST(req: NextRequest) {
  try {
    const { message, conversation } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userConfig = await getUserProviderConfig(supabase, user.id);
    const config = resolveConfig(userConfig);

    const query = message.trim();

    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await getCachedEmbedding(query);
    } catch (e) {
      console.warn("Could not generate embedding for query:", e);
    }

    const sources: SourceItem[] = [];

    const [summariesResult, notesResult, imagesResult] = await Promise.all([
      supabase
        .from("web_summaries")
        .select("id, url, summary, title, tags, embedding")
        .eq("user_id", user.id)
        .limit(200),
      supabase
        .from("notes")
        .select("id, title, content")
        .eq("user_id", user.id)
        .limit(100),
      supabase
        .from("image_memories")
        .select("id, image_url, source_url, description, tags, embedding, created_at")
        .eq("user_id", user.id)
        .limit(200),
    ]);

    if (summariesResult.data) {
      const queryNorm = normalizeForMatch(query);
      const contentTokens = meaningfulQueryTokens(queryNorm);
      const enriched = summariesResult.data.map((s) => {
        const tagsStr = Array.isArray(s.tags) ? s.tags.join(" ") : "";
        const docNorm = normalizeForMatch(`${s.title || ""} ${s.summary || ""} ${tagsStr}`);

        const phraseMatched = queryNorm.length >= 2 && docNorm.includes(queryNorm);
        const phraseHit = phraseMatched ? 0.35 : 0;
        const wordMatchCount = contentTokens.filter((w) => lexicalTokenMatchesDoc(docNorm, w)).length;
        const wordScore =
          contentTokens.length > 0 ? (wordMatchCount / contentTokens.length) * 0.32 : 0;
        const keywordScore = Math.max(phraseHit, wordScore);
        const hasKeywordHit = keywordScore > 0.14;

        let semanticScore = 0;
        if (queryEmbedding && s.embedding) {
          const vec = parseEmbedding(s.embedding);
          if (vec && vec.length === queryEmbedding.length) {
            semanticScore = cosineSimilarity(queryEmbedding, vec);
          }
        }

        return {
          ...s,
          docNorm,
          phraseMatched,
          keywordScore,
          semanticScore,
          hasKeywordHit,
        };
      });

      const gated = enriched.filter((s) =>
        summaryPassesLexicalGate(s.docNorm, s.phraseMatched, s.semanticScore, contentTokens)
      );

      const withKeyword = gated.filter((s) => s.hasKeywordHit);
      const semanticOnly = gated.filter((s) => !s.hasKeywordHit && s.semanticScore > 0);
      const pickedSemantic = pickBySemanticTier(semanticOnly);

      const merged = [...withKeyword, ...pickedSemantic]
        .map((s) => ({
          ...s,
          score: s.hasKeywordHit ? Math.max(s.keywordScore, s.semanticScore) : s.semanticScore,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      for (const s of merged) {
        sources.push({
          type: "summary",
          id: s.id,
          title: s.title || new URL(s.url).hostname,
          url: s.url,
          snippet: (s.summary || "").slice(0, 500),
          similarity: s.score,
        });
      }
    }

    if (notesResult.data) {
      const noteQueryNorm = normalizeForMatch(query);
      const noteTokens = meaningfulQueryTokens(noteQueryNorm);
      const scored = notesResult.data
        .map((n) => {
          const noteText = extractTextFromTiptap(n.content);
          const docNorm = normalizeForMatch(`${n.title || ""} ${noteText}`);
          const phraseMatched = noteQueryNorm.length >= 2 && docNorm.includes(noteQueryNorm);
          const textMatch = phraseMatched ? 0.35 : 0;

          const wordMatchCount = noteTokens.filter((w) => lexicalTokenMatchesDoc(docNorm, w)).length;
          const wordScore =
            noteTokens.length > 0 ? (wordMatchCount / noteTokens.length) * 0.3 : 0;

          return { ...n, noteText, docNorm, phraseMatched, score: Math.max(textMatch, wordScore) };
        })
        .filter((n) => n.score > 0.15)
        .filter((n) =>
          summaryPassesLexicalGate(n.docNorm, n.phraseMatched, 0, noteTokens)
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      for (const n of scored) {
        sources.push({
          type: "note",
          id: n.id,
          title: n.title || "Untitled Note",
          snippet: n.noteText.slice(0, 500),
          similarity: n.score,
        });
      }
    }

    if (imagesResult.data) {
      const imageQueryNorm = normalizeForMatch(query);
      const imageTokens = meaningfulQueryTokens(imageQueryNorm);
      const imageSubstantive = substantiveImageQueryTokens(imageTokens);
      const listAllSavedImages = isBroadImageListingQuery(imageQueryNorm);

      const enriched = imagesResult.data.map((img) => {
        const tagsStr = Array.isArray(img.tags) ? img.tags.join(" ") : "";
        const docNorm = normalizeForMatch(`${img.description || ""} ${tagsStr}`);
        const phraseMatched =
          imageQueryNorm.length >= 2 && docNorm.includes(imageQueryNorm);
        const tokenContentHit =
          imageSubstantive.length > 0 &&
          imageSubstantive.some((t) => lexicalTokenMatchesDoc(docNorm, t));
        const tagHit =
          Array.isArray(img.tags) &&
          img.tags.some((t: string) => {
            const tn = normalizeForMatch(String(t));
            return (
              (imageQueryNorm.length >= 2 && tn.includes(imageQueryNorm)) ||
              imageSubstantive.some(
                (tok) => tok.length >= 2 && lexicalTokenMatchesDoc(tn, tok)
              )
            );
          });
        const hasDirectText = phraseMatched || tokenContentHit || tagHit;

        let semanticScore = 0;
        if (queryEmbedding && img.embedding) {
          const vec = parseEmbedding(img.embedding);
          if (vec && vec.length === queryEmbedding.length) {
            semanticScore = cosineSimilarity(queryEmbedding, vec);
          }
        }

        return { ...img, docNorm, phraseMatched, hasDirectText, semanticScore };
      });

      let merged: Array<
        (typeof enriched)[number] & { score: number }
      >;

      if (listAllSavedImages) {
        const recency = (row: { created_at?: string | null }) => {
          if (!row.created_at) return 0;
          const ms = new Date(row.created_at).getTime();
          return Number.isNaN(ms) ? 0 : ms;
        };
        merged = [...enriched]
          .sort((a, b) => recency(b) - recency(a))
          .slice(0, 12)
          .map((img) => ({ ...img, score: 0.52 }));
      } else {
        const gatedImg = enriched.filter(
          (img) =>
            img.hasDirectText ||
            imagePassesLexicalGate(
              img.docNorm,
              img.phraseMatched,
              img.semanticScore,
              imageTokens
            )
        );

        const directHits = gatedImg.filter((img) => img.hasDirectText);
        const semanticOnly = gatedImg.filter((img) => !img.hasDirectText && img.semanticScore > 0);
        const pickedSemantic = pickImageSemanticTier(semanticOnly);

        merged = [...directHits, ...pickedSemantic]
          .map((img) => ({
            ...img,
            score: img.hasDirectText ? Math.max(0.55, img.semanticScore) : img.semanticScore,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
      }

      for (const img of merged) {
        sources.push({
          type: "image",
          id: img.id,
          title: img.description?.slice(0, 80) || "Image",
          url: img.source_url || undefined,
          imageUrl: img.image_url,
          snippet: img.description || "No description",
          similarity: img.score,
        });
      }
    }

    const topSources = orderMemorySourcesForDisplay(
      normalizeForMatch(query),
      pruneSourcesByMargin(sources)
    ).slice(0, 12);

    let contextBlock = "";
    if (topSources.length > 0) {
      contextBlock = topSources
        .map((s, i) => {
          const typeLabel =
            s.type === "summary"
              ? "Saved Link"
              : s.type === "note"
                ? "Note"
                : "Image";
          const urlPart = s.url ? `\nURL: ${s.url}` : "";
          const imgPart = s.imageUrl ? `\nImage: ${s.imageUrl}` : "";
          return `[Source ${i + 1} - ${typeLabel}] "${s.title}"${urlPart}${imgPart}\n${s.snippet}`;
        })
        .join("\n\n---\n\n");
    }

    const conversationContext = conversation
      ? `\n\nPrevious conversation:\n${conversation}`
      : "";

    const systemPrompt = `You are "Memory Assistant" — a helpful AI that answers questions using ONLY the user's saved content (web links, notes, and images).

RULES:
1. Answer based on the provided sources. Cite them as [Source N] when referencing specific information.
2. If no relevant sources are found, say so honestly and suggest what the user might save to get an answer.
3. Use **bold** for key terms and important points.
4. Be conversational, clear, and helpful.
5. When referencing images, describe what's in them based on the source description.
6. When referencing saved links, mention the title/topic.
7. When referencing notes, quote relevant parts.
8. If the user asks something their saved content doesn't cover, acknowledge this clearly.
9. Format responses with good structure — use paragraphs, bullet points, and headers (##) when appropriate.`;

    const userPrompt = `${contextBlock
      ? `Here are relevant items from the user's saved memory:\n\n${contextBlock}\n\n---\n`
      : "No relevant saved content was found for this query.\n\n"
      }${conversationContext}

User question: ${query}`;

    const sourcesPayload = topSources.map(({ similarity, ...rest }) => rest);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "sources", sources: sourcesPayload })}\n\n`)
          );

          const textStream = streamText(config, userPrompt, {
            systemPrompt,
            temperature: 0.5,
            maxTokens: 2048,
          });

          for await (const chunk of textStream) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`)
            );
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: err?.message || "Stream error" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
