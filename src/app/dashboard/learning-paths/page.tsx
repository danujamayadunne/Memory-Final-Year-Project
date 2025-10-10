"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  BookOpen, 
  Target, 
  Clock, 
  CheckCircle, 
  Circle, 
  Play,
  Plus,
  Brain,
  TrendingUp,
  Star,
  ArrowRight
} from "lucide-react"
import Link from "next/link"

type LearningPath = {
  id: string
  name: string
  description?: string
  is_public: boolean
  created_at: string
  updated_at: string
  items: LearningPathItem[]
  progress?: number
}

type LearningPathItem = {
  id: string
  order_index: number
  is_required: boolean
  summary: {
    id: string
    title?: string
    url: string
    summary: string
    difficulty_level?: string
    study_time_estimate?: number
    mastery_level?: string
  }
}

export default function LearningPathsPage() {
  const { user, loading: authLoading } = useAuth()
  const [paths, setPaths] = useState<LearningPath[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadPaths()
    }
  }, [user])

  const loadPaths = async () => {
    const supabase = createClient()
    
    const { data: pathsData } = await supabase
      .from("learning_paths")
      .select(`
        id, name, description, is_public, created_at, updated_at,
        items:learning_path_items(
          id, order_index, is_required,
          summary:web_summaries(
            id, title, url, summary, difficulty_level, 
            study_time_estimate, mastery_level
          )
        )
      `)
      .order("updated_at", { ascending: false })

    if (pathsData) {
      // Calculate progress for each path
      const pathsWithProgress = pathsData.map(path => ({
        ...path,
        progress: calculatePathProgress(path.items)
      }))
      setPaths(pathsWithProgress as LearningPath[])
    }
  }

  const calculatePathProgress = (items: any[]) => {
    if (!items || items.length === 0) return 0
    
    const completedItems = items.filter(item => 
      item.summary?.mastery_level === 'mastered' || 
      item.summary?.mastery_level === 'practicing'
    ).length
    
    return Math.round((completedItems / items.length) * 100)
  }

  const generatePersonalizedPath = async () => {
    setLoading(true)
    try {
      // Get user's recent summaries
      const supabase = createClient()
      const { data: summaries } = await supabase
        .from("web_summaries")
        .select("id, summary, title, difficulty_level, mastery_level")
        .order("created_at", { ascending: false })
        .limit(10)

      if (!summaries || summaries.length === 0) {
        alert("You need some saved content to generate a personalized learning path!")
        return
      }

      // Generate AI-powered learning path
      const res = await fetch("/api/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          summaryId: summaries[0].id, 
          type: 'path' 
        }),
      })
      
      const data = await res.json()
      
      if (data.suggestions && data.suggestions.length > 0) {
        // Create a new learning path
        const { data: newPath, error } = await supabase
          .from("learning_paths")
          .insert({
            name: "AI-Generated Learning Path",
            description: "Personalized learning path based on your knowledge base",
            user_id: user?.id
          })
          .select()
          .single()

        if (error) throw error

        // Add path items
        for (let i = 0; i < data.suggestions.length; i++) {
          const suggestion = data.suggestions[i]
          await supabase
            .from("learning_path_items")
            .insert({
              path_id: newPath.id,
              summary_id: summaries[0].id, // For now, link to first summary
              order_index: i,
              is_required: true
            })
        }

        loadPaths() // Reload paths
      }
    } catch (error) {
      console.error("Error generating learning path:", error)
    } finally {
      setLoading(false)
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

  const getMasteryColor = (level?: string) => {
    switch (level) {
      case 'mastered': return 'bg-green-100 text-green-800'
      case 'practicing': return 'bg-blue-100 text-blue-800'
      case 'learning': return 'bg-yellow-100 text-yellow-800'
      case 'not_started': return 'bg-gray-100 text-gray-800'
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
            <CardDescription>You need to be signed in to view learning paths</CardDescription>
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
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paths</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paths.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {paths.filter(path => path.progress && path.progress > 0 && path.progress < 100).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {paths.filter(path => path.progress === 100).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Learning Paths */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Learning Paths</h2>
          
          {paths.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No learning paths yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first learning path or let AI generate one based on your knowledge
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={generatePersonalizedPath} disabled={loading}>
                    <Brain className="h-4 w-4 mr-2" />
                    {loading ? "Generating..." : "Generate AI Path"}
                  </Button>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Manually
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {paths.map((path) => (
                <Card key={path.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {path.name}
                          {path.is_public && (
                            <Badge variant="secondary">Public</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {path.description || "No description provided"}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {path.progress || 0}%
                        </div>
                        <div className="text-sm text-muted-foreground">Complete</div>
                      </div>
                    </div>
                    <Progress value={path.progress || 0} className="mt-4" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{path.items?.length || 0} items</span>
                        <span>
                          {path.items?.reduce((total, item) => 
                            total + (item.summary?.study_time_estimate || 0), 0
                          ) || 0} min total
                        </span>
                      </div>
                      
                      {path.items && path.items.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Path Items:</h4>
                          <div className="space-y-2">
                            {path.items.slice(0, 3).map((item, index) => (
                              <div key={item.id} className="flex items-center gap-3 p-2 border rounded-lg">
                                <div className="flex-shrink-0">
                                  {item.summary?.mastery_level === 'mastered' ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-gray-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">
                                      {item.summary?.title || `Item ${index + 1}`}
                                    </span>
                                    {item.summary?.difficulty_level && (
                                      <Badge className={getDifficultyColor(item.summary.difficulty_level)}>
                                        {item.summary.difficulty_level}
                                      </Badge>
                                    )}
                                    {item.summary?.mastery_level && (
                                      <Badge className={getMasteryColor(item.summary.mastery_level)}>
                                        {item.summary.mastery_level}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {item.summary?.study_time_estimate || 0}m
                                    </span>
                                    <span>Step {index + 1}</span>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm">
                                  <Play className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            {path.items.length > 3 && (
                              <div className="text-center text-sm text-muted-foreground">
                                +{path.items.length - 3} more items
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" className="flex-1">
                          <Play className="h-4 w-4 mr-2" />
                          Continue Path
                        </Button>
                        <Button variant="outline" size="sm">
                          <ArrowRight className="h-4 w-4 mr-2" />
                          View Details
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
