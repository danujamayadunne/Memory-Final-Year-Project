"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { useAuth } from "@/contexts/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  BookOpen,
  Home,
  Settings,
  LogOut,
  User,
  Network,
  Image as ImageIcon,
  ChevronRight,
  FileText,
  StickyNote,
} from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
    },
    {
      title: "Summaries",
      icon: BookOpen,
      items: [
        {
          title: "Text Summaries",
          url: "/dashboard/summaries",
          icon: FileText,
        },
        {
          title: "Image Summaries",
          url: "/dashboard/images",
          icon: ImageIcon,
        },
      ],
    },
    {
      title: "Notes",
      url: "/dashboard/notes",
      icon: StickyNote,
    },
    {
      title: "Map",
      url: "/dashboard/map",
      icon: Network,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings,
    },
  ],
}

export function AppSidebar() {
  const { user, signOut } = useAuth()
  const [activePath, setActivePath] = useState("/")
  const [openSections, setOpenSections] = useState<Record<string, boolean | undefined>>({})

  useEffect(() => {
    if (typeof window !== "undefined") {
      setActivePath(window.location.pathname || "/")
    }
  }, [])

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border/50">
        <Link href="/dashboard" className="flex items-center gap-3 px-3 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-lg font-medium tracking-tight">Memory</span>
            <span className="text-xs text-muted-foreground">Web Summarizer</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-1">
        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {data.navMain.map((item) => {
                if (item.items) {
                  const isParentActive = item.items.some((sub) => activePath.startsWith(sub.url))
                  const derivedOpen = openSections[item.title]
                  const isOpen = typeof derivedOpen === "boolean" ? derivedOpen : isParentActive
                  return (
                    <Collapsible
                      key={item.title}
                      asChild
                      open={isOpen}
                      onOpenChange={(open) => {
                        setOpenSections((prev) => ({
                          ...prev,
                          [item.title]: open,
                        }))
                      }}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            type="button"
                            className="justify-between rounded-lg px-3 py-2.5"
                            isActive={false}
                            data-state={isParentActive ? "active" : undefined}
                          >
                            <span className="flex items-center gap-3">
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="ml-2 mt-0.5 border-l border-sidebar-border/60 pl-3">
                            {item.items.map((sub) => (
                              <SidebarMenuSubItem key={sub.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={activePath.startsWith(sub.url)}
                                  className="rounded-md px-2.5 py-2"
                                >
                                  <Link href={sub.url}>
                                    {sub.icon && (
                                      <sub.icon className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span>{sub.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={activePath === item.url}
                      className="rounded-lg px-3 py-2.5"
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {data.navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="rounded-lg px-3 py-2.5">
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50">
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between rounded-lg bg-sidebar-accent/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Theme</span>
            <ModeToggle />
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="rounded-xl px-3 py-2.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-9 w-9 rounded-lg ring-2 ring-sidebar-border/50">
                      <AvatarImage src={user?.user_metadata?.avatar_url} />
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium">
                        {user?.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
                  side="top"
                  align="end"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-3 px-3 py-3 text-left text-sm">
                      <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                        <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium">
                          {user?.email?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user?.email}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <User className="mr-2 h-4 w-4" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
