import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { load } from "cheerio";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY as string;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

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
  } catch (error) {
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

async function generateTitleWithGemini(content: string): Promise<string> {
  if (!genAI) throw new Error("Missing GOOGLE_GEMINI_API_KEY");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const languageInstruction = `IMPORTANT: Detect the language of the content and generate the title in the SAME language. If the content is in Sinhala, generate the title in Sinhala. If it's in English, generate it in English. Do NOT translate to English.`;
  const prompt = `${languageInstruction}\n\nGenerate a concise, descriptive title (max 60 characters) for this content. Return only the title in the same language as the content, no quotes or extra text.\n\n${content.slice(0, 4000)}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return text.trim().replace(/['"]/g, '');
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

async function summarizeWithGemini(content: string, hasQuotedText: boolean = false, format: 'bullets' | 'paragraph' = 'bullets'): Promise<string> {
  if (!genAI) throw new Error("Missing GOOGLE_GEMINI_API_KEY");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let prompt = '';
  const quotedTextNote = hasQuotedText ? ' The content includes a QUOTED TEXT section - make sure to highlight and reference the quoted text in your summary.' : '';

  const languageInstruction = `IMPORTANT: Detect the language of the content and summarize in the SAME language. If the content is in Sinhala, summarize in Sinhala. If it's in English, summarize in English. Do NOT translate the content to English. Preserve the original language of the content in your summary.`;

  if (format === 'paragraph') {
    prompt = `${languageInstruction}\n\nSummarize the following content in 2-3 separate, well-structured paragraphs. Include ALL key points and necessary details. Each paragraph should be distinct and cover different aspects or sections of the content. Use line breaks to separate paragraphs. Return ONLY the summary paragraphs in the same language as the content, no introductory text, no "Here's a summary" or similar phrases. Start directly with the first paragraph. Make sure to split the content into 2-3 separate paragraphs, not one long paragraph.${quotedTextNote}\n\n${content.slice(0, 12000)}`;
  } else {
    prompt = `${languageInstruction}\n\nSummarize the following content in 5-7 comprehensive bullet points. Include ALL key points and necessary details. Each bullet point should be detailed and informative. Return ONLY the bullet points in the same language as the content, no introductory text, no "Here's a summary" or similar phrases. Start directly with the first bullet point.${quotedTextNote}\n\n${content.slice(0, 12000)}`;
  }

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = cleanSummaryText(text);
  return cleaned;
}

async function generateTags(content: string): Promise<string[]> {
  if (!genAI) throw new Error("Missing GOOGLE_GEMINI_API_KEY");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Based on this content, generate exactly 3 relevant tags in English that would help categorize and organize this information. Focus on:
- Main topics and themes
- Subject areas
- Key concepts

IMPORTANT: Generate tags ONLY in English, regardless of the content language. Translate any concepts to English if needed.

Content: ${content.slice(0, 8000)}

Return as a JSON array of exactly 3 tag strings in English only, no additional text or explanation. Example: ["tag1", "tag2", "tag3"]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const tags = JSON.parse(jsonMatch[0]);
      return Array.isArray(tags) ? tags.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 3) : [];
    }
    throw new Error("No valid JSON found in response");
  } catch (error) {
    console.error("Error parsing tags:", error);
    return [];
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GOOGLE_GEMINI_API_KEY");
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          output_dimensionality: 768,
          content: { parts: [{ text: text.slice(0, 10000) }] }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.embedding && data.embedding.values) {
      return data.embedding.values;
    }

    throw new Error("Unexpected embedding response format");
  } catch (error: any) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

async function createAndLinkTags(
  supabase: any,
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
    existingSummaries.forEach((summary: any) => {
      if (summary.tags && Array.isArray(summary.tags)) {
        summary.tags.forEach((tag: any) => {
          if (tag.name && !existingTagsMap.has(tag.name.toLowerCase())) {
            existingTagsMap.set(tag.name.toLowerCase(), tag);
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      title = await generateTitleWithGemini(finalContent);
    }

    const summaryFormat = format === 'paragraph' ? 'paragraph' : 'bullets';
    const summary = await summarizeWithGemini(finalContent, !!hasQuotedText, summaryFormat);

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

    const tagNames = await generateTags(summary);
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
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}


