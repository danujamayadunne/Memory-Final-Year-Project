"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
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
import { ExternalLink, Image as ImageIcon, Loader2, Search, Sparkles } from "lucide-react"
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
  const { user, loading: authLoading } = useAuth()
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/5">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>You are signed out</CardTitle>
            <CardDescription>
              Sign in to view your saved images.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/auth/signup">Create Account</Link>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 tracking-tight">
              <Search className="h-5 w-5" />
              Search & Filter
            </CardTitle>
            <CardDescription className="tracking-tight">
              {useSemanticSearch ? "Semantic search powered by AI" : "Text-based keyword search"}. Filter by tags.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="flex-1 relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search descriptions or tags..."
                  className="pl-10 tracking-tight"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-48">
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger className="w-full text-muted-foreground">
                    <SelectValue placeholder="All tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  id="semantic-search-images"
                  checked={useSemanticSearch}
                  onCheckedChange={setUseSemanticSearch}
                />
                <Label
                  htmlFor="semantic-search-images"
                  className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Semantic Search
                </Label>
              </div>
              {searchTerm.trim() && (
                <span className="text-xs text-muted-foreground">
                  {searching ? "Searching..." : `${filteredItems.length} result${filteredItems.length !== 1 ? "s" : ""}`}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">
            Your Images ({filteredItems.length} items)
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
              <Card key={idx} className="overflow-hidden pt-0">
                <Skeleton className="h-64 w-full" />
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : searching && searchTerm.trim() ? (
          <Card className="py-16 text-center">
            <CardContent className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <h3 className="text-lg font-semibold tracking-tight">
                Searching images...
              </h3>
              <p className="text-sm text-muted-foreground tracking-tight max-w-md">
                {useSemanticSearch
                  ? "Looking for semantically similar memories."
                  : "Searching by keyword..."}
              </p>
            </CardContent>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card className="border-dashed text-center py-16">
            <CardContent className="space-y-3">
              <ImageIcon className="h-9 w-9 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold tracking-tight">
                No images yet
              </h3>
              <p className="text-sm text-muted-foreground tracking-tight max-w-xs mx-auto">
                Use the Memory browser extension to right-click any image and
                save it directly to this gallery.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className="overflow-hidden flex flex-col cursor-pointer pt-0"
                onClick={() => {
                  setSelectedImage(item)
                  setImageDialogOpen(true)
                }}
              >
                <div className="overflow-hidden h-64 w-full relative">
                  <Image
                    src={item.image_url}
                    alt={item.description || "Saved memory"}
                    className="object-cover object-top"
                    fill
                    loading="lazy"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>
                <CardContent className="flex-1 flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground tracking-tight line-clamp-3">
                    {item.description || "No description provided"}
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                    {item.source_url && (
                      <Link
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View source
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-4xl w-full rounded-2xl bg-background/5 backdrop-blur-lg border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>
              Image Details
            </DialogTitle>
            <DialogDescription>
              {selectedImage?.source_url ? (
                <Link
                  href={selectedImage.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <span className="text-sm truncate max-w-[300px] text-muted-foreground">{selectedImage.source_url || "Saved from the web"}</span>
                  {selectedImage.source_url && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                </Link>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="w-full h-[300px] relative rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <Image
                  src={selectedImage?.image_url || ""}
                  alt={selectedImage?.description || "Saved memory"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Description
                </h4>
                <p className="text-sm text-foreground mt-1">
                  {selectedImage?.description || "No description provided"}
                </p>
              </div>
              {selectedImage?.tags && selectedImage.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedImage.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Saved on {selectedImage && new Date(selectedImage.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}


