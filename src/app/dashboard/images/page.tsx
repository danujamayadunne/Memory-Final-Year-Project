"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ExternalLink, Image as ImageIcon, Loader, Search, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import Image from "next/image"

type ImageMemory = {
  id: string
  image_url: string
  source_url?: string | null
  description?: string | null
  tags?: string[] | null
  created_at: string
}

export default function ImagesPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<ImageMemory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTag, setSelectedTag] = useState<string>("all")
  const [useSemanticSearch, setUseSemanticSearch] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ImageMemory[]>([])
  const [selectedImage, setSelectedImage] = useState<ImageMemory | null>(null)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)

  useEffect(() => {
    if (user) {
      loadImages()
    }
  }, [user])

  const loadImages = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from("image_memories")
        .select("id, image_url, source_url, description, tags, created_at")
        .order("created_at", { ascending: false })
        .limit(48)

      if (error) throw error
      setItems(data ?? [])
    } catch (e: any) {
      console.error("Failed to load images:", e)
      setError(e?.message || "Failed to load images")
    } finally {
      setLoading(false)
    }
  }

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    items.forEach((item) => {
      item.tags?.forEach((tag) => {
        if (tag.trim()) {
          tags.add(tag.trim())
        }
      })
    })
    return Array.from(tags).sort((a, b) => a.localeCompare(b))
  }, [items])

  const performTextSearch = (query: string, list: ImageMemory[]) => {
    const search = query.toLowerCase()
    return list.filter((item) => {
      const matchesSearch =
        !search ||
        item.description?.toLowerCase().includes(search) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(search))

      return matchesSearch
    })
  }

  useEffect(() => {
    const trimmed = searchTerm.trim()

    if (!trimmed) {
      setSearchResults([])
      setSearching(false)
      return
    }

    if (!useSemanticSearch) {
      setSearching(false)
      setSearchResults(performTextSearch(trimmed, items))
      return
    }

    let aborted = false
    const controller = new AbortController()
    const timeoutId = setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch("/api/ai/images/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, limit: 60 }),
          signal: controller.signal,
        })

        if (!response.ok) {
          console.error("Image semantic search failed:", await response.text())
          setSearchResults([])
        } else {
          const data = await response.json()
          setSearchResults(Array.isArray(data.results) ? data.results : [])
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error("Image semantic search error:", err)
          setSearchResults([])
        }
      } finally {
        if (!aborted) {
          setSearching(false)
        }
      }
    }, 400)

    return () => {
      aborted = true
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [searchTerm, useSemanticSearch, items])

  const itemsToFilter = searchTerm.trim() ? searchResults : items

  const filteredItems = useMemo(() => {
    const search = searchTerm.toLowerCase().trim()
    return itemsToFilter.filter((item) => {
      const matchesTag =
        selectedTag === "all" || item.tags?.some((tag) => tag === selectedTag)

      if (!search || !useSemanticSearch) {
        return matchesTag
      }

      return matchesTag
    })
  }, [itemsToFilter, searchTerm, selectedTag, useSemanticSearch])

  return (
    <DashboardLayout>
      <div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative border border-input rounded-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search descriptions or tags..."
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
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {availableTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                id="semantic-search-images"
                checked={useSemanticSearch}
                onCheckedChange={setUseSemanticSearch}
              />
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Semantic search
              </span>
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
            Images ({filteredItems.length})
          </h2>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="rounded-lg border overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : searching && searchTerm.trim() ? (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <Loader className="h-5 w-5 animate-spin text-muted-foreground/60 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              {useSemanticSearch ? "Finding similar content..." : "Searching..."}
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 px-6 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/60 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm mb-1">No images yet</p>
            <p className="text-muted-foreground/80 text-sm max-w-xs mx-auto">
              Use the Memory browser extension to right-click any image and save it to this gallery.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border overflow-hidden cursor-pointer transition-colors hover:bg-muted/30 group"
                onClick={() => {
                  setSelectedImage(item)
                  setImageDialogOpen(true)
                }}
              >
                <div className="overflow-hidden h-48 w-full relative bg-muted">
                  <Image
                    src={item.image_url}
                    alt={item.description || "Saved memory"}
                    className="object-cover object-top transition-transform group-hover:scale-[1.02]"
                    fill
                    loading="lazy"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description || "No description"}
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground flex items-center justify-between pt-1">
                    <span>{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                    {item.source_url && (
                      <Link
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Source
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-h-[90vh] w-full max-w-[720px] flex flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-xl sm:max-w-[720px]">
          <DialogHeader className="flex-shrink-0 border-b px-8 pt-8 pb-6">
            <div className="flex gap-4">
              <div className="flex h-13 w-1 shrink-0 self-stretch rounded-full bg-chart-1/80" aria-hidden />
              <div className="min-w-0 flex-1">
                <DialogTitle className="font-serif text-xl font-normal">Image Details</DialogTitle>
                <DialogDescription asChild>
                  {selectedImage?.source_url ? (
                    <Link
                      href={selectedImage.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-wrap items-center gap-1.5 mt-1 text-muted-foreground transition-colors hover:text-foreground text-xs"
                    >
                      <span className="break-all">{selectedImage.source_url}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    </Link>
                  ) : (
                    <span>Saved from the web</span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex flex-col">
            <div className="w-full min-h-[320px] flex-1 relative overflow-hidden bg-muted">
              <Image
                src={selectedImage?.image_url || ""}
                alt={selectedImage?.description || "Saved memory"}
                fill
                className="object-contain"
                sizes="720px"
              />
            </div>
            <div className="flex-shrink-0 border-t px-8 py-6 space-y-4 bg-muted/20">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Description</span>
                </div>
                <p className="text-[15px] leading-relaxed text-foreground/90">
                  {selectedImage?.description || "No description provided"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t bg-muted/30 px-8 py-4">
            {selectedImage?.tags && selectedImage.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedImage.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full font-medium bg-muted">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground tabular-nums">
              {selectedImage && new Date(selectedImage.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}


