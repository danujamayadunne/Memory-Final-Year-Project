"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  BookOpen,
  Search,
  FolderOpen,
  Brain,
  Target,
  TrendingUp,
  Clock,
  Star,
  Plus,
  ChevronRight,
  Lightbulb,
} from "lucide-react"
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

type LearningInsight = {
  id: string
  insight_type: string
  title: string
  description?: string
  data: any
  created_at: string
}

export default function KnowledgePage() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<SummaryItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [insights, setInsights] = useState<LearningInsight[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [selectedTag, setSelectedTag] = useState<string>("")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("")
  const [selectedMastery, setSelectedMastery] = useState<string>("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    const supabase = createClient()

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

    const { data: insightsData } = await supabase
      .from("learning_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)

    if (summaries) setItems(summaries as SummaryItem[])
    if (categoriesData) setCategories(categoriesData)
    if (tagsData) setTags(tagsData)
    if (insightsData) setInsights(insightsData as LearningInsight[])
  }

  const generateSuggestions = async (summaryId: string, type: 'questions' | 'gaps' | 'path') => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryId, type }),
      })
      const data = await res.json()
      return data.suggestions
    } catch (error) {
      console.error("Error generating suggestions:", error)
      return []
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm ||
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.url.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = !selectedCategory || item.category_id === selectedCategory
    const matchesTag = !selectedTag || item.tags?.some(tag => tag.id === selectedTag)
    const matchesDifficulty = !selectedDifficulty || item.difficulty_level === selectedDifficulty
    const matchesMastery = !selectedMastery || item.mastery_level === selectedMastery

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
            <CardDescription>You need to be signed in to view your knowledge base</CardDescription>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
            <p className="text-muted-foreground">
              Organize, explore, and learn from your saved content
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Content
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{items.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mastered</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {items.filter(item => item.mastery_level === 'mastered').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Study Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {items.reduce((total, item) => total + (item.study_time_estimate || 0), 0)}m
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Search your knowledge base..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex flex-wrap gap-2">
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

        {insights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Learning Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.map((insight) => (
                  <div key={insight.id} className="p-3 border rounded-lg">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium">{insight.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Your Knowledge ({filteredItems.length} items)
            </h2>
          </div>

          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No knowledge items found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || selectedCategory || selectedTag
                    ? "Try adjusting your filters"
                    : "Start by adding some content to your knowledge base"
                  }
                </p>
                <Button asChild>
                  <Link href="/dashboard">Add Content</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredItems.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold truncate">
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

                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
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
                            <Badge variant="outline" style={{ borderColor: item.category.color }}>
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
                          onClick={() => generateSuggestions(item.id, 'questions')}
                          disabled={loading}
                        >
                          <Brain className="h-4 w-4 mr-1" />
                          Questions
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateSuggestions(item.id, 'gaps')}
                          disabled={loading}
                        >
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Gaps
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateSuggestions(item.id, 'path')}
                          disabled={loading}
                        >
                          <ChevronRight className="h-4 w-4 mr-1" />
                          Path
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
