import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY as string;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

async function generateAISuggestions(content: string, type: 'questions' | 'gaps' | 'path' | 'insights' | 'tags' | 'general') {
  if (!genAI) throw new Error("Missing GOOGLE_GEMINI_API_KEY");
  
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  let prompt = "";
  
  switch (type) {
    case 'questions':
      prompt = `Based on this content, generate 5 thoughtful follow-up questions that would help someone deepen their understanding. Focus on:
- Clarifying complex concepts
- Exploring practical applications
- Connecting to related topics
- Challenging assumptions
- Encouraging critical thinking

Use **bold formatting** for important terms in your questions.

Content: ${content.slice(0, 8000)}

Return as a JSON array of question objects with "question" and "category" fields.`;
      break;
      
    case 'gaps':
      prompt = `Analyze this content and identify 3-5 knowledge gaps or areas where someone might need additional learning to fully understand this topic. Consider:
- Prerequisites that might be missing
- Related concepts not covered
- Practical skills needed
- Deeper theoretical understanding

Use **bold formatting** for important terms and concepts.

Content: ${content.slice(0, 8000)}

Return as a JSON array of gap objects with "gap", "importance", "suggested_resources" fields.`;
      break;
      
    case 'path':
      prompt = `Based on this content, suggest a personalized learning path with 3-5 sequential steps to master this topic. Consider:
- Logical progression from basic to advanced
- Practical applications
- Different learning styles
- Time estimates

Use **bold formatting** for important terms and concepts.

Content: ${content.slice(0, 8000)}

Return as a JSON array of step objects with "step", "description", "time_estimate", "difficulty" fields.`;
      break;
      
    case 'insights':
      prompt = `Analyze this content and provide 3-5 key insights about the user's learning patterns and knowledge areas. Consider:
- Strengths and interests
- Learning style preferences
- Knowledge depth in different areas
- Suggested focus areas

Content: ${content.slice(0, 8000)}

Return as a JSON array of insight objects with "type", "title", "description", "actionable" fields.`;
      break;
      
    case 'tags':
      prompt = `Based on this content, generate 5-8 relevant tags that would help categorize and organize this information. Focus on:
- Main topics and themes
- Difficulty level indicators
- Subject areas
- Practical applications
- Key concepts

Content: ${content.slice(0, 8000)}

Return as a JSON array of tag strings.`;
      break;
      
    case 'general':
      prompt = `You are an AI assistant helping users learn and understand content. Based on the provided content and conversation context, provide helpful, educational responses. Be conversational, encouraging, and focus on learning outcomes.

Use **bold formatting** for important terms, concepts, and key information to make your responses more readable and engaging.

Content: ${content.slice(0, 8000)}

Respond naturally and helpfully to the user's question or request.`;
      break;
  }
  
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    if (type === 'general') {
      return [text];
    }
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No valid JSON found in response");
  } catch (error) {
    return [{ error: "Failed to parse AI response", raw: text }];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { summaryId, type, content } = await req.json();
    
    if (!type) {
      return NextResponse.json({ error: "Missing type" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let summaryContent = content;
    
    if (!summaryContent && summaryId) {
      const { data: summary, error: summaryError } = await supabase
        .from("web_summaries")
        .select("summary, title, url")
        .eq("id", summaryId)
        .eq("user_id", user.id)
        .single();

      if (summaryError || !summary) {
        return NextResponse.json({ error: "Summary not found" }, { status: 404 });
      }
      
      summaryContent = summary.summary;
    }

    if (!summaryContent) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const suggestions = await generateAISuggestions(summaryContent, type);

    if (type === 'insights' && Array.isArray(suggestions)) {
      for (const insight of suggestions) {
        if (insight.type && insight.title) {
          await supabase
            .from("learning_insights")
            .insert({
              user_id: user.id,
              insight_type: insight.type,
              title: insight.title,
              description: insight.description,
              data: insight
            });
        }
      }
    }

    return NextResponse.json({ suggestions });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
