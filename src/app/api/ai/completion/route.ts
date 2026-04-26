import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { streamText, resolveConfig } from "@/lib/ai/provider"
import { getUserProviderConfig } from "@/lib/ai/keys"

export const maxDuration = 30

const SYSTEM_PROMPT = `You are a text completion assistant. Your task is to complete the given text naturally and informatively.

CRITICAL LENGTH REQUIREMENT: You MUST generate EXACTLY 200 words. Aim for 200 words, no more, no less.

Other rules:
1. DO NOT repeat any part of the input text, even if it seems like a natural continuation
2. Start your completion exactly where the input text ends
3. If the input ends with a complete word, start with the next word
4. If the input ends with a partial word, complete that word first
5. Provide factual and accurate information
6. Maintain a natural flow and writing style
7. Use same writing style as the input text
8. If the input ends with a heading (h1, h2, etc.), start the completion with a proper sentence that introduces or describes the heading topic
9. Avoid starting completions with connecting words like "is", "was", "are" unless grammatically necessary
10. Ensure the completion flows naturally from the heading to the body text
11. If the input ends with a partial phrase or sentence, continue from that point without repeating the subject or topic
12. Always check for and remove any accidental repetition of the input text
13. Use Markdown formatting in your output:
    - # Heading 1 for main sections, ## Heading 2 for subsections, ### Heading 3 for sub-subsections
    - **bold** for emphasis and key terms
    - *italic* for subtle emphasis
    - Bullet lists with - or * for key points, steps, or items
    - Use headings and formatting naturally where it improves readability`

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { prompt } = (await req.json()) as { prompt?: string }

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      )
    }

    const userConfig = await getUserProviderConfig(supabase, user.id)
    const config = resolveConfig(userConfig)

    const completionPrompt = `Complete this text (DO NOT repeat any part of it). Generate 500 words: "${prompt}"`

    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    const encoder = new TextEncoder()

    ;(async () => {
      try {
        for await (const chunk of streamText(config, completionPrompt, {
          temperature: 0.2,
          maxTokens: 4096,
          systemPrompt: SYSTEM_PROMPT,
        })) {
          let completedText = chunk.trim()

          if (prompt.endsWith(" ") && completedText.startsWith(" ")) {
            completedText = completedText.slice(1)
          }

          const words = prompt.split(" ")
          const lastWord = words[words.length - 1]
          if (
            lastWord &&
            completedText.toLowerCase().startsWith(lastWord.toLowerCase())
          ) {
            completedText = completedText.slice(lastWord.length).trim()
          }

          if (completedText.toLowerCase().startsWith(prompt.toLowerCase())) {
            completedText = completedText.slice(prompt.length).trim()
          }

          const firstWord = completedText.split(" ")[0]
          if (
            firstWord &&
            lastWord &&
            firstWord.toLowerCase() === lastWord.toLowerCase()
          ) {
            completedText = completedText.slice(firstWord.length).trim()
          }

          if (completedText) {
            await writer.write(
              encoder.encode(JSON.stringify({ text: completedText }) + "\n")
            )
          }
        }
      } catch (error) {
        console.error("Stream processing error:", error)
      } finally {
        await writer.close()
      }
    })()

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error: unknown) {
    console.error("Error:", error)
    const msg = error instanceof Error ? error.message : ""
    const is429 = msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")
    return NextResponse.json(
      {
        error: is429
          ? "AI rate limit exceeded. Please wait a minute and try again."
          : "Failed to generate content",
      },
      { status: is429 ? 429 : 500 }
    )
  }
}
