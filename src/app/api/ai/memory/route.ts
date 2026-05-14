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
  return semanticScore >= 0.63;
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
  if (best < 0.42) {
    return [...other].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }
  const floor = Math.max(0.38, best - 0.1);
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

type TiptapJson = {
  text?: string;
  content?: TiptapJson[];
};

function extractTextFromTiptap(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content !== "object" || content === null) return "";

  const node = content as TiptapJson;
  let text = "";
  if (node.text) text += node.text;
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractTextFromTiptap(child) + "\n";
    }
  }
  return text.trim();
}

async function getCachedEmbedding(text: string): Promise<number[]> {
  return embeddingCache.getOrCompute(text, generateEmbedding);
}

function parseEmbedding(raw: unknown): number[] | null {
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
      const parsed = Object.values(raw as Record<string, unknown>)
        .map((v) => Number(v))
        .filter((n) => !Number.isNaN(n));
      return parsed.length ? parsed : null;
    }
  } catch { }
  return null;
}

function pickBySemanticTier<T extends { semanticScore: number }>(
  items: T[]
): T[] {
  const high = items.filter((i) => i.semanticScore >= 0.56);
  if (high.length > 0) return high;
  return items.filter((i) => i.semanticScore >= 0.5);
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

type ScoredMemorySource = SourceItem & { lexical: boolean };

function stripSourceForClient(s: ScoredMemorySource): Omit<SourceItem, "similarity"> {
  const { similarity: _sim, lexical: _lex, ...rest } = s;
  void _sim;
  void _lex;
  return rest;
}

function filterMisleadingSemanticSources(sources: ScoredMemorySource[]): ScoredMemorySource[] {
  if (sources.length === 0) return [];
  const summaries = sources.filter((s) => s.type === "summary");
  const lexicalSummaries = summaries.filter((s) => s.lexical);
  const hasLexicalSummary = lexicalSummaries.length > 0;
  const hasLexicalElsewhere = sources.some((s) => s.type !== "summary" && s.lexical);

  if (!hasLexicalSummary) {
    if (!hasLexicalElsewhere) return sources;
    return sources.filter((s) => {
      if (s.type !== "summary") return true;
      if (s.lexical) return true;
      return (s.similarity || 0) >= 0.63;
    });
  }

  const bestLexicalSummarySim = Math.max(
    0,
    ...lexicalSummaries.map((s) => s.similarity || 0)
  );

  return sources.filter((s) => {
    if (s.type !== "summary") return true;
    if (s.lexical) return true;
    const sim = s.similarity || 0;
    return sim >= Math.max(0.62, bestLexicalSummarySim - 0.02);
  });
}

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

    const sources: ScoredMemorySource[] = [];

    const summariesPromise = queryEmbedding
      ? supabase
        .from("web_summaries")
        .select("id, url, summary, title, tags, embedding")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(150)
      : supabase
        .from("web_summaries")
        .select("id, url, summary, title, tags")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(150);

    const imagesPromise = queryEmbedding
      ? supabase
        .from("image_memories")
        .select("id, image_url, source_url, description, tags, embedding, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(150)
      : supabase
        .from("image_memories")
        .select("id, image_url, source_url, description, tags, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(150);

    const [summariesResult, notesResult, imagesResult] = await Promise.all([
      summariesPromise,
      supabase
        .from("notes")
        .select("id, title, content")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(80),
      imagesPromise,
    ]);

    if (summariesResult.data) {
      type SummaryFetchRow = {
        id: string;
        url: string;
        summary: string | null;
        title: string | null;
        tags: unknown;
        embedding?: unknown;
      };
      const summaryRows = summariesResult.data as SummaryFetchRow[];

      const queryNorm = normalizeForMatch(query);
      const contentTokens = meaningfulQueryTokens(queryNorm);
      const enriched = summaryRows.map((s) => {
        const tagsStr = Array.isArray(s.tags) ? s.tags.join(" ") : "";
        const docNorm = normalizeForMatch(`${s.title || ""} ${s.summary || ""} ${tagsStr}`);

        const phraseMatched = queryNorm.length >= 2 && docNorm.includes(queryNorm);
        const phraseHit = phraseMatched ? 0.35 : 0;
        const wordMatchCount = contentTokens.filter((w) => lexicalTokenMatchesDoc(docNorm, w)).length;
        const wordScore =
          contentTokens.length > 0 ? (wordMatchCount / contentTokens.length) * 0.32 : 0;
        const keywordScore = Math.max(phraseHit, wordScore);
        const hasKeywordHit = keywordScore > 0.14;
        const anyQueryTokenInDoc =
          contentTokens.length > 0 &&
          contentTokens.some((w) => lexicalTokenMatchesDoc(docNorm, w));
        const lexicalForTier = phraseMatched || hasKeywordHit || anyQueryTokenInDoc;

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
          lexicalForTier,
        };
      });

      const gated = enriched.filter((s) =>
        summaryPassesLexicalGate(s.docNorm, s.phraseMatched, s.semanticScore, contentTokens)
      );

      const withKeyword = gated.filter((s) => s.lexicalForTier);
      const semanticOnly = gated.filter((s) => !s.lexicalForTier && s.semanticScore > 0);
      const pickedSemantic = pickBySemanticTier(semanticOnly);

      const merged = [...withKeyword, ...pickedSemantic]
        .map((s) => ({
          ...s,
          score: s.lexicalForTier
            ? Math.max(s.keywordScore, s.semanticScore)
            : s.semanticScore,
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
          lexical: s.lexicalForTier,
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
          lexical: n.phraseMatched || n.score >= 0.18,
        });
      }
    }

    if (imagesResult.data) {
      type ImageFetchRow = {
        id: string;
        image_url: string;
        source_url?: string | null;
        description?: string | null;
        tags: unknown;
        created_at: string;
        embedding?: unknown;
      };
      const imageRows = imagesResult.data as ImageFetchRow[];

      const imageQueryNorm = normalizeForMatch(query);
      const imageTokens = meaningfulQueryTokens(imageQueryNorm);
      const imageSubstantive = substantiveImageQueryTokens(imageTokens);
      const listAllSavedImages = isBroadImageListingQuery(imageQueryNorm);

      const enriched = imageRows.map((img) => {
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
          lexical: listAllSavedImages || img.hasDirectText,
        });
      }
    }

    const rankedSources = filterMisleadingSemanticSources(
      orderMemorySourcesForDisplay(
        normalizeForMatch(query),
        pruneSourcesByMargin(sources)
      ) as ScoredMemorySource[]
    ).slice(0, 12);

    const bestRanked = rankedSources.length
      ? Math.max(...rankedSources.map((s) => s.similarity || 0))
      : 0;
    const anyLexical = rankedSources.some((s) => s.lexical);
    const topSources: ScoredMemorySource[] =
      !anyLexical && bestRanked < 0.53 ? [] : rankedSources;

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

    const sourcesPayload = topSources.map((s) => stripSourceForClient(s));

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
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: errMsg })}\n\n`
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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}