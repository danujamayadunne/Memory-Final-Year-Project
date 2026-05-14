import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { generateText, resolveConfig } from "@/lib/ai/provider";
import { getUserProviderConfig } from "@/lib/ai/keys";

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

    const userConfig = await getUserProviderConfig(supabase, user.id);
    const config = resolveConfig(userConfig);

    const articleContext = `Article Title: ${summary.title || 'Untitled'}\nArticle URL: ${summary.url}\n\nArticle Summary:\n${summary.summary}`;

    const conversationLines = conversation
      ? `\n\n---\n\nConversation:\n${conversation}`
      : '';

    const prompt = `You are an AI assistant helping users understand articles they've saved. Your role is to answer questions based ONLY on the article content provided below.

CRITICAL RULES:
1. Answer questions using ONLY information from the article summary and content provided
2. If a question cannot be answered from the article, politely say: "Based on the article, I don't have information about that. However, the article does cover [mention what it covers]."
3. Do NOT make up information or use knowledge outside the article
4. Use **bold formatting** for important terms, concepts, and key points
5. Be clear, concise, and educational
6. Maintain context from the conversation history if provided
7. Be conversational and helpful

${articleContext}
${conversationLines ? `\nPrevious conversation context:\n${conversationLines}\n` : ''}

Now answer the user's question based ONLY on the article content above. If the question is about something not covered in the article, acknowledge this clearly.`;

    const text = await generateText(config, prompt);

    return NextResponse.json({ suggestions: [text] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
