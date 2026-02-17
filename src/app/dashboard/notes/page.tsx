"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TiptapEditor, markdownToTiptapWithCitation, type TiptapContent } from "@/components/notes/tiptap-editor"
import {
  Plus,
  FileText,
  Trash2,
  Loader2,
  Search,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const DEFAULT_CONTENT: TiptapContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
}

type Note = {
  id: string
  title: string
  content: TiptapContent
  created_at: string
  updated_at: string
}

type SummaryItem = {
  id: string
  url: string
  summary: string
  title?: string
}

export default function NotesPage() {
  const { user, loading: authLoading } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [content, setContent] = useState<TiptapContent>(DEFAULT_CONTENT)
  const [title, setTitle] = useState("Untitled Note")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [summaries, setSummaries] = useState<SummaryItem[]>([])
  const [loadingSummaries, setLoadingSummaries] = useState(false)
  const [importing, setImporting] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasInitialSelected = useRef(false)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notes")
      if (!res.ok) throw new Error("Failed to load notes")
      const data = await res.json()
      setNotes(data.notes || [])
      if (!hasInitialSelected.current && data.notes?.length > 0) {
        hasInitialSelected.current = true
        const first = data.notes[0]
        setSelectedNote(first)
        setContent(first.content || DEFAULT_CONTENT)
        setTitle(first.title || "Untitled Note")
      }
    } catch (e) {
      console.error("Error loading notes:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      hasInitialSelected.current = false
      loadNotes()
    }
  }, [user, loadNotes])

  const loadSummaries = useCallback(async () => {
    setLoadingSummaries(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("web_summaries")
        .select("id, url, summary, title")
        .order("created_at", { ascending: false })
        .limit(50)
      setSummaries((data as SummaryItem[]) || [])
    } catch (e) {
      console.error("Error loading summaries:", e)
    } finally {
      setLoadingSummaries(false)
    }
  }, [])

  useEffect(() => {
    if (showImportDialog) loadSummaries()
  }, [showImportDialog, loadSummaries])

  const saveNote = useCallback(
    async (noteId: string, contentToSave: TiptapContent, titleToSave: string) => {
      setSaving(true)
      try {
        const res = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: contentToSave, title: titleToSave }),
        })
        if (!res.ok) throw new Error("Failed to save")
        const { note } = await res.json()
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, ...note } : n))
        )
        if (selectedNote?.id === noteId) {
          setSelectedNote((prev) => (prev ? { ...prev, ...note } : null))
        }
      } catch (e) {
        console.error("Error saving note:", e)
      } finally {
        setSaving(false)
      }
    },
    [selectedNote]
  )

  const handleContentChange = (newContent: TiptapContent) => {
    setContent(newContent)
    if (!selectedNote) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(selectedNote.id, newContent, title)
    }, 1500)
  }

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    if (!selectedNote) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(selectedNote.id, content, newTitle)
    }, 1500)
  }

  const handleCreateNote = async () => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Note", content: DEFAULT_CONTENT }),
      })
      if (!res.ok) throw new Error("Failed to create")
      const { note } = await res.json()
      setNotes((prev) => [note, ...prev])
      setSelectedNote(note)
      setContent(note.content || DEFAULT_CONTENT)
      setTitle(note.title || "Untitled Note")
    } catch (e) {
      console.error("Error creating note:", e)
    }
  }

  const handleDeleteNote = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (selectedNote?.id === id) {
        const remaining = notes.filter((n) => n.id !== id)
        const next = remaining[0] || null
        setSelectedNote(next)
        setContent(next?.content || DEFAULT_CONTENT)
        setTitle(next?.title || "Untitled Note")
      }
    } catch (e) {
      console.error("Error deleting note:", e)
    }
  }

  const handleImportSummary = async (summary: SummaryItem) => {
    setImporting(true)
    const toastId = toast.loading("Importing from summary...")
    try {
      const res = await fetch("/api/ai/notes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteContent: selectedNote ? content : null,
          summaryId: summary.id,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Import failed")
      }
      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response body")
      const decoder = new TextDecoder()
      let buffer = ""
      let fullText = ""
      let sourceUrl = summary.url
      let sourceTitle = summary.title
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line) as { text?: string; sourceUrl?: string; sourceTitle?: string }
            if (data.text) fullText += data.text
            if (data.sourceUrl) sourceUrl = data.sourceUrl
            if (data.sourceTitle !== undefined) sourceTitle = data.sourceTitle
          } catch {
            // skip invalid JSON
          }
        }
      }
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer) as { text?: string; sourceUrl?: string; sourceTitle?: string }
          if (data.text) fullText += data.text
          if (data.sourceUrl) sourceUrl = data.sourceUrl
          if (data.sourceTitle !== undefined) sourceTitle = data.sourceTitle
        } catch {
          // skip
        }
      }
      const importedContent = markdownToTiptapWithCitation(fullText, sourceUrl, sourceTitle)
      setContent(importedContent as unknown as TiptapContent)
      if (selectedNote) {
        // Debounced save will persist after editor parses HTML and onChange fires
      } else {
        const createRes = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: sourceTitle || "Imported Note",
            content: importedContent,
          }),
        })
        if (!createRes.ok) throw new Error("Failed to create")
        const { note } = await createRes.json()
        setNotes((prev) => [note, ...prev])
        setSelectedNote(note)
        setContent(note.content || DEFAULT_CONTENT)
        setTitle(note.title || "Untitled Note")
      }
      toast.success("Import completed", { id: toastId })
      setShowImportDialog(false)
    } catch (e) {
      console.error("Error importing:", e)
      toast.error("Import failed", { id: toastId })
    } finally {
      setImporting(false)
    }
  }

  const filteredNotes = notes.filter(
    (n) =>
      !searchTerm ||
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(n.content).toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="w-full max-w-sm space-y-6 text-center px-4">
          <div>
            <h1 className="text-xl font-medium">Sign in required</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to view your notes
            </p>
          </div>
          <Button asChild className="w-full rounded-lg">
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row gap-4 h-[calc(100vh-10rem)]">
        <aside className="w-full sm:w-56 shrink-0 flex flex-col gap-2">
          <div className="flex gap-1.5">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm border rounded-md"
              />
            </div>
            <Button size="icon" className="h-9 w-9 shrink-0 rounded-md" onClick={handleCreateNote}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 rounded-md border border-border/60">
            {loading ? (
              <div className="p-3 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                <p>No notes</p>
                <p className="mt-0.5">New note or import</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => {
                      setSelectedNote(note)
                      setContent(note.content || DEFAULT_CONTENT)
                      setTitle(note.title || "Untitled Note")
                    }}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/40 group ${
                      selectedNote?.id === note.id ? "bg-muted/50" : ""
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {note.title || "Untitled Note"}
                      </p>
                      <p className="text-[10px] text-muted-foreground/80">
                        {new Date(note.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="p-1 rounded opacity-0 group-hover:opacity-100 text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteNote(note.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          {selectedNote ? (
            <>
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    handleTitleChange(e.target.value)
                  }}
                  className="text-base font-semibold border rounded-md px-3 py-2 h-10 focus-visible:ring-2 shadow-none"
                  placeholder="Note title"
                />
                {saving && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-md border border-border/60 p-3">
                <TiptapEditor
                  content={content}
                  onChange={handleContentChange}
                  onImportClick={() => setShowImportDialog(true)}
                  placeholder="Write..."
                  className="h-full"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-md border border-dashed border-border/60">
              <div className="text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground text-xs mb-3">No note selected</p>
                <Button onClick={handleCreateNote} size="sm" variant="ghost" className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  New note
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-h-[85vh] w-full max-w-[480px] overflow-hidden rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Import from summary</DialogTitle>
            <DialogDescription className="text-xs">
              AI will read your note and intelligently integrate the summary. Source is cited automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto">
            {loadingSummaries ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : summaries.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <p>No summaries yet</p>
                <Link href="/dashboard" className="text-primary hover:underline mt-1 inline-block">
                  Add a link first
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {summaries.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => handleImportSummary(item)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">
                        {item.title || item.url}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                        {item.summary}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                  </div>
                ))}
              </div>
            )}
          </div>
          {importing && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-xl">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">AI is integrating...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
