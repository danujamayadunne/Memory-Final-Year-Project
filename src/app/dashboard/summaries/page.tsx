"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Search, Clock, ExternalLink, Trash2, MessageCircle, Link as LinkIcon, Tags, Sparkles, Loader } from "lucide-react"
import { ChatSheet } from "@/components/dashboard/chat-sheet"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SummaryDialog } from "@/components/dashboard/summary-dialog"
import { findRelatedSummariesWithAI, type RelatedSummaryWithScore } from "@/lib/similarity"
import { SimpleTagDialog } from "@/components/dashboard/simple-tag-dialog"

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

export default function SummariesPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<SummaryItem[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTag, setSelectedTag] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SummaryItem[]>([])
  const [useSemanticSearch, setUseSemanticSearch] = useState(true)
  const [selectedItem, setSelectedItem] = useState<SummaryItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [relatedTopics, setRelatedTopics] = useState<RelatedSummaryWithScore<SummaryItem>[]>([])
  const [showRelatedTopics, setShowRelatedTopics] = useState(false)
  const [loadingRelatedTopics, setLoadingRelatedTopics] = useState(false)
  const [showAddTagsModal, setShowAddTagsModal] = useState(false)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const performTextSearch = useCallback((query: string, list: SummaryItem[]): SummaryItem[] => {
    const searchLower = query.toLowerCase().trim()
    if (!searchLower) return list

    return list.filter((item) => {
      const titleMatch = item.title?.toLowerCase().includes(searchLower) || false
      const summaryMatch = item.summary?.toLowerCase().includes(searchLower) || false
      const urlMatch = item.url?.toLowerCase().includes(searchLower) || false
      const tagMatch =
        item.tags?.some((tag) => tag.name.toLowerCase().includes(searchLower)) || false
      return titleMatch || summaryMatch || urlMatch || tagMatch
    })
  }, [])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }

    if (!useSemanticSearch) {
      setSearching(false)
      const textResults = performTextSearch(searchTerm, items)
      setSearchResults(textResults)
      return
    }

    const controller = new AbortController()
    const trimmed = searchTerm.trim()
    const timeoutId = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch("/api/ai/text/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, limit: 100 }),
          signal: controller.signal,
        })

        if (res.ok) {
          const data = await res.json()
          const semantic = Array.isArray(data.results) ? data.results : []
          setSearchResults(
            semantic.length > 0 ? semantic : performTextSearch(trimmed, items)
          )
        } else {
          console.error("Search failed:", await res.text())
          setSearchResults(performTextSearch(trimmed, items))
        }
      } catch (error: unknown) {
        if ((error as { name?: string })?.name !== "AbortError") {
          console.error("Error performing vector search:", error)
          setSearchResults(performTextSearch(trimmed, items))
        }
      } finally {
        setSearching(false)
      }
    }, 500)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [searchTerm, useSemanticSearch, items, performTextSearch])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()

    try {

      const { data: summaries } = await supabase
        .from("web_summaries")
        .select("id, url, summary, title, created_at, tags")
        .order("created_at", { ascending: false })

      if (summaries) {

        const allTags = new Map<string, Tag>()
        summaries.forEach(item => {
          if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach((tag: unknown) => {
              if (
                typeof tag === "object" &&
                tag !== null &&
                "id" in tag &&
                typeof (tag as { id: unknown }).id === "string" &&
                !allTags.has((tag as { id: string }).id)
              ) {
                const t = tag as { id: string; name?: string; color?: string }
                allTags.set(t.id, { id: t.id, name: t.name || '', color: t.color || '#6b7280' })
              }
            })
          }
        })
        setTags(Array.from(allTags.values()).sort((a, b) => a.name.localeCompare(b.name)))

        setItems(summaries as SummaryItem[])
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAskQuestion = (summary: SummaryItem) => {
    setSelectedItem(summary)
    setChatOpen(true)
  }

  const handleSeeRelatedTopics = async (summary: SummaryItem) => {
    setSelectedItem(summary)
    setShowRelatedTopics(true)
    setLoadingRelatedTopics(true)
    setRelatedTopics([])

    try {
      const related = await findRelatedSummariesWithAI(summary, items, 5, 0.5)
      setRelatedTopics(related)
    } catch (error) {
      console.error("Error finding related topics:", error)
      setRelatedTopics([])
    } finally {
      setLoadingRelatedTopics(false)
    }
  }

  const handleAddTags = async (summary: SummaryItem) => {
    setSelectedItem(summary)
    setShowAddTagsModal(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/summaries/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id))
      }
    } catch (error) {
      console.error("Error deleting summary:", error)
    }
  }

  const itemsToFilter = searchTerm.trim() ? searchResults : items

  const filteredItems = itemsToFilter.filter(item => {
    const matchesTag = !selectedTag || selectedTag === "all" || item.tags?.some(tag => tag.id === selectedTag)
    return matchesTag
  })

  return (
    <DashboardLayout>
      <div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative border border-input rounded-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={useSemanticSearch ? "Search by meaning..." : "Search titles, summaries, tags..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 h-11 border-0 bg-muted/50 hover:bg-muted/70 focus-visible:bg-muted/70 rounded-lg transition-colors ${searching ? "opacity-70" : ""}`}
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="w-full sm:w-44 h-11 border-0 bg-muted/50 rounded-lg">
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {tags.map(tag => (
                  <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Semantic Search
              </span>
              <Switch
                id="semantic-search"
                checked={useSemanticSearch}
                onCheckedChange={setUseSemanticSearch}
              />
            </label>
            {searchTerm.trim() && (
              <span className="text-xs text-muted-foreground">
                {searching ? "Searching..." : `${filteredItems.length} result${filteredItems.length !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-9 pb-5">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Summaries ({filteredItems.length})
          </h2>
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
        ) : (searching && searchTerm.trim()) ? (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <Loader className="h-5 w-5 animate-spin text-muted-foreground/60 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              {useSemanticSearch ? "Finding similar content..." : "Searching..."}
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 px-6 text-center">
            <p className="text-muted-foreground text-sm mb-1">No summaries found</p>
            <p className="text-muted-foreground/80 text-sm">
              {searchTerm || selectedTag !== "all"
                ? "Try adjusting your filters or search"
                : "Add content from the dashboard to get started"
              }
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            {filteredItems.map((item, idx, arr) => (
              <div
                key={item.id}
                onClick={() => { setSelectedItem(item); setShowModal(true) }}
                className={`flex items-start gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 group ${idx < arr.length - 1 ? "border-b" : ""
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
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAskQuestion(item)} title="Ask question">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSeeRelatedTopics(item)} title="Related topics">
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAddTags(item)} title="Add tags">
                    <Tags className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
              </div>
            ))}
          </div>
        )}

        <SummaryDialog
          item={selectedItem}
          open={showModal}
          onOpenChange={setShowModal}
        />

        <Dialog open={showRelatedTopics} onOpenChange={(open) => {
          setShowRelatedTopics(open)
          if (!open) {
            setLoadingRelatedTopics(false)
            setRelatedTopics([])
          }
        }}>
          <DialogContent className="max-h-[90vh] w-[560px] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-xl">
            <DialogHeader className="flex-shrink-0 border-b px-8 pt-8 pb-6">
              <div className="flex gap-4">
                <div className="flex h-13 w-1 shrink-0 self-stretch rounded-full bg-chart-1/80" aria-hidden />
                <div className="min-w-0 flex-1">
                  <DialogTitle className="font-serif text-lg font-normal">Related Topics</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Similar to &quot;{selectedItem?.title || selectedItem?.url}&quot;
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              {loadingRelatedTopics ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Sparkles className="h-8 w-8 text-chart-1 animate-pulse mb-3" />
                  <p className="text-sm text-muted-foreground">Finding related content...</p>
                </div>
              ) : relatedTopics.length === 0 ? (
                <p className="text-muted-foreground text-center py-12 text-sm">No related topics found</p>
              ) : (
                <div className="divide-y">
                  {relatedTopics.map(({ item: topic, score }) => {
                    const relevancePercent = Math.round(score * 100)
                    const circumference = 2 * Math.PI * 14
                    const offset = circumference - (relevancePercent / 100) * circumference
                    const getRelevanceColor = (percent: number) => {
                      if (percent >= 70) return "text-chart-2"
                      if (percent >= 50) return "text-chart-4"
                      if (percent >= 30) return "text-chart-5"
                      return "text-muted-foreground/50"
                    }
                    return (
                      <div
                        key={topic.id}
                        className="flex items-start gap-4 px-8 py-4 cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => {
                          setShowRelatedTopics(false)
                          setSelectedItem(topic)
                          setShowModal(true)
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <a
                            href={topic.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-foreground hover:text-chart-1 truncate block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {topic.title || topic.url}
                          </a>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                            {topic.summary}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {topic.tags?.map(tag => (
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
                        <div className="relative w-10 h-10 shrink-0">
                          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 32 32">
                            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/50" />
                            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={circumference} strokeDashoffset={offset} className={getRelevanceColor(relevancePercent)} strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-medium tabular-nums">{relevancePercent}%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <ChatSheet
          summary={selectedItem}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />

        <SimpleTagDialog summaryId={selectedItem?.id || ""} currentTags={selectedItem?.tags || []} onTagsUpdate={(updatedTags) => {
          setItems(prev => prev.map(item =>
            item.id === selectedItem?.id
              ? { ...item, tags: updatedTags }
              : item
          ))
          setSelectedItem(prev => prev ? { ...prev, tags: updatedTags } : null)
        }} isOpen={showAddTagsModal} onClose={() => setShowAddTagsModal(false)} />

      </div>
    </DashboardLayout>
  )
}
