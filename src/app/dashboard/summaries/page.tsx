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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { BookOpen, Search, Clock, ExternalLink, Trash2, MessageCircle, Link as LinkIcon, Tags, Loader2, Sparkles } from "lucide-react"
import { ChatSheet } from "@/components/dashboard/chat-sheet"
import { FormattedSummary } from "@/components/formatted-summary"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { findRelatedSummariesWithAI, type RelatedSummaryWithScore } from "@/lib/similarity"
import { SimpleTagDialog } from "@/components/dashboard/simple-tag-dialog"
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

export default function SummariesPage() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<SummaryItem[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTag, setSelectedTag] = useState<string>("")
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

  const performTextSearch = (query: string, items: SummaryItem[]): SummaryItem[] => {
    const searchLower = query.toLowerCase().trim()
    if (!searchLower) return items

    return items.filter(item => {
      const titleMatch = item.title?.toLowerCase().includes(searchLower) || false
      const summaryMatch = item.summary.toLowerCase().includes(searchLower)
      const urlMatch = item.url.toLowerCase().includes(searchLower)
      const tagMatch = item.tags?.some(tag => tag.name.toLowerCase().includes(searchLower)) || false
      return titleMatch || summaryMatch || urlMatch || tagMatch
    })
  }

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

    const timeoutId = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch("/api/ai/text/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchTerm.trim(), limit: 100 }),
        })

        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.results || [])
        } else {
          console.error("Search failed:", await res.text())
          setSearchResults([])
        }
      } catch (error) {
        console.error("Error performing vector search:", error)
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, useSemanticSearch, items])

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
            item.tags.forEach((tag: any) => {
              if (tag.id && !allTags.has(tag.id)) {
                allTags.set(tag.id, { id: tag.id, name: tag.name || '', color: tag.color || '#6b7280' })
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Please sign in</CardTitle>
            <CardDescription>You need to be signed in to view summaries</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 tracking-tight">
              <Search className="h-5 w-5" />
              Search & Filter
            </CardTitle>
            <CardDescription className="tracking-tight">
              {useSemanticSearch ? "Semantic search powered by AI" : "Text-based search"}. Filter by tags.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex w-full gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder={useSemanticSearch ? "Search by meaning, not just keywords..." : "Search titles, summaries, URLs, tags..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`tracking-tight ${searching ? "opacity-70" : ""}`}
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="w-48">
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger className="w-full">
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
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  id="semantic-search"
                  checked={useSemanticSearch}
                  onCheckedChange={setUseSemanticSearch}
                />
                <Label htmlFor="semantic-search" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Semantic Search
                </Label>
              </div>
              {searchTerm.trim() && (
                <span className="text-xs text-muted-foreground">
                  {searching ? "Searching..." : `${filteredItems.length} result${filteredItems.length !== 1 ? 's' : ''}`}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">
              Your Summaries ({filteredItems.length} items)
            </h2>
          </div>

          {loading ? (
            <div className="grid gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent>
                    <div className="flex items-center justify-between w-full">
                      <div className="w-3/4 space-y-3">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-9 w-full" />
                        <div className="flex gap-2">
                          <Skeleton className="h-6 w-16" />
                          <Skeleton className="h-6 w-20" />
                        </div>
                      </div>
                      <div className="w-1/4 flex items-end justify-end flex-col gap-2">
                        <Skeleton className="h-6 w-[90px]" />
                        <Skeleton className="h-6 w-[90px]" />
                        <Skeleton className="h-6 w-[90px]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (searching && searchTerm.trim()) ? (
            <Card>
              <CardContent className="text-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2 tracking-tight">Searching...</h3>
                <p className="text-muted-foreground mb-4 tracking-tight">
                  {useSemanticSearch ? "Finding semantically similar content..." : "Searching through summaries..."}
                </p>
              </CardContent>
            </Card>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2 tracking-tight">No summaries found</h3>
                <p className="text-muted-foreground mb-4 tracking-tight">
                  {searchTerm || selectedTag
                    ? "Try adjusting your filters or search terms"
                    : "Start by adding some content to your knowledge base"
                  }
                </p>
                <Button asChild>
                  <Link href="/dashboard">Add Summary</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
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
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAskQuestion(item)
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Ask Question
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSeeRelatedTopics(item)
                        }}
                      >
                        <LinkIcon className="h-4 w-4" />
                        Related Topics
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddTags(item)
                          }}
                        >
                          <Tags className="h-4 w-4" />
                          Add Tags
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(item.id)
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

        <Dialog open={showRelatedTopics} onOpenChange={(open) => {
          setShowRelatedTopics(open)
          if (!open) {
            setLoadingRelatedTopics(false)
            setRelatedTopics([])
          }
        }}>
          <DialogContent className="max-h-[90vh] rounded-2xl min-w-[600px]">
            <DialogHeader>
              <DialogTitle className="tracking-tight">Related Topics</DialogTitle>
              <DialogDescription className="tracking-tight">
                Topics related to "{selectedItem?.title || selectedItem?.url}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {loadingRelatedTopics ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse mb-[9px]" />
                  <p className="text-muted-foreground text-center tracking-tight">
                    Calculating similarity...
                  </p>
                  <p className="text-xs text-muted-foreground tracking-tight">
                    Finding related summaries using AI
                  </p>
                </div>
              ) : relatedTopics.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 tracking-tight">
                  No related topics found
                </p>
              ) : (
                relatedTopics.map(({ item: topic, score }) => {
                  const relevancePercent = Math.round(score * 100);
                  const circumference = 2 * Math.PI * 16;
                  const offset = circumference - (relevancePercent / 100) * circumference;

                  const getRelevanceColor = (percent: number) => {
                    if (percent >= 70) return 'text-green-500';
                    if (percent >= 50) return 'text-yellow-500';
                    if (percent >= 30) return 'text-orange-500';
                    return 'text-gray-400';
                  };

                  return (
                    <div
                      key={topic.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        setShowRelatedTopics(false)
                        setSelectedItem(topic)
                        setShowModal(true)
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <a
                              href={topic.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline truncate tracking-tight"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {topic.title || topic.url}
                            </a>
                            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2 tracking-tight">
                            {topic.summary}
                          </p>
                          <div className="flex items-center gap-2">
                            {topic.tags?.map(tag => (
                              <Badge key={tag.id} variant="outline" style={{ borderColor: `${tag.color}5A` }}>
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="relative w-16 h-16">
                            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                              <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-gray-200 dark:text-gray-700"
                              />
                              <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                className={getRelevanceColor(relevancePercent)}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-semibold text-foreground">
                                {relevancePercent}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
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
