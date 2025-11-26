"use client"

import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { BookOpen, Image as ImageIcon } from "lucide-react"

const pageConfig = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Manage your web summaries",
    icon: BookOpen,
  },
  "/dashboard/summaries": {
    title: "All Summaries",
    subtitle: "View and manage all your saved content",
    icon: BookOpen,
  },
  "/dashboard/images": {
    title: "Image Memories",
    subtitle: "Visual references you’ve captured from around the web",
    icon: ImageIcon,
  },
  "/dashboard/knowledge": {
    title: "Knowledge Base",
    subtitle: "Organize, explore, and learn from your saved content",
    icon: BookOpen,
  },
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
      </div>
    </header>
  )
}
