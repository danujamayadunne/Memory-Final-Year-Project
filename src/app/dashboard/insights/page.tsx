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
  TrendingUp, 
  Brain, 
  Target, 
  Clock, 
  Star,
  BookOpen,
  Lightbulb,
  Zap,
  Award,
  Calendar,
} from "lucide-react"

type LearningInsight = {
  id: string
  insight_type: string
  title: string
  description?: string
  data: any
  created_at: string
}

type LearningStats = {
  totalSummaries: number
  totalStudyTime: number
  masteryDistribution: {
    not_started: number
    learning: number
    practicing: number
    mastered: number
  }
  difficultyDistribution: {
    beginner: number
    intermediate: number
    advanced: number
  }
  weeklyProgress: Array<{
    week: string
    summaries: number
    studyTime: number
  }>
  topCategories: Array<{
    name: string
    count: number
    color: string
  }>
  learningStreak: number
  averageStudyTime: number
}

export default function InsightsPage() {
  const { user, loading: authLoading } = useAuth()
  const [insights, setInsights] = useState<LearningInsight[]>([])
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadInsights()
      loadStats()
    }
  }, [user])

  const loadInsights = async () => {
    const supabase = createClient()
    
    const { data: insightsData } = await supabase
      .from("learning_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)

    if (insightsData) {
      setInsights(insightsData as LearningInsight[])
    }
  }

  const loadStats = async () => {
    const supabase = createClient()
    
    const { data: summaries } = await supabase
      .from("web_summaries")
      .select(`
        id, created_at, mastery_level, difficulty_level, 
        study_time_estimate, category_id,
        category:categories(name, color)
      `)

    if (!summaries) return

    // Calculate stats
    const totalSummaries = summaries.length
    const totalStudyTime = summaries.reduce((total, s) => total + (s.study_time_estimate || 0), 0)
    
    const masteryDistribution = summaries.reduce((acc, s) => {
      const level = s.mastery_level || 'not_started'
      acc[level] = (acc[level] || 0) + 1
      return acc
    }, {} as any)

    const difficultyDistribution = summaries.reduce((acc, s) => {
      const level = s.difficulty_level || 'beginner'
      acc[level] = (acc[level] || 0) + 1
      return acc
    }, {} as any)

    // Calculate weekly progress (last 8 weeks)
    const weeklyProgress = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (i * 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      const weekSummaries = summaries.filter(s => {
        const date = new Date(s.created_at)
        return date >= weekStart && date <= weekEnd
      })
      
      weeklyProgress.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        summaries: weekSummaries.length,
        studyTime: weekSummaries.reduce((total, s) => total + (s.study_time_estimate || 0), 0)
      })
    }

    // Top categories
    const categoryCounts = summaries.reduce((acc, s) => {
      if (s.category) {
        const name = s.category.name
        acc[name] = (acc[name] || 0) + 1
      }
      return acc
    }, {} as any)

    const topCategories = Object.entries(categoryCounts)
      .map(([name, count]) => ({
        name,
        count: count as number,
        color: summaries.find(s => s.category?.name === name)?.category?.color || '#3b82f6'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Calculate learning streak (consecutive days with at least one summary)
    const dates = summaries.map(s => new Date(s.created_at).toDateString()).sort()
    let streak = 0
    let currentDate = new Date()
    currentDate.setDate(currentDate.getDate() - 1) // Start from yesterday
    
    while (dates.includes(currentDate.toDateString())) {
      streak++
      currentDate.setDate(currentDate.getDate() - 1)
    }

    setStats({
      totalSummaries,
      totalStudyTime,
      masteryDistribution,
      difficultyDistribution,
      weeklyProgress,
      topCategories,
      learningStreak: streak,
      averageStudyTime: totalSummaries > 0 ? Math.round(totalStudyTime / totalSummaries) : 0
    })
  }

  const generateInsights = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      
      // Get recent summaries for analysis
      const { data: summaries } = await supabase
        .from("web_summaries")
        .select("id, summary, title, mastery_level, difficulty_level")
        .order("created_at", { ascending: false })
        .limit(5)

      if (!summaries || summaries.length === 0) {
        alert("You need some saved content to generate insights!")
        return
      }

      // Generate AI insights
      const res = await fetch("/api/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          summaryId: summaries[0].id, 
          type: 'insights' 
        }),
      })
      
      const data = await res.json()
      
      if (data.suggestions && data.suggestions.length > 0) {
        // Save insights to database
        for (const insight of data.suggestions) {
          if (insight.type && insight.title) {
            await supabase
              .from("learning_insights")
              .insert({
                user_id: user?.id,
                insight_type: insight.type,
                title: insight.title,
                description: insight.description,
                data: insight
              })
          }
        }
        
        loadInsights() // Reload insights
      }
    } catch (error) {
      console.error("Error generating insights:", error)
    } finally {
      setLoading(false)
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
            <CardDescription>You need to be signed in to view insights</CardDescription>
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

        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Knowledge</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalSummaries}</div>
                <p className="text-xs text-muted-foreground">items saved</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Study Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(stats.totalStudyTime / 60)}h</div>
                <p className="text-xs text-muted-foreground">total time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Learning Streak</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.learningStreak}</div>
                <p className="text-xs text-muted-foreground">days in a row</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Study Time</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.averageStudyTime}m</div>
                <p className="text-xs text-muted-foreground">per item</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mastery Distribution */}
        {stats && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Mastery Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(stats.masteryDistribution).map(([level, count]) => {
                    const percentage = stats.totalSummaries > 0 ? (count as number / stats.totalSummaries) * 100 : 0
                    return (
                      <div key={level} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{level.replace('_', ' ')}</span>
                          <span>{count} ({Math.round(percentage)}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Difficulty Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(stats.difficultyDistribution).map(([level, count]) => {
                    const percentage = stats.totalSummaries > 0 ? (count as number / stats.totalSummaries) * 100 : 0
                    const color = level === 'beginner' ? 'bg-green-500' : 
                                 level === 'intermediate' ? 'bg-orange-500' : 'bg-red-500'
                    return (
                      <div key={level} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{level}</span>
                          <span>{count} ({Math.round(percentage)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${color}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Weekly Progress */}
        {stats && stats.weeklyProgress.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-8 gap-2">
                  {stats.weeklyProgress.map((week, index) => (
                    <div key={index} className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">{week.week}</div>
                      <div className="h-16 bg-gray-100 rounded flex flex-col justify-end">
                        <div 
                          className="bg-primary rounded-t"
                          style={{ height: `${Math.max(week.summaries * 10, 4)}px` }}
                        ></div>
                      </div>
                      <div className="text-xs mt-1">{week.summaries}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Categories */}
        {stats && stats.topCategories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Top Learning Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topCategories.map((category, index) => (
                  <div key={category.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }}></div>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <Badge variant="secondary">{category.count} items</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              AI Learning Insights
            </CardTitle>
            <CardDescription>
              Personalized recommendations based on your learning patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insights.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No insights yet</h3>
                <p className="text-muted-foreground mb-4">
                  Generate AI-powered insights to discover patterns in your learning
                </p>
                <Button onClick={generateInsights} disabled={loading}>
                  <Brain className="h-4 w-4 mr-2" />
                  {loading ? "Analyzing..." : "Generate Insights"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {insights.map((insight) => (
                  <div key={insight.id} className="p-4 border rounded-lg">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium">{insight.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {insight.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {insight.insight_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(insight.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
