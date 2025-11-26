"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams } from "next/navigation"

export default function AuthCallbackPage() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          return
        }

        if (data.session) {
          const isExtension = searchParams.get('extension') === 'true'
          
          if (isExtension) {
            const authData = {
              access_token: data.session.access_token,
              user: {
                id: data.session.user.id,
                email: data.session.user.email,
                name: data.session.user.user_metadata?.full_name || data.session.user.email?.split('@')[0]
              }
            }
            
            // Store in localStorage for extension to pick up
            localStorage.setItem('memory_extension_auth', JSON.stringify(authData))
            
            // Send auth data to extension
            if (window.opener) {
              window.opener.postMessage({
                type: 'MEMORY_AUTH_SUCCESS',
                data: authData
              }, '*')
            }
            
            // Close the window immediately
            window.close()
          } else {
            // Redirect to dashboard for normal web flow
            window.location.href = "/dashboard"
          }
        }
      } catch (error) {
        console.error('Error in auth callback:', error)
      }
    }

    handleAuthCallback()
  }, [supabase.auth, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Completing sign in...</p>
      </div>
    </div>
  )
}
