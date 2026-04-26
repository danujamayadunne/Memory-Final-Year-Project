"use client"

import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"

const pageConfig = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Manage your web summaries",
  },
  "/dashboard/summaries": {
    title: "Text Summaries",
    subtitle: "View and manage all your saved text summaries",
  },
  "/dashboard/images": {
    title: "Image Memories",
    subtitle: "View and manage all your saved image memories",
  },
  "/dashboard/knowledge": {
    title: "Knowledge Base",
    subtitle: "Organize, explore, and learn from your saved content",
  },
  "/dashboard/settings": {
    title: "Settings",
    subtitle: "Manage your AI provider and API keys",
  },
  "/dashboard/memory": {
    title: "My Memory",
    subtitle: "Ask anything about your saved links, notes, and images",
  },
}

export function DynamicHeader() {
  const pathname = usePathname()
  const config = pageConfig[pathname as keyof typeof pageConfig] || pageConfig["/dashboard"]

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6">
      <SidebarTrigger className="-ml-3" />
      <div className="flex flex-1 items-center gap-2">
        <div className="flex-1">
          <h1 className="text-base font-medium flex items-center gap-2">
            {config.title}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {config.subtitle}
          </p>
        </div>
      </div>
    </header>
  )
}
