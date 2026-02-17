"use client"

import { AppSidebar } from "./sidebar"
import { DynamicHeader } from "./dynamic-header"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DynamicHeader />
        <div className="flex flex-1 flex-col p-9 mx-auto w-full pt-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
