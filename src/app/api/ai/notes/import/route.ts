import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { streamText, resolveConfig } from "@/lib/ai/provider"
import { getUserProviderConfig } from "@/lib/ai/keys"

export const maxDuration = 30

function extractPlainText(content: Record<string, unknown>): string {
  if (!content?.content || !Array.isArray(content.content)) return ""
  const extract = (node: Record<string, unknown>): string => {
    if (node.type === "text") return (node.text as string) || ""
    if (node.content && Array.isArray(node.content)) {
      return (node.content as Record<string, unknown>[]).map(extract).join("")
    }
    return ""
  }
  return (content.content as Record<string, unknown>[])
    .map(extract)
    .join("\n")
    .trim()
}

const SYSTEM_PROMPT = `You are helping create a note from summarized web content. Your job is to REWRITE the content entirely - do NOT copy or paraphrase the summary. Produce a fresh, original note.

RULES:
1. Use the summary only as source material. Rewrite everything in your own words, with a new structure and flow.
2. Do NOT repeat the summary's phrasing, bullet points, or structure. Create something genuinely different.
3. If the user's current note has content, incorporate its themes and expand with insights from the summary - but still rewrite fully.
4. Use Markdown formatting:
   - # Heading 1 for main sections, ## Heading 2 for subsections, ### Heading 3
   - **bold** for key terms and emphasis
   - *italic* for subtle emphasis
   - Bullet lists with - or * for key points
5. Return ONLY the note content. No meta-commentary, no "Here's the note".
6. Use the same language as the source (English or Sinhala).
7. Aim for ~200 words, well-structured.`

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { noteContent, summaryId } = await req.json()

    if (!summaryId) {
      return NextResponse.json({ error: "Missing summaryId" }, { status: 400 })
    }

    const { data: summary, error: summaryError } = await supabase
      .from("web_summaries")
      .select("summary, title, url")
      .eq("id", summaryId)
      .eq("user_id", user.id)
      .single()

    if (summaryError || !summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 })
    }

    const currentNoteText = noteContent
      ? extractPlainText(noteContent as Record<string, unknown>)
      : ""

    const userConfig = await getUserProviderConfig(supabase, user.id)
    const config = resolveConfig(userConfig)

    const prompt = `CURRENT NOTE:
${currentNoteText || "(empty)"}

SUMMARY TO INTEGRATE (from: ${summary.title || summary.url}):
${summary.summary}

Rewrite this entirely into a fresh, original note (do not copy the summary):`

    const transformStream = new TransformStream()
    const writer = transformStream.writable.getWriter()
    const encoder = new TextEncoder()

    ;(async () => {
      try {
        for await (const chunk of streamText(config, prompt, {
          temperature: 0.5,
          maxTokens: 4096,
          systemPrompt: SYSTEM_PROMPT,
        })) {
          if (chunk?.trim()) {
            await writer.write(
              encoder.encode(JSON.stringify({ text: chunk.trim() }) + "\n")
            )
          }
        }
      } catch (error) {
        console.error("Import stream error:", error)
      } finally {
        await writer.write(
          encoder.encode(JSON.stringify({ sourceUrl: summary.url, sourceTitle: summary.title }) + "\n")
        )
        await writer.close()
      }
    })()

    return new Response(transformStream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Import failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
