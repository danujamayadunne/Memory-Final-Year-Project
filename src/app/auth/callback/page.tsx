"use client"

import { Suspense, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams } from "next/navigation"

function CallbackFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p>Completing sign in...</p>
      </div>
    </div>
  )
}

function AuthCallbackContent() {
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error("Auth callback error:", error)
          return
        }

        if (data.session) {
          const isExtension = searchParams.get("extension") === "true"

          if (isExtension) {
            const authData = {
              access_token: data.session.access_token,
              user: {
                id: data.session.user.id,
                email: data.session.user.email,
                name:
                  data.session.user.user_metadata?.full_name ||
                  data.session.user.email?.split("@")[0],
              },
            }

            localStorage.setItem("memory_extension_auth", JSON.stringify(authData))
            window.postMessage({ type: "MEMORY_AUTH_SUCCESS", data: authData }, "*")
            setTimeout(() => window.close(), 150)
          } else {
            window.location.href = "/dashboard"
          }
        }
      } catch (error) {
        console.error("Error in auth callback:", error)
      }
    }

    void handleAuthCallback()
  }, [supabase, searchParams])

  return <CallbackFallback />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
