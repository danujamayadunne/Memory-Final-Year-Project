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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Plus, 
  BookOpen, 
  Clock, 
  ExternalLink, 
  Trash2,
  Tag,
  Loader2,
  Eye,
  Target,
  TrendingUp,
  Brain,
  ChevronRight
} from "lucide-react"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SimpleTagDialog } from "@/components/dashboard/simple-tag-dialog"
import { ChatSheet } from "@/components/dashboard/chat-sheet"
import Link from "next/link"

type SummaryItem = {
  id: string
  url: string
  summary: string
  title?: string
  created_at: string
  category_id?: string
  difficulty_level?: string
  mastery_level?: string
  study_time_estimate?: number
  last_reviewed_at?: string
  review_count?: number
  tags?: Array<{ id: string; name: string; color: string }>
  category?: { id: string; name: string; color: string }
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SummaryItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatType, setChatType] = useState<'questions' | 'gaps' | 'path' | 'general'>('general')

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
    }
  }, [user])

  const loadItems = async () => {
    setLoading(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from("web_summaries")
        .select(`
          id, url, summary, title, created_at, category_id, difficulty_level, 
          mastery_level, study_time_estimate, last_reviewed_at, review_count,
          tags:summary_tags(tag:tags(id, name, color)),
          category:categories(id, name, color)
        `)
        .order("created_at", { ascending: false })
        .limit(5) // Show only recent 5 items on dashboard
      
      if (!error && data) {
        const transformedData = data.map(item => ({
          ...item,
          tags: item.tags?.map((t: any) => t.tag) || [],
          category: item.category?.[0] || null
        }))
        setItems(transformedData as SummaryItem[])
      }
    } catch (error) {
      console.error("Error loading items:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadTags = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("tags")
      .select("*")
      .order("name")
    if (data) setTags(data)
  }

  const generateAndAddTags = async (summaryItem: SummaryItem) => {
    try {
      const res = await fetch("/api/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          summaryId: "temp", 
          type: 'tags',
          content: summaryItem.summary 
        }),
      })
      const data = await res.json()
      
      if (data.suggestions && Array.isArray(data.suggestions)) {
        const supabase = createClient()
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          console.error("User not authenticated for tag creation")
          return
        }
        
        const addedTags: Array<{ id: string; name: string; color: string }> = []
        
        for (const tagName of data.suggestions) {
          try {
            // Check if tag already exists for this user
            const { data: existingTag } = await supabase
              .from("tags")
              .select("id")
              .eq("name", tagName)
              .eq("user_id", user.id)
              .single()
            
            let tagId = existingTag?.id
            
            if (!tagId) {
              // Create new tag with user_id
              const { data: newTag, error: createError } = await supabase
                .from("tags")
                .insert({
                  name: tagName,
                  color: getRandomColor(),
                  user_id: user.id
                })
                .select()
                .single()
              
              if (createError) {
                console.error("Error creating tag:", createError)
                continue
              }
              tagId = newTag.id
            }
            
            // Add tag to summary
            const { error: linkError } = await supabase
              .from("summary_tags")
              .insert({
                summary_id: summaryItem.id,
                tag_id: tagId
              })
            
            if (!linkError) {
              addedTags.push({
                id: tagId,
                name: tagName,
                color: getRandomColor()
              })
            }
          } catch (error) {
            console.error("Error processing tag:", tagName, error)
          }
        }
        
        // Update the summary item with added tags
        setItems(prev => prev.map(item => 
          item.id === summaryItem.id 
            ? { ...item, tags: addedTags }
            : item
        ))
      }
    } catch (error) {
      console.error("Error generating and adding tags:", error)
    }
  }

  const getRandomColor = () => {
    const colors = [
      "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", 
      "#ec4899", "#6366f1", "#14b8a6", "#eab308", "#6b7280"
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  const handleAdd = async () => {
    if (!isValidUrl(url)) {
      setError("Please enter a valid URL")
      return
    }
    setError(null)
    setLoading(true)
    setIsAdding(true)
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to summarize")
      const newItem = json.item as SummaryItem
      setItems((prev) => [newItem, ...prev])
      setUrl("")
      
      await generateAndAddTags(newItem)
    } catch (e: any) {
      setError(e?.message || "Something went wrong")
    } finally {
      setLoading(false)
      setIsAdding(false)
    }
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

  const handleSuggestionClick = (summary: SummaryItem, type: 'questions' | 'gaps' | 'path') => {
    setSelectedItem(summary)
    setChatType(type)
    setChatOpen(true)
  }

  const getMasteryColor = (level?: string) => {
    switch (level) {
      case 'mastered': return 'bg-green-100 text-green-800'
      case 'practicing': return 'bg-blue-100 text-blue-800'
      case 'learning': return 'bg-yellow-100 text-yellow-800'
      case 'not_started': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDifficultyColor = (level?: string) => {
    switch (level) {
      case 'advanced': return 'bg-red-100 text-red-800'
      case 'intermediate': return 'bg-orange-100 text-orange-800'
      case 'beginner': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
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
  
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 tracking-tight">
              <Plus className="h-5 w-5" />
              Add New Summary
            </CardTitle>
            <CardDescription className="tracking-tight">
              Paste a URL to summarize web content or YouTube videos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com or https://youtube.com/watch?v=..."
                className="flex-1 tracking-tight"
                disabled={isAdding}
              />
              <Button 
                onClick={handleAdd} 
                disabled={loading || !isValidUrl(url) || isAdding}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
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

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-tight">Total Summaries</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{items.length}</div>
              <p className="text-xs text-muted-foreground tracking-tight">
                Web pages and videos summarized
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-tight">YouTube Videos</CardTitle>
              <Badge variant="secondary" className="tracking-tight">Video</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">
                {items.filter(item => 
                  item.url.includes('youtube.com') || item.url.includes('youtu.be')
                ).length}
              </div>
              <p className="text-xs text-muted-foreground tracking-tight">
                YouTube videos summarized
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-tight">Mastered</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">
                {items.filter(item => item.mastery_level === 'mastered').length}
              </div>
              <p className="text-xs text-muted-foreground tracking-tight">
                Fully learned items
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Summaries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="tracking-tight">Recent Summaries</CardTitle>
                <CardDescription className="tracking-tight">
                  Your latest web content summaries
                </CardDescription>
              </div>
              <Button variant="outline" asChild>
                <Link href="/dashboard/summaries">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
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
                {items.slice(0, 3).map((item) => (
                  <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                    setSelectedItem(item)
                    setShowModal(true)
                  }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline truncate tracking-tight"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.title || item.url}
                          </a>
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          {(item.url.includes('youtube.com') || item.url.includes('youtu.be')) && (
                            <Badge variant="secondary" className="text-xs tracking-tight">YouTube</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2 tracking-tight">
                          {item.summary}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {item.difficulty_level && (
                            <Badge className={getDifficultyColor(item.difficulty_level)}>
                              {item.difficulty_level}
                            </Badge>
                          )}
                          {item.mastery_level && (
                            <Badge className={getMasteryColor(item.mastery_level)}>
                              {item.mastery_level}
                            </Badge>
                          )}
                          {item.tags?.map(tag => (
                            <Badge key={tag.id} variant="outline" style={{ borderColor: tag.color }}>
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSuggestionClick(item, 'questions')
                          }}
                        >
                          <Brain className="h-4 w-4 mr-1" />
                          Questions
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedItem(item)
                            setShowTagDialog(true)
                          }}
                        >
                          <Tag className="h-4 w-4" />
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
                ))}
                {items.length > 3 && (
                  <div className="text-center pt-4">
                    <Button variant="outline" asChild>
                      <Link href="/dashboard/summaries">View All Summaries</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Detail Dialog */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {selectedItem?.title || selectedItem?.url}
              </DialogTitle>
              <DialogDescription>
                <a 
                  href={selectedItem?.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {selectedItem?.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Metadata */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedItem?.difficulty_level && (
                  <Badge className={getDifficultyColor(selectedItem.difficulty_level)}>
                    {selectedItem.difficulty_level}
                  </Badge>
                )}
                {selectedItem?.mastery_level && (
                  <Badge className={getMasteryColor(selectedItem.mastery_level)}>
                    {selectedItem.mastery_level}
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {selectedItem?.study_time_estimate ? `${selectedItem.study_time_estimate}m` : 'No estimate'}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {selectedItem?.review_count || 0} reviews
                </Badge>
              </div>
              
              {/* Summary */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold tracking-tight">Summary</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                    {selectedItem?.summary}
                  </p>
                </div>
              </div>
              
              {/* Tags */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold tracking-tight">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedItem?.tags && selectedItem.tags.length > 0 ? (
                    selectedItem.tags.map(tag => (
                      <Badge 
                        key={tag.id} 
                        variant="secondary" 
                        style={{ 
                          backgroundColor: tag.color + '15', 
                          borderColor: tag.color,
                          color: tag.color
                        }}
                        className="px-3 py-1 font-medium"
                      >
                        {tag.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">No tags assigned</span>
                  )}
                </div>
              </div>
            </div>
              
            {/* Footer */}
            <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t mt-4">
              <div className="text-sm text-muted-foreground">
                Created: {selectedItem && new Date(selectedItem.created_at).toLocaleString()}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowModal(false)
                    setShowTagDialog(true)
                  }}
                >
                  <Tag className="h-4 w-4 mr-1" />
                  Manage Tags
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedItem) {
                      handleSuggestionClick(selectedItem, 'questions')
                      setShowModal(false)
                    }
                  }}
                >
                  <Brain className="h-4 w-4 mr-1" />
                  Ask Questions
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Tag Management Dialog */}
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

        {/* Chat Sheet */}
        <ChatSheet
          summary={selectedItem}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          chatType={chatType}
        />

      </div>
    </DashboardLayout>
  )
}