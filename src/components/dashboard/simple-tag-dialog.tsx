"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tag, Plus, X, Loader2 } from "lucide-react"

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
  const supabase = createClient()
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadAllTags()
    }
  }, [isOpen])

  const loadAllTags = async () => {
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
      summaries?.forEach((summary: any) => {
        if (summary.tags && Array.isArray(summary.tags)) {
          summary.tags.forEach((tag: any) => {
            if (tag.id && tag.name && !tagsMap.has(tag.id)) {
              tagsMap.set(tag.id, { id: tag.id, name: tag.name, color: tag.color || '#6b7280' })
            }
          })
        }
      })
      setAllTags(Array.from(tagsMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
    }
    setLoading(false)
  }

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
    } catch (e: any) {
      console.error("Error creating tag:", e)
      setError(`Error: ${e.message || "Failed to create tag"}`)
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
    } catch (e: any) {
      console.error("Error removing tag:", e)
      setError(`Error: ${e.message || "Failed to remove tag"}`)
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
    } catch (e: any) {
      console.error("Error linking tag:", e)
      setError(`Error: ${e.message || "Failed to link tag"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md shadow-none rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Manage Tags
          </DialogTitle>
          <DialogDescription>
            Add or remove tags to organize your summaries
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Current Tags</h4>
            <div className="flex flex-wrap gap-2">
              {currentTags.length === 0 ? (
                <span className="text-sm text-muted-foreground">No tags assigned</span>
              ) : (
                currentTags.map(tag => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                    style={{ backgroundColor: tag.color + '20', borderColor: tag.color }}
                  >
                    {tag.name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleRemoveTag(tag.id)}
                      disabled={loading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Add New Tag</h4>
            <div className="flex gap-2">
              <Input
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleCreateTag()
                }}
                disabled={loading}
                className="flex-1"
              />
              <Button
                onClick={handleCreateTag}
                disabled={loading || !newTagName.trim()}
                size="sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {allTags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Available Tags</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {allTags
                  .filter(tag => !currentTags.some(t => t.id === tag.id))
                  .map(tag => (
                    <Button
                      key={tag.id}
                      variant="ghost"
                      className="w-full justify-start h-8 text-sm"
                      onClick={() => handleAddExistingTag(tag)}
                      disabled={loading}
                    >
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </Button>
                  ))
                }
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose} variant="outline">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
