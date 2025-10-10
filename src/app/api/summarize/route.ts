import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { load } from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY as string;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return (
      u.hostname.includes("youtube.com") ||
      u.hostname.includes("youtu.be") ||
      u.hostname.includes("m.youtube.com")
    );
  } catch {
    return false;
  }
}

function extractYouTubeVideoId(inputUrl: string): string | null {
  try {
    const u = new URL(inputUrl.trim());
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1) || null;
    }
    if (u.searchParams.has("v")) {
      return u.searchParams.get("v");
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" && parts[1]) return parts[1];
    return null;
  } catch {
    return null;
  }
}

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

async function fetchYouTubeTranscript(url: string): Promise<string> {
  const trimmed = url.trim();
  const videoId = extractYouTubeVideoId(trimmed) || trimmed;
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (transcript && transcript.length > 0) {
      return transcript.map((t) => t.text).join(" ");
    }
  } catch {}
  const langs = ["en", "en-US", "en-GB"];
  for (const lang of langs) {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      if (transcript && transcript.length > 0) {
        return transcript.map((t) => t.text).join(" ");
      }
    } catch {}
  }
  return "";
}

async function fetchYouTubeMetadata(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
    });
    const html = await res.text();
    const $ = load(html);
    
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('title').text() || 
                  $('h1').first().text() || 
                  '';
    
    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || 
                       '';
    
    const channel = $('meta[property="og:video:tag"]').attr('content') || 
                   $('link[itemprop="name"]').attr('content') || 
                   '';
    
    const content = [title, description, channel].filter(Boolean).join('\n\n');
    return content.trim();
  } catch {
    return "";
  }
}

async function generateTitleWithGemini(content: string): Promise<string> {
  if (!genAI) throw new Error("Missing GOOGLE_GEMINI_API_KEY");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Generate a concise, descriptive title (max 60 characters) for this content. Return only the title, no quotes or extra text.\n\n${content.slice(0, 4000)}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return text.trim().replace(/['"]/g, '');
}

async function summarizeWithGemini(content: string): Promise<string> {
  if (!genAI) throw new Error("Missing GOOGLE_GEMINI_API_KEY");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Summarize the following content in 3-5 concise bullet points, plain text.\n\n${content.slice(0, 12000)}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return text.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
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
    const sourceType = isYouTubeUrl(cleanedUrl) ? "youtube" : "web";
    let content = "";
    let title = "";
    
    if (sourceType === "youtube") {
      content = await fetchYouTubeTranscript(cleanedUrl);
      if (!content) {
        content = await fetchYouTubeMetadata(cleanedUrl);
      }
      if (content) {
        const lines = content.split('\n');
        title = lines[0] || '';
        content = lines.slice(1).join('\n');
      }
    } else {
      const result = await fetchWebPageWithFirecrawl(cleanedUrl);
      content = result.content;
      title = result.title;
    }

    if (!content) {
      const msg = sourceType === "youtube" ?
        "No transcript or metadata found for this video." :
        "No content found";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!title) {
      title = await generateTitleWithGemini(content);
    }

    const summary = await summarizeWithGemini(content);

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

    return NextResponse.json({ item: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}


