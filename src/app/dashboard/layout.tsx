"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

function signInUrlWithRedirect(pathname: string | null): string {
  if (
    pathname &&
    pathname.startsWith("/") &&
    !pathname.startsWith("//") &&
    pathname !== "/signin"
  ) {
    return `/signin?redirect=${encodeURIComponent(pathname)}`
  }
  return "/signin"
}

export default function DashboardRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(signInUrlWithRedirect(pathname))
    }
  }, [loading, user, router, pathname])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
