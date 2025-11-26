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
} from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"

const data = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "/avatars/01.png",
  },
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
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Memory</span>
            <span className="text-xs text-muted-foreground">Web Summarizer</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
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
                            className="justify-between"
                            isActive={false}
                            data-state={isParentActive ? "active" : undefined}
                          >
                            <span className="flex items-center gap-2">
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((sub) => (
                              <SidebarMenuSubItem key={sub.title}>
                                <SidebarMenuSubButton asChild isActive={activePath.startsWith(sub.url)}>
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
                    <SidebarMenuButton asChild isActive={activePath === item.url}>
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
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-2 mb-2">
          <ModeToggle />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="rounded-lg">
                      {user?.email?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User"}
                    </span>
                    <span className="truncate text-xs">
                      {user?.email}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.user_metadata?.avatar_url} />
                      <AvatarFallback className="rounded-lg">
                        {user?.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User"}
                      </span>
                      <span className="truncate text-xs">
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
      </SidebarFooter>
    </Sidebar>
  )
}
