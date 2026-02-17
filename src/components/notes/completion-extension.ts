import { Extension } from "@tiptap/core"
import { marked } from "marked"
import { toast } from "sonner"

async function runCompletion(editor: {
  getText: () => string
  state: { selection: { from: number }; doc: { content: { size: number } } }
  commands: {
    insertContentAt: (pos: number, content: string | object) => void
    deleteRange: (args: { from: number; to: number }) => void
  }
}) {
  const text = editor.getText()
  const words = text.split(/\s+/).filter(Boolean)
  const prompt = words.slice(-30).join(" ")
  if (!prompt.trim()) return

  const { from } = editor.state.selection
  const docSizeBefore = editor.state.doc.content.size
  const toastId = toast.loading("Autocompletion generating...")

  try {
    const res = await fetch("/api/ai/completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      credentials: "same-origin",
    })
    if (!res.ok) {
      toast.dismiss(toastId)
      return
    }

    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ""
    let insertPos = from
    let fullText = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const data = JSON.parse(line) as { text?: string }
          if (data.text) {
            fullText += data.text
            editor.commands.insertContentAt(insertPos, data.text)
            insertPos = from + (editor.state.doc.content.size - docSizeBefore)
          }
        } catch {
          // skip invalid JSON lines
        }
      }
    }

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer) as { text?: string }
        if (data.text) {
          fullText += data.text
          editor.commands.insertContentAt(insertPos, data.text)
          insertPos = from + (editor.state.doc.content.size - docSizeBefore)
        }
      } catch {
        // skip
      }
    }

    if (!fullText.trim()) {
      toast.dismiss(toastId)
      return
    }

    const docSizeAfter = editor.state.doc.content.size
    const insertedSize = docSizeAfter - docSizeBefore
    const to = Math.min(from + insertedSize, docSizeAfter)
    if (to > from && to <= docSizeAfter) {
      const html = marked.parse(fullText.trim(), { async: false }) as string
      editor.commands.deleteRange({ from, to })
      editor.commands.insertContentAt(from, html)
    }
    toast.success("Completed", { id: toastId })
  } catch (err) {
    console.error("AI completion error:", err)
    toast.error("Autocompletion failed", { id: toastId })
  }
}

export function createCompletionExtension() {
  return Extension.create({
    name: "aiCompletion",

    addKeyboardShortcuts() {
      return {
        "Shift-Ctrl-z": () => {
          runCompletion(this.editor)
          return true
        },
      }
    },
  })
}
