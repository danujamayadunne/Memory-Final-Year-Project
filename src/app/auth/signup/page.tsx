"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Instrument_Serif } from "next/font/google"

const font = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  style: "italic"
});

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    if (password !== confirmPassword) {
      setMessage("Passwords do not match")
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
    } else {
      const urlParams = new URLSearchParams(window.location.search)
      const isExtension = urlParams.get('extension') === 'true'

      if (data.session && data.user) {
        if (isExtension) {
          const authData = {
            access_token: data.session.access_token,
            user: {
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0]
            }
          }

          localStorage.setItem('memory_extension_auth', JSON.stringify(authData))
          window.postMessage({ type: 'MEMORY_AUTH_SUCCESS', data: authData }, '*')
          setTimeout(() => window.close(), 150)
        } else {
          toast.success("Account created successfully")
          setTimeout(() => {
            router.push("/dashboard")
          }, 3000)
        }
      } else {
        setMessage("Check your email for the confirmation link.")
      }
    }
    setLoading(false)
  }

  const handleGoogleSignUp = async () => {
    setLoading(true)

    const urlParams = new URLSearchParams(window.location.search)
    const isExtension = urlParams.get('extension') === 'true'

    const redirectTo = isExtension
      ? `${window.location.origin}/auth/callback?extension=true`
      : `${window.location.origin}/dashboard`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo
      }
    })
    if (error) {
      setMessage(error.message)
      setLoading(false)
    }
  }

  const isSuccess = message.includes("Check your email")

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1A0F] p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,_#1a3d24,_transparent)]" />

      <div className="relative w-full max-w-md">

        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-xl font-semibold tracking-tight text-[#F5F0E8] font-serif">
              Memory
            </span>
          </Link>
        </div>

        <div className="rounded-2xl border border-[#1E3A26]/60 bg-[#0F2415]/60 backdrop-blur-sm p-8">
          <div className="text-center mb-8">
            <h1 className={`text-3xl ${font.className} text-[#F5F0E8] mb-2`}>
              Create your account
            </h1>
            <p className="text-sm text-[#B8B0A2]">
              Start capturing and remembering everything you learn
            </p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-[#B8B0A2]">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-[#1E3A26] bg-[#0B1A0F]/60 px-4 py-3 text-sm text-[#F5F0E8] placeholder:text-[#B8B0A2]/40 focus:outline-none focus:border-[#3D6A4D] focus:ring-1 focus:ring-[#3D6A4D]/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[#B8B0A2]">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[#1E3A26] bg-[#0B1A0F]/60 px-4 py-3 text-sm text-[#F5F0E8] placeholder:text-[#B8B0A2]/40 focus:outline-none focus:border-[#3D6A4D] focus:ring-1 focus:ring-[#3D6A4D]/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-[#B8B0A2]">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[#1E3A26] bg-[#0B1A0F]/60 px-4 py-3 text-sm text-[#F5F0E8] placeholder:text-[#B8B0A2]/40 focus:outline-none focus:border-[#3D6A4D] focus:ring-1 focus:ring-[#3D6A4D]/50 transition-colors"
              />
            </div>

            {message && (
              <div
                className={`text-sm rounded-lg px-3 py-2 ${isSuccess
                    ? "text-[#8FB89A] bg-[#8FB89A]/10 border border-[#8FB89A]/20"
                    : "text-red-400 bg-red-400/10 border border-red-400/20"
                  }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F5F0E8] text-[#0B1A0F] rounded-full py-3 text-sm font-medium hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1E3A26]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0F2415] px-3 text-[#B8B0A2]/60 tracking-wider">
                Or continue with
              </span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 rounded-full border border-[#1E3A26] py-3 text-sm text-[#B8B0A2] hover:border-[#3D6A4D] hover:text-[#F5F0E8] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm text-[#B8B0A2]/60 mt-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-[#8FB89A] hover:text-[#F5F0E8] transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}