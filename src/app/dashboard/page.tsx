"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, BookOpen, Clock, ExternalLink, Loader2, ChevronRight } from "lucide-react"
import { SimpleTagDialog } from "@/components/dashboard/simple-tag-dialog"
import { ChatSheet } from "@/components/dashboard/chat-sheet"
import { SummaryDialog } from "@/components/dashboard/summary-dialog"
import Link from "next/link"

type SummaryItem = {
  id: string
  url: string
  summary: string
  title?: string
  created_at: string
  tags?: Array<{ id: string; name: string; color: string }>
}

type Tag = {
  id: string
  name: string
  color: string
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [url, setUrl] = useState("")
  const [items, setItems] = useState<SummaryItem[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [addingProgress, setAddingProgress] = useState<string>("")
  const [selectedItem, setSelectedItem] = useState<SummaryItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  useEffect(() => {
    if (user) {
      loadItems()
      loadTags()
      loadTotalCount()
    }
  }, [user])

  const loadItems = async () => {
    setLoading(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from("web_summaries")
        .select("id, url, summary, title, created_at, tags")
        .order("created_at", { ascending: false })
        .limit(5)

      if (!error && data) {
        setItems(data as SummaryItem[])
      }
    } catch (error) {
      console.error("Error loading items:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadTags = async () => {
    const supabase = createClient()

    const { data: summaries } = await supabase
      .from("web_summaries")
      .select("tags")

    if (summaries) {
      const allTags = new Map<string, Tag>()
      summaries.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((tag: any) => {
            if (tag.id && !allTags.has(tag.id)) {
              allTags.set(tag.id, { id: tag.id, name: tag.name || '', color: tag.color || '#6b7280' })
            }
          })
        }
      })
      setTags(Array.from(allTags.values()).sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  const loadTotalCount = async () => {
    const supabase = createClient()
    try {
      const { count, error } = await supabase
        .from("web_summaries")
        .select("*", { count: "exact", head: true })

      if (!error && count !== null) {
        setTotalCount(count)
      }
    } catch (error) {
      console.error("Error loading total count:", error)
    }
  }


  const handleAdd = async () => {
    if (!isValidUrl(url)) {
      setError("Please enter a valid URL")
      return
    }
    setError(null)
    setLoading(true)
    setIsAdding(true)
    setAddingProgress("Fetching content...")

    try {
      setAddingProgress("Summarizing content...")
      const res = await fetch("/api/ai/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to summarize")

      const newItem = json.item as SummaryItem
      setItems((prev) => [newItem, ...prev])
      setTotalCount((prev) => prev + 1)
      setUrl("")
      setAddingProgress("")
    } catch (e: any) {
      setError(e?.message || "Something went wrong")
      setAddingProgress("")
    } finally {
      setLoading(false)
      setIsAdding(false)
    }
  }

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
            <h1 className="text-xl font-medium">Welcome to Memory</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to access your dashboard
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild className="flex-1 rounded-lg">
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 rounded-lg">
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div>

        {/* <div className="flex items-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium tabular-nums">{totalCount}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">This week</span>
            <span className="font-medium tabular-nums">
              {items.filter(item => {
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                return new Date(item.created_at) > weekAgo
              }).length}
            </span>
          </div>
        </div> */}

        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative group border border-input rounded-lg">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Add a link to summarize..."
                className="pl-10 h-11 border-0 bg-muted/50 hover:bg-muted/70 focus-visible:bg-muted/70 rounded-lg transition-colors placeholder:text-muted-foreground"
                disabled={isAdding}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={loading || !isValidUrl(url) || isAdding}
              size="sm"
              className="h-11 px-5 rounded-lg shrink-0"
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline ml-2">{addingProgress || "Adding..."}</span>
                </>
              ) : (
                "Add"
              )}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="space-y-1 pt-9 pb-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Recent
            </h2>
            <Link
              href="/dashboard/summaries"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-lg px-4 py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed py-16 px-6 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/60 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm mb-1">No summaries yet</p>
              <p className="text-muted-foreground/80 text-sm">
                Add a link above to create your first summary
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              {items.slice(0, 5).map((item, idx, arr) => (
                <div
                  key={item.id}
                  onClick={() => { setSelectedItem(item); setShowModal(true) }}
                  className={`flex items-start gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${idx < arr.length - 1 ? "border-b" : ""
                    }`}
                >
                  <div className="flex-1 min-w-0 pt-0.5">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-foreground hover:text-primary truncate block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.title || item.url}
                    </a>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                      {item.summary}
                    </p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {item.tags?.map(tag => (
                        <span
                          key={tag.id}
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
                </div>
              ))}
            </div>
          )}
        </div>

        <SummaryDialog
          item={selectedItem}
          open={showModal}
          onOpenChange={setShowModal}
        />

        <SimpleTagDialog
          summaryId={selectedItem?.id || ""}
          currentTags={selectedItem?.tags || []}
          onTagsUpdate={(updatedTags) => {
            setItems(prev => prev.map(item =>
              item.id === selectedItem?.id
                ? { ...item, tags: updatedTags }
                : item
            ))
            setSelectedItem(prev => prev ? { ...prev, tags: updatedTags } : null)
          }}
          isOpen={showTagDialog}
          onClose={() => setShowTagDialog(false)}
        />

        <ChatSheet summary={selectedItem} isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
    </DashboardLayout>
  )
}