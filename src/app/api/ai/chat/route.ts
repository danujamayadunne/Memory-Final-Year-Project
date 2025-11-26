import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY as string;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

async function generateAIChatResponse(content: string) {
  if (!genAI) throw new Error("Missing GOOGLE_GEMINI_API_KEY");

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const conversationLines = content.split('\n---\n\nConversation:\n')
  const articlePart = conversationLines[0] || content
  const conversationPart = conversationLines[1] || ''

  const prompt = `You are an AI assistant helping users understand articles they've saved. Your role is to answer questions based ONLY on the article content provided below.

CRITICAL RULES:
1. Answer questions using ONLY information from the article summary and content provided
2. If a question cannot be answered from the article, politely say: "Based on the article, I don't have information about that. However, the article does cover [mention what it covers]."
3. Do NOT make up information or use knowledge outside the article
4. Use **bold formatting** for important terms, concepts, and key points
5. Be clear, concise, and educational
6. Maintain context from the conversation history if provided
7. Be conversational and helpful

${articlePart}

${conversationPart ? `\nPrevious conversation context:\n${conversationPart}\n` : ''}

Now answer the user's question based ONLY on the article content above. If the question is about something not covered in the article, acknowledge this clearly.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return [text];
}

export async function POST(req: NextRequest) {
  try {
    const { summaryId, conversation } = await req.json();

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!summaryId) {
      return NextResponse.json({ error: "Missing summaryId" }, { status: 400 });
    }

    const { data: summary, error: summaryError } = await supabase
      .from("web_summaries")
      .select("summary, title, url")
      .eq("id", summaryId)
      .eq("user_id", user.id)
      .single();

    if (summaryError || !summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    if (!summary.summary) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const articleContext = `Article Title: ${summary.title || 'Untitled'}\nArticle URL: ${summary.url}\n\nArticle Summary:\n${summary.summary}`;

    const fullContent = conversation
      ? `${articleContext}\n\n---\n\nConversation:\n${conversation}`
      : articleContext;

    const suggestions = await generateAIChatResponse(fullContent);
    return NextResponse.json({ suggestions });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

