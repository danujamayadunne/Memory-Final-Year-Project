"use client"

import { useEffect, useMemo } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { Bold, Italic, List, Undo, Redo, Sparkles, Strikethrough, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { marked } from "marked"
import { createCompletionExtension } from "./completion-extension"

export type TiptapContent = Record<string, unknown>

function formatHarvardCitation(url: string, title?: string): { html: string; nodes: Record<string, unknown>[] } {
  const accessed = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const displayTitle = title || url
  const html = `<em>${escapeHtml(displayTitle)}</em> (n.d.) Available at: <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a> (Accessed: ${accessed})`
  const nodes: Record<string, unknown>[] = [
    { type: "text", text: displayTitle, marks: [{ type: "italic" }] },
    { type: "text", text: " (n.d.) Available at: " },
    { type: "text", text: url, marks: [{ type: "link", attrs: { href: url, target: "_blank" } }] },
    { type: "text", text: ` (Accessed: ${accessed})` },
  ]
  return { html, nodes }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function markdownToTiptapWithCitation(
  markdown: string,
  url: string,
  title?: string
): string {
  const html = (marked.parse(markdown.trim(), { async: false }) as string) || ""
  const { html: citationHtml } = formatHarvardCitation(url, title)
  const citation = `<blockquote><p>${citationHtml}</p></blockquote>`
  return html ? `${html}${citation}` : citation
}

interface TiptapEditorProps {
  content: TiptapContent | string
  onChange: (content: TiptapContent) => void
  onImportClick?: () => void
  placeholder?: string
  className?: string
  editable?: boolean
}

function createCitationBlock(url: string, title?: string): TiptapContent {
  const { nodes } = formatHarvardCitation(url, title)
  return {
    type: "doc",
    content: [
      { type: "paragraph" },
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: nodes }],
      },
    ],
  }
}

function textToTiptapWithCitation(text: string, url: string, title?: string): TiptapContent {
  const lines = text.split("\n").filter((l) => l.trim())
  const blocks: Record<string, unknown>[] = []
  let currentList: Record<string, unknown>[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const isBullet = /^[-•*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)
    const text = trimmed
      .replace(/^[-•*]\s+/, "")
      .replace(/^\d+[.)]\s+/, "")
      .trim()
    if (isBullet) {
      currentList.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text }] }],
      })
    } else {
      if (currentList.length > 0) {
        blocks.push({ type: "bulletList", content: currentList })
        currentList = []
      }
      blocks.push({
        type: "paragraph",
        content: [{ type: "text", text }],
      })
    }
  }
  if (currentList.length > 0) {
    blocks.push({ type: "bulletList", content: currentList })
  }

  const { nodes } = formatHarvardCitation(url, title)
  blocks.push({
    type: "blockquote",
    content: [{ type: "paragraph", content: nodes }],
  })

  return { type: "doc", content: blocks }
}

function summaryToTiptapJson(summary: string, url: string, title?: string): TiptapContent {
  return textToTiptapWithCitation(summary, url, title)
}

export function TiptapEditor({
  content,
  onChange,
  onImportClick,
  placeholder = "Start writing...",
  className,
  editable = true,
}: TiptapEditorProps) {
  const completionExt = useMemo(() => createCompletionExtension(), [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      Placeholder.configure({ placeholder }),
      completionExt,
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[180px] focus:outline-none py-2 break-words prose-h1:text-xl prose-h1:font-bold prose-h2:text-lg prose-h2:font-semibold prose-h3:text-base prose-h3:font-medium",
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getJSON()
    if (JSON.stringify(current) !== JSON.stringify(content)) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) return null

  const btn = "p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"

  return (
    <div className={cn("min-w-0 flex flex-col h-full", className)}>
      {editable && (
        <div className="flex items-center gap-1 py-2 mb-1 border-b border-border/60 shrink-0">
          <button
            type="button"
            className={cn(btn, editor.isActive("bold") && "bg-muted text-foreground")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={cn(btn, editor.isActive("italic") && "bg-muted text-foreground")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={cn(btn, editor.isActive("strike") && "bg-muted text-foreground")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={cn(btn, editor.isActive("bulletList") && "bg-muted text-foreground")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <Select
            value={
              editor.isActive("heading", { level: 1 })
                ? "1"
                : editor.isActive("heading", { level: 2 })
                  ? "2"
                  : editor.isActive("heading", { level: 3 })
                    ? "3"
                    : "0"
            }
            onValueChange={(v) => {
              const level = parseInt(v, 10)
              if (level) editor.chain().focus().toggleHeading({ level }).run()
              else editor.chain().focus().setParagraph().run()
            }}
          >
            <SelectTrigger className="h-8 w-[110px] border-0 bg-transparent shadow-none text-xs" size="sm">
              <SelectValue placeholder="Paragraph" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Paragraph</SelectItem>
              <SelectItem value="1">Heading 1</SelectItem>
              <SelectItem value="2">Heading 2</SelectItem>
              <SelectItem value="3">Heading 3</SelectItem>
            </SelectContent>
          </Select>
          <button type="button" className={btn} onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={btn} onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo className="h-3.5 w-3.5" />
          </button>
          {onImportClick && (
            <>
              <span className="mx-1 w-px h-4 bg-border/60" />
              <button
                type="button"
                className={cn(btn, "flex items-center gap-1 text-[10px]")}
                onClick={onImportClick}
                title="Import from summary"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Import
              </button>
            </>
          )}
          <span className="mx-1 w-px h-4 bg-border/60" />
          <span
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
            title="Press Shift+Ctrl+Z for AI autocomplete"
          >
            <Sparkles className="h-3 w-3" />
            ⇧⌃Z AI autocomplete
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

export { summaryToTiptapJson, textToTiptapWithCitation, createCitationBlock }
