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
  BookOpen, 
  Search, 
  Tag, 
  FolderOpen, 
  Brain, 
  Target,
  TrendingUp,
  Clock,
  Star,
  ChevronRight,
  ExternalLink,
  Trash2,
} from "lucide-react"
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

type Category = {
  id: string
  name: string
  description?: string
  color: string
}

type Tag = {
  id: string
  name: string
  color: string
}

export default function SummariesPage() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<SummaryItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [selectedTag, setSelectedTag] = useState<string>("")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("")
  const [selectedMastery, setSelectedMastery] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SummaryItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatType, setChatType] = useState<'questions' | 'gaps' | 'path' | 'general'>('general')

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()
    
    try {

      const { data: summaries } = await supabase
        .from("web_summaries")
        .select(`
          id, url, summary, title, created_at, category_id, difficulty_level, 
          mastery_level, study_time_estimate, last_reviewed_at, review_count,
          tags:summary_tags(tag:tags(id, name, color)),
          category:categories(id, name, color)
        `)
        .order("created_at", { ascending: false })

      const { data: categoriesData } = await supabase
        .from("categories")
        .select("*")
        .order("name")

      const { data: tagsData } = await supabase
        .from("tags")
        .select("*")
        .order("name")

      if (summaries) setItems(summaries as SummaryItem[])
      if (categoriesData) setCategories(categoriesData)
      if (tagsData) setTags(tagsData)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (summary: SummaryItem, type: 'questions' | 'gaps' | 'path') => {
    setSelectedItem(summary)
    setChatType(type)
    setChatOpen(true)
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

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm ||
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.url.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = !selectedCategory || selectedCategory === "all" || item.category_id === selectedCategory
    const matchesTag = !selectedTag || selectedTag === "all" || item.tags?.some(tag => tag.id === selectedTag)
    const matchesDifficulty = !selectedDifficulty || selectedDifficulty === "all" || item.difficulty_level === selectedDifficulty
    const matchesMastery = !selectedMastery || selectedMastery === "all" || item.mastery_level === selectedMastery

    return matchesSearch && matchesCategory && matchesTag && matchesDifficulty && matchesMastery
  })

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

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-tight">Total Summaries</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{items.length}</div>
              <p className="text-xs text-muted-foreground tracking-tight">
                Web pages and videos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-tight">Categories</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{categories.length}</div>
              <p className="text-xs text-muted-foreground tracking-tight">
                Organized topics
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-tight">Mastered</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">
                {items.filter(item => item.mastery_level === 'mastered').length}
              </div>
              <p className="text-xs text-muted-foreground tracking-tight">
                Fully learned
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tracking-tight">Study Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">
                {Math.round(items.reduce((total, item) => total + (item.study_time_estimate || 0), 0) / 60)}h
              </div>
              <p className="text-xs text-muted-foreground tracking-tight">
                Total time
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 tracking-tight">
              <Search className="h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Search your summaries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 tracking-tight"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {tags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Difficulties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Difficulties</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={selectedMastery} onValueChange={setSelectedMastery}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Mastery Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mastery Levels</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="learning">Learning</SelectItem>
                  <SelectItem value="practicing">Practicing</SelectItem>
                  <SelectItem value="mastered">Mastered</SelectItem>
                </SelectContent>
              </Select>
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
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-20 w-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2 tracking-tight">No summaries found</h3>
                <p className="text-muted-foreground mb-4 tracking-tight">
                  {searchTerm || selectedCategory || selectedTag 
                    ? "Try adjusting your filters" 
                    : "Start by adding some content to your knowledge base"
                  }
                </p>
                <Button asChild>
                  <Link href="/dashboard">Add Summary</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredItems.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                  setSelectedItem(item)
                  setShowModal(true)
                }}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold truncate tracking-tight">
                            {item.title || item.url}
                          </h3>
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
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-3 tracking-tight">
                          {item.summary}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.study_time_estimate ? `${item.study_time_estimate}m` : 'No estimate'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {item.review_count || 0} reviews
                          </span>
                          {item.last_reviewed_at && (
                            <span>
                              Last reviewed: {new Date(item.last_reviewed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {item.category && (
                            <Badge key={item.category.id} variant="outline" style={{ borderColor: item.category.color }}>
                              {item.category.name}
                            </Badge>
                          )}
                          {item.tags?.map(tag => (
                            <Badge key={tag.id} variant="secondary" style={{ backgroundColor: tag.color + '20' }}>
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
                            handleSuggestionClick(item, 'gaps')
                          }}
                        >
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Gaps
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSuggestionClick(item, 'path')
                          }}
                        >
                          <ChevronRight className="h-4 w-4 mr-1" />
                          Path
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {showModal && selectedItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="tracking-tight">{selectedItem.title || selectedItem.url}</CardTitle>
                  <CardDescription className="tracking-tight">
                    <a 
                      href={selectedItem.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {selectedItem.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setShowModal(false)}>
                  ×
                </Button>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {selectedItem.difficulty_level && (
                      <Badge className={getDifficultyColor(selectedItem.difficulty_level)}>
                        {selectedItem.difficulty_level}
                      </Badge>
                    )}
                    {selectedItem.mastery_level && (
                      <Badge className={getMasteryColor(selectedItem.mastery_level)}>
                        {selectedItem.mastery_level}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="prose max-w-none">
                    <h4 className="font-semibold mb-2 tracking-tight">Summary:</h4>
                    <p className="whitespace-pre-wrap tracking-tight leading-relaxed">
                      {selectedItem.summary}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {selectedItem.study_time_estimate ? `${selectedItem.study_time_estimate}m` : 'No estimate'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      {selectedItem.review_count || 0} reviews
                    </span>
                    <span>
                      Created: {new Date(selectedItem.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
