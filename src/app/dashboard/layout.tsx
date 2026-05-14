"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Loader } from "lucide-react"

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
        <Loader className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}