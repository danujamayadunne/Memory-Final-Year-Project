"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Tag, 
  Plus, 
  X, 
  Edit, 
  Trash2, 
  Loader2,
  Check
} from "lucide-react"

type Tag = {
  id: string
  name: string
  color: string
  created_at: string
}

type TagManagerProps = {
  summaryId: string
  currentTags: Tag[]
  onTagsUpdate: (tags: Tag[]) => void
  suggestedTags?: string[]
}

const TAG_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Orange", value: "#f59e0b" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Yellow", value: "#eab308" },
  { name: "Gray", value: "#6b7280" },
]

export function TagManager({ summaryId, currentTags, onTagsUpdate, suggestedTags = [] }: TagManagerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].value)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadAllTags()
  }, [])

  const loadAllTags = async () => {
    setLoading(true)
    const supabase = createClient()
    try {
      const { data } = await supabase
        .from("tags")
        .select("*")
        .order("name")
      
      if (data) setAllTags(data)
    } catch (error) {
      console.error("Error loading tags:", error)
    } finally {
      setLoading(false)
    }
  }

  const createTag = async () => {
    if (!newTagName.trim() || creating) return

    setCreating(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from("tags")
        .insert({
          name: newTagName.trim(),
          color: newTagColor
        })
        .select()
        .single()

      if (error) throw error

      setAllTags(prev => [...prev, data])
      setNewTagName("")
      setNewTagColor(TAG_COLORS[0].value)
    } catch (error) {
      console.error("Error creating tag:", error)
    } finally {
      setCreating(false)
    }
  }

  const addTagToSummary = async (tagId: string) => {
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from("summary_tags")
        .insert({
          summary_id: summaryId,
          tag_id: tagId
        })

      if (error) throw error

      const tag = allTags.find(t => t.id === tagId)
      if (tag) {
        onTagsUpdate([...currentTags, tag])
      }
    } catch (error) {
      console.error("Error adding tag to summary:", error)
    }
  }

  const removeTagFromSummary = async (tagId: string) => {
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from("summary_tags")
        .delete()
        .eq("summary_id", summaryId)
        .eq("tag_id", tagId)

      if (error) throw error

      onTagsUpdate(currentTags.filter(t => t.id !== tagId))
    } catch (error) {
      console.error("Error removing tag from summary:", error)
    }
  }

  const addSuggestedTag = async (tagName: string) => {
    // Check if tag already exists
    let existingTag = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase())
    
    if (!existingTag) {
      // Create new tag
      setCreating(true)
      const supabase = createClient()
      try {
        const { data, error } = await supabase
          .from("tags")
          .insert({
            name: tagName,
            color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)].value
          })
          .select()
          .single()

        if (error) throw error
        existingTag = data
        setAllTags(prev => [...prev, data])
      } catch (error) {
        console.error("Error creating suggested tag:", error)
        return
      } finally {
        setCreating(false)
      }
    }

    // Add to summary
    if (existingTag) {
      await addTagToSummary(existingTag.id)
    }
  }

  const availableTags = allTags.filter(tag => 
    !currentTags.some(currentTag => currentTag.id === tag.id)
  )

  return (
    <div className="space-y-4">
      {/* Current Tags */}
      <div>
        <h4 className="text-sm font-medium mb-2 tracking-tight">Current Tags</h4>
        <div className="flex flex-wrap gap-2">
          {currentTags.map(tag => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="flex items-center gap-1"
              style={{ backgroundColor: tag.color + '20', borderColor: tag.color }}
            >
              {tag.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeTagFromSummary(tag.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          {currentTags.length === 0 && (
            <p className="text-sm text-muted-foreground">No tags assigned</p>
          )}
        </div>
      </div>

      {/* Suggested Tags */}
      {suggestedTags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 tracking-tight">Suggested Tags</h4>
          <div className="flex flex-wrap gap-2">
            {suggestedTags.map((tagName, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => addSuggestedTag(tagName)}
                disabled={creating}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                {tagName}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Add Existing Tags */}
      <div>
        <h4 className="text-sm font-medium mb-2 tracking-tight">Add Existing Tags</h4>
        <div className="flex flex-wrap gap-2">
          {availableTags.map(tag => (
            <Button
              key={tag.id}
              variant="outline"
              size="sm"
              onClick={() => addTagToSummary(tag.id)}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              {tag.name}
            </Button>
          ))}
          {availableTags.length === 0 && (
            <p className="text-sm text-muted-foreground">No available tags</p>
          )}
        </div>
      </div>

      {/* Create New Tag */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create New Tag
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>
              Create a new tag to organize your content
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tag Name</label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter tag name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <Select value={newTagColor} onValueChange={setNewTagColor}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAG_COLORS.map(color => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: color.value }}
                        />
                        {color.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={createTag} 
                disabled={!newTagName.trim() || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
