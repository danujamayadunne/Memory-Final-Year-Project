"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, BookOpen, Clock, ExternalLink, Tag, Loader2, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SimpleTagDialog } from "@/components/dashboard/simple-tag-dialog"
import { ChatSheet } from "@/components/dashboard/chat-sheet"
import { FormattedSummary } from "@/components/formatted-summary"
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
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground tracking-tight">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome to Memory</CardTitle>
            <CardDescription className="tracking-tight">
              Please sign in to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-tight">Total Summaries</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{totalCount}</div>
              <p className="text-xs text-muted-foreground tracking-tight">
                Web pages summarized
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-tight">This Week</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">
                {items.filter(item => {
                  const weekAgo = new Date()
                  weekAgo.setDate(weekAgo.getDate() - 7)
                  return new Date(item.created_at) > weekAgo
                }).length}
              </div>
              <p className="text-xs text-muted-foreground tracking-tight">
                Summaries created this week
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 tracking-tight">
              <Plus className="h-5 w-5" />
              Add New Link
            </CardTitle>
            <CardDescription className="tracking-tight">
              Paste a URL to summarize web content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="flex-1 tracking-tight" disabled={isAdding} />
              <Button onClick={handleAdd} disabled={loading || !isValidUrl(url) || isAdding}>
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {addingProgress || "Adding..."}
                  </>
                ) : (
                  "Add"
                )}
              </Button>
            </div>
            {error && (
              <div className="text-sm text-destructive mt-2 tracking-tight">{error}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="tracking-tight">Recent Summaries</CardTitle>
                <CardDescription className="tracking-tight" style={{ marginTop: "9px" }}>
                  Your latest web content summaries
                </CardDescription>
              </div>
              <Button variant="outline" asChild>
                <Link href="/dashboard/summaries">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-16 w-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2 tracking-tight">No summaries yet</h3>
                <p className="text-muted-foreground mb-4 tracking-tight">
                  Start by adding a URL above to create your first summary
                </p>
                <Button asChild>
                  <Link href="/dashboard">Add Summary</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.slice(0, 5).map((item) => (
                  <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedItem(item); setShowModal(true) }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <a href={item.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate tracking-tight max-w-[900px]" onClick={(e) => e.stopPropagation()}>
                            {item.title || item.url}
                          </a>
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2 tracking-tight">
                          {item.summary}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {item.tags?.map(tag => (
                            <Badge key={tag.id} variant="outline" style={{ borderColor: `${tag.color}5A` }}>
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-h-[90vh] rounded-2xl min-w-[800px] shadow-none flex flex-col bg-white/5 backdrop-blur-lg border border-white/10 text-white">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {selectedItem?.title || selectedItem?.url}
              </DialogTitle>
              <DialogDescription>
                <a href={selectedItem?.url} target="_blank" rel="noreferrer" className="text-white hover:underline flex items-center gap-1">
                  {selectedItem?.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2">

              <div className="space-y-3">
                <h3 className="text-lg font-semibold tracking-tight">Summary</h3>
                <div className="prose prose-sm max-w-none text-white">
                  <FormattedSummary
                    content={selectedItem?.summary || ""}
                    className="text-white/90"
                  />
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex flex-col items-start gap-2 justify-between pt-4 border-t border-white/10 mt-4">
              <div className="flex flex-wrap gap-2">
                {selectedItem?.tags?.map(tag => (
                  <Badge key={tag.id} variant="secondary" className="px-3 py-1 font-medium">
                    {tag.name}
                  </Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground px-2">
                Created: {selectedItem && new Date(selectedItem.created_at).toLocaleString()}
              </div>
            </div>
          </DialogContent>
        </Dialog>

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