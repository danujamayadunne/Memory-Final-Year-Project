"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tag, Plus, X, Loader } from "lucide-react"

type Tag = {
  id: string
  name: string
  color: string
}

type SimpleTagDialogProps = {
  summaryId: string
  currentTags: Tag[]
  onTagsUpdate: (tags: Tag[]) => void
  isOpen: boolean
  onClose: () => void
}

const getRandomColor = () => {
  const colors = [
    "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
    "#ec4899", "#6366f1", "#14b8a6", "#eab308", "#6b7280"
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

export function SimpleTagDialog({
  summaryId,
  currentTags,
  onTagsUpdate,
  isOpen,
  onClose
}: SimpleTagDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAllTags = useCallback(async () => {
    setLoading(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setError("You must be logged in to view tags")
      setLoading(false)
      return
    }

    const { data: summaries, error } = await supabase
      .from("web_summaries")
      .select("tags")
      .eq("user_id", user.id)

    if (error) {
      console.error("Error loading tags:", error)
      setError("Failed to load tags")
    } else {
      const tagsMap = new Map<string, Tag>()
      summaries?.forEach((summary) => {
        if (summary.tags && Array.isArray(summary.tags)) {
          summary.tags.forEach((tag: unknown) => {
            if (
              typeof tag === "object" &&
              tag !== null &&
              "id" in tag &&
              "name" in tag &&
              typeof (tag as { id: unknown }).id === "string" &&
              typeof (tag as { name: unknown }).name === "string"
            ) {
              const t = tag as { id: string; name: string; color?: string }
              if (!tagsMap.has(t.id)) {
                tagsMap.set(t.id, { id: t.id, name: t.name, color: t.color || '#6b7280' })
              }
            }
          })
        }
      })
      setAllTags(Array.from(tagsMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (isOpen) {
      void loadAllTags()
    }
  }, [isOpen, loadAllTags])

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    setLoading(true)
    setError(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error("You must be logged in to create tags")
      }

      const trimmedName = newTagName.trim().toLowerCase()

      let tagToAdd: Tag | null = null
      const existingTag = allTags.find(t => t.name.toLowerCase() === trimmedName)

      if (existingTag) {
        tagToAdd = existingTag
      } else {
        tagToAdd = {
          id: crypto.randomUUID(),
          name: newTagName.trim(),
          color: getRandomColor()
        }
        setAllTags(prev => [...prev, tagToAdd!].sort((a, b) => a.name.localeCompare(b.name)))
      }

      if (tagToAdd) {
        const isAlreadyLinked = currentTags.some(t => t.id === tagToAdd!.id)
        if (!isAlreadyLinked) {
          const updatedTags = [...currentTags, tagToAdd]
          const { error: updateError } = await supabase
            .from("web_summaries")
            .update({ tags: updatedTags })
            .eq("id", summaryId)
            .eq("user_id", user.id)

          if (updateError) throw updateError
          onTagsUpdate(updatedTags)
        }
      }
      setNewTagName("")
    } catch (e: unknown) {
      console.error("Error creating tag:", e)
      setError(`Error: ${e instanceof Error ? e.message : "Failed to create tag"}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error("You must be logged in to remove tags")
      }

      const updatedTags = currentTags.filter(tag => tag.id !== tagId)
      const { error: updateError } = await supabase
        .from("web_summaries")
        .update({ tags: updatedTags })
        .eq("id", summaryId)
        .eq("user_id", user.id)

      if (updateError) throw updateError

      onTagsUpdate(updatedTags)
    } catch (e: unknown) {
      console.error("Error removing tag:", e)
      setError(`Error: ${e instanceof Error ? e.message : "Failed to remove tag"}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddExistingTag = async (tag: Tag) => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error("You must be logged in to add tags")
      }

      const isAlreadyLinked = currentTags.some(t => t.id === tag.id)
      if (!isAlreadyLinked) {
        const updatedTags = [...currentTags, tag]
        const { error: updateError } = await supabase
          .from("web_summaries")
          .update({ tags: updatedTags })
          .eq("id", summaryId)
          .eq("user_id", user.id)

        if (updateError) throw updateError
        onTagsUpdate(updatedTags)
      }
    } catch (e: unknown) {
      console.error("Error linking tag:", e)
      setError(`Error: ${e instanceof Error ? e.message : "Failed to link tag"}`)
    } finally {
      setLoading(false)
    }
  }

  const availableTags = allTags.filter(tag => !currentTags.some(t => t.id === tag.id))

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-full max-w-[400px] flex flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-xl sm:max-w-[400px]">
        <DialogHeader className="flex-shrink-0 border-b px-6 pt-6 pb-5">
          <div className="flex gap-4">
            <div className="flex h-13 w-1 shrink-0 self-stretch rounded-full bg-chart-1/80" aria-hidden />
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-serif text-lg font-normal">Manage Tags</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Add or remove tags to organize your summaries</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Current</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentTags.length === 0 ? (
                <span className="text-sm text-muted-foreground">No tags assigned</span>
              ) : (
                currentTags.map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium group"
                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      disabled={loading}
                      className="opacity-60 hover:opacity-100 transition-opacity disabled:opacity-40"
                      aria-label={`Remove ${tag.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Add New</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleCreateTag()
                  }
                }}
                disabled={loading}
                className="flex-1 h-10 border shadow-none bg-muted/50 rounded-lg focus-visible:bg-muted/70"
              />
              <Button
                onClick={handleCreateTag}
                disabled={loading || !newTagName.trim()}
                size="sm"
                className="h-10 px-3 rounded-lg shrink-0"
              >
                {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {availableTags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Available</span>
              </div>
              <div className="max-h-32 overflow-y-auto rounded-lg border divide-y">
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                    onClick={() => handleAddExistingTag(tag)}
                    disabled={loading}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t px-6 py-4 bg-muted/20">
          <Button onClick={onClose} variant="outline" size="sm" className="w-full rounded-lg">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}