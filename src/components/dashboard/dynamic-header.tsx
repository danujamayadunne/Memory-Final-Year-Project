"use client"

import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Eye, BookOpen, Target, BarChart3 } from "lucide-react"
import Link from "next/link"

const pageConfig = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Manage your web summaries",
    icon: BookOpen,
    actions: [
      { label: "Search", icon: Search, variant: "outline" as const },
      { label: "Add Summary", icon: Plus, variant: "default" as const, href: "/dashboard" }
    ]
  },
  "/dashboard/summaries": {
    title: "All Summaries",
    subtitle: "View and manage all your saved content",
    icon: BookOpen,
    actions: [
      { label: "Search", icon: Search, variant: "outline" as const },
      { label: "Add Summary", icon: Plus, variant: "default" as const, href: "/dashboard" }
    ]
  },
  "/dashboard/knowledge": {
    title: "Knowledge Base",
    subtitle: "Organize, explore, and learn from your saved content",
    icon: BookOpen,
    actions: [
      { label: "Search", icon: Search, variant: "outline" as const },
      { label: "Add Content", icon: Plus, variant: "default" as const, href: "/dashboard" }
    ]
  },
  "/dashboard/learning-paths": {
    title: "Learning Paths",
    subtitle: "Personalized learning journeys tailored to your knowledge and goals",
    icon: Target,
    actions: [
      { label: "AI Generate", icon: Plus, variant: "outline" as const },
      { label: "Create Path", icon: Plus, variant: "default" as const }
    ]
  },
  "/dashboard/insights": {
    title: "Learning Insights",
    subtitle: "Discover patterns in your learning and get personalized recommendations",
    icon: BarChart3,
    actions: [
      { label: "Generate Insights", icon: Plus, variant: "default" as const }
    ]
  }
}

export function DynamicHeader() {
  const pathname = usePathname()
  const config = pageConfig[pathname as keyof typeof pageConfig] || pageConfig["/dashboard"]

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center gap-2 px-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <config.icon className="h-5 w-5" />
            {config.title}
          </h1>
          <p className="text-sm text-muted-foreground tracking-tight">
            {config.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config.actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              size="sm"
              asChild={action.href ? true : false}
            >
              {action.href ? (
                <Link href={action.href}>
                  <action.icon className="h-4 w-4 mr-2" />
                  {action.label}
                </Link>
              ) : (
                <>
                  <action.icon className="h-4 w-4 mr-2" />
                  {action.label}
                </>
              )}
            </Button>
          ))}
        </div>
      </div>
    </header>
  )
}
