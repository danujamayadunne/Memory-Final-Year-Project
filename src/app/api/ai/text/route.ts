import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { load } from "cheerio";
import { generateText, generateEmbedding, resolveConfig } from "@/lib/ai/provider";
import { getUserProviderConfig, type AppSupabaseClient } from "@/lib/ai/keys";

async function fetchWebPageWithFirecrawl(url: string): Promise<{ content: string; title: string }> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
        onlyMainContent: true,
        removeBase64Images: true
      })
    });

    if (!response.ok) {
      throw new Error(`Firecrawl API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data) {
      return {
        content: data.data.markdown || '',
        title: data.data.metadata?.title || data.data.title || ''
      };
    }

    throw new Error('No content returned from Firecrawl');
  } catch {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
    });
    const html = await res.text();
    const $ = load(html);
    $("script, style, nav, footer").remove();
    const text = $("body").text();
    const title = $('title').text() || $('h1').first().text() || '';
    return {
      content: text.replace(/\s+/g, " ").trim(),
      title: title.trim()
    };
  }
}

function cleanSummaryText(text: string): string {
  const prefixes = [
    /^here's a summary[:\s]*/i,
    /^summary[:\s]*/i,
    /^here's what[:\s]*/i,
    /^here are the key points[:\s]*/i,
    /^key points[:\s]*/i,
    /^main points[:\s]*/i,
    /^overview[:\s]*/i,
    /^here's the summary[:\s]*/i,
    /^the summary[:\s]*/i,
    /^in summary[,\s]*/i,
    /^to summarize[,\s]*/i,
  ];

  let cleaned = text.trim();

  const lines = cleaned.split('\n');

  if (lines.length > 1) {
    const firstLine = lines[0].trim();
    const isIntroPhrase = prefixes.some(prefix => prefix.test(firstLine)) ||
      (firstLine.length < 50 && !/^[-•*]\s/.test(firstLine) && !/^\d+[.)]\s/.test(firstLine));

    if (isIntroPhrase) {
      lines.shift();
      cleaned = lines.join('\n').trim();
    }
  }

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '').trim();
  }

  cleaned = cleaned.replace(/^[:\-\s]+/, '').trim();

  return cleaned;
}

async function createAndLinkTags(
  supabase: AppSupabaseClient,
  summaryId: string,
  userId: string,
  tagNames: string[]
): Promise<Array<{ id: string; name: string; color: string }>> {
  const addedTags: Array<{ id: string; name: string; color: string }> = [];
  const colors = [
    "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
    "#ec4899", "#6366f1", "#14b8a6", "#eab308", "#6b7280"
  ];

  const { data: existingSummaries } = await supabase
    .from("web_summaries")
    .select("tags")
    .eq("user_id", userId)
    .neq("id", summaryId);

  const existingTagsMap = new Map<string, { id: string; name: string; color: string }>();
  if (existingSummaries) {
    existingSummaries.forEach((summary) => {
      if (summary.tags && Array.isArray(summary.tags)) {
        summary.tags.forEach((tag: unknown) => {
          if (
            typeof tag === "object" &&
            tag !== null &&
            "id" in tag &&
            "name" in tag &&
            typeof (tag as { name: unknown }).name === "string"
          ) {
            const t = tag as { id: string; name: string; color?: string };
            if (t.name && !existingTagsMap.has(t.name.toLowerCase())) {
              existingTagsMap.set(t.name.toLowerCase(), {
                id: t.id,
                name: t.name,
                color: t.color || "#6b7280",
              });
            }
          }
        });
      }
    });
  }

  for (const tagName of tagNames) {
    if (typeof tagName !== 'string' || !tagName.trim()) {
      continue;
    }

    try {
      const trimmedTagName = tagName.trim();
      const tagKey = trimmedTagName.toLowerCase();

      let tag: { id: string; name: string; color: string };
      if (existingTagsMap.has(tagKey)) {
        tag = existingTagsMap.get(tagKey)!;
      } else {
        tag = {
          id: crypto.randomUUID(),
          name: trimmedTagName,
          color: colors[Math.floor(Math.random() * colors.length)]
        };
      }

      addedTags.push(tag);
    } catch (error) {
      console.error("Error processing tag:", tagName, error);
    }
  }

  if (addedTags.length > 0) {
    const { error: updateError } = await supabase
      .from("web_summaries")
      .update({ tags: addedTags })
      .eq("id", summaryId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating summary tags:", updateError);
    }
  }

  return addedTags;
}

export async function POST(req: NextRequest) {
  try {
    const { url, quotedText, format } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    let user: { id: string } | null = null;
    let authError: Error | null = null;

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: { user: u }, error } = await supabase.auth.getUser(token);
      user = u;
      authError = error;
    } else {
      const { data: { user: u }, error } = await supabase.auth.getUser();
      user = u;
      authError = error;
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userConfig = await getUserProviderConfig(supabase, user.id);
    const config = resolveConfig(userConfig);

    const cleanedUrl = url.trim();
    let content = "";
    let title = "";

    const result = await fetchWebPageWithFirecrawl(cleanedUrl);
    content = result.content;
    title = result.title;

    if (!content && !quotedText) {
      return NextResponse.json({ error: "No content found" }, { status: 400 });
    }

    let finalContent = content;
    const hasQuotedText = quotedText && typeof quotedText === "string" && quotedText.trim();
    if (hasQuotedText) {
      const quote = quotedText.trim();
      finalContent = `QUOTED TEXT:\n"${quote}"\n\n${content || 'Full page content:'}`;
    }

    if (!title) {
      const languageInstruction = `IMPORTANT: Detect the language of the content and generate the title in the SAME language. If the content is in Sinhala, generate the title in Sinhala. If it's in English, generate it in English. Do NOT translate to English.`;
      const titlePrompt = `${languageInstruction}\n\nGenerate a concise, descriptive title (max 60 characters) for this content. Return only the title in the same language as the content, no quotes or extra text.\n\n${finalContent.slice(0, 4000)}`;
      const titleResult = await generateText(config, titlePrompt, { temperature: 0.3 });
      title = titleResult.trim().replace(/['"]/g, '');
    }

    const languageInstruction = `IMPORTANT: Detect the language of the content and summarize in the SAME language. If the content is in Sinhala, summarize in Sinhala. If it's in English, summarize in English. Do NOT translate the content to English. Preserve the original language of the content in your summary.`;
    const quotedTextNote = hasQuotedText ? ' The content includes a QUOTED TEXT section - make sure to highlight and reference the quoted text in your summary.' : '';

    const summaryFormat = format === 'paragraph' ? 'paragraph' : 'bullets';
    let summaryPrompt: string;
    if (summaryFormat === 'paragraph') {
      summaryPrompt = `${languageInstruction}\n\nSummarize the following content in 2-3 separate, well-structured paragraphs. Include ALL key points and necessary details. Each paragraph should be distinct and cover different aspects or sections of the content. Use line breaks to separate paragraphs. Return ONLY the summary paragraphs in the same language as the content, no introductory text, no "Here's a summary" or similar phrases. Start directly with the first paragraph. Make sure to split the content into 2-3 separate paragraphs, not one long paragraph.${quotedTextNote}\n\n${finalContent.slice(0, 12000)}`;
    } else {
      summaryPrompt = `${languageInstruction}\n\nSummarize the following content in 5-7 comprehensive bullet points. Include ALL key points and necessary details. Each bullet point should be detailed and informative. Return ONLY the bullet points in the same language as the content, no introductory text, no "Here's a summary" or similar phrases. Start directly with the first bullet point.${quotedTextNote}\n\n${finalContent.slice(0, 12000)}`;
    }

    const rawSummary = await generateText(config, summaryPrompt, { temperature: 0.4 });
    const summary = cleanSummaryText(rawSummary);

    const { data, error } = await supabase
      .from("web_summaries")
      .insert({
        url: cleanedUrl,
        summary,
        title: title || null,
        user_id: user.id
      })
      .select()
      .single();

    if (error) throw error;

    const tagPrompt = `Based on this content, generate exactly 3 relevant tags in English that would help categorize and organize this information. Focus on:
- Main topics and themes
- Subject areas
- Key concepts

IMPORTANT: Generate tags ONLY in English, regardless of the content language. Translate any concepts to English if needed.

Content: ${summary.slice(0, 8000)}

Return as a JSON array of exactly 3 tag strings in English only, no additional text or explanation. Example: ["tag1", "tag2", "tag3"]`;

    const tagText = await generateText(config, tagPrompt, { temperature: 0.3 });
    let tagNames: string[] = [];
    try {
      const jsonMatch = tagText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        tagNames = Array.isArray(parsed)
          ? parsed
              .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
              .slice(0, 3)
          : [];
      }
    } catch {
      tagNames = [];
    }

    const tags = await createAndLinkTags(supabase, data.id, user.id, tagNames);

    const { data: summaryWithTags } = await supabase
      .from("web_summaries")
      .select("id, url, summary, title, created_at, tags")
      .eq("id", data.id)
      .single();

    const transformedItem = summaryWithTags || { ...data, tags: tags };

    const textForEmbedding = `${title || ''} ${summary}`.trim();
    if (textForEmbedding.length > 10) {
      generateEmbedding(textForEmbedding)
        .then(async (embedding) => {
          try {
            const vectorString = `[${embedding.join(',')}]`;
            await supabase
              .from("web_summaries")
              .update({ embedding: vectorString })
              .eq("id", data.id)
              .eq("user_id", user.id);
          } catch (error) {
            console.error("Error storing embedding:", error);
          }
        })
        .catch((error) => {
          console.error("Error generating embedding:", error);
        });
    }

    return NextResponse.json({ item: transformedItem });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/ai/text] Error:", message);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}