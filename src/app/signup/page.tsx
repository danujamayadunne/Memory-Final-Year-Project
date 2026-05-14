"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Instrument_Serif } from "next/font/google"
import { ArrowRight, Mail, Lock, KeyRound } from "lucide-react"

const font = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  style: "italic",
})

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
      const isExtension = urlParams.get("extension") === "true"

      if (data.session && data.user) {
        if (isExtension) {
          const authData = {
            access_token: data.session.access_token,
            user: {
              id: data.user.id,
              email: data.user.email,
              name:
                data.user.user_metadata?.full_name ||
                data.user.email?.split("@")[0],
            },
          }

          localStorage.setItem("memory_extension_auth", JSON.stringify(authData))
          window.postMessage({ type: "MEMORY_AUTH_SUCCESS", data: authData }, "*")
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

  const isSuccess = message.includes("Check your email")

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white text-black selection:bg-black selection:text-white">
      <div className="relative flex items-center justify-center p-6 lg:p-12 overflow-hidden order-2 lg:order-1">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2.5">
              <span className={`text-2xl tracking-tight ${font.className}`}>
                Memory
              </span>
            </Link>
          </div>

          <div className="text-center mb-8">
            <h1
              className={`text-3xl md:text-4xl tracking-[-0.02em] leading-[1.1] mb-2 ${font.className}`}
            >
              Create your account
            </h1>
            <p className="text-sm text-black/55 leading-relaxed">
              Save everything you read, watch, and learn. Free to start.
            </p>
          </div>

          <div className="rounded-2xl border border-black/[0.06] bg-white/60 backdrop-blur-xl p-7 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_30px_80px_-30px_rgba(0,0,0,0.18)]">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-xs font-medium text-black/65 tracking-wide"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-black" strokeWidth={1.75} />
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-black/[0.08] bg-white/70 backdrop-blur pl-10 pr-4 py-3 text-sm text-black placeholder:text-black/35 focus:outline-none focus:border-black/40 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-xs font-medium text-black/65 tracking-wide"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-black" strokeWidth={1.75} />
                  <input
                    id="password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-black/[0.08] bg-white/70 backdrop-blur pl-10 pr-4 py-3 text-sm text-black placeholder:text-black/35 focus:outline-none focus:border-black/40 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-xs font-medium text-black/65 tracking-wide"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-black" strokeWidth={1.75} />
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-black/[0.08] bg-white/70 backdrop-blur pl-10 pr-4 py-3 text-sm text-black placeholder:text-black/35 focus:outline-none focus:border-black/40 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {message && (
                <div
                  className={`text-xs rounded-lg px-3 py-2.5 ${isSuccess
                    ? "text-black/80 bg-black/[0.04] border border-black/10"
                    : "text-red-600 bg-red-50/80 border border-red-200/60"
                    }`}
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group w-full inline-flex items-center justify-center gap-2 bg-black text-white rounded-full py-3 text-sm font-medium hover:bg-black/85 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account..." : "Create account"}
                {!loading && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </form>

            <p className="mt-5 text-[11px] leading-relaxed text-black/45 text-center">
              By signing up, you agree to our Terms of Service and
              acknowledge our Privacy Policy.
            </p>
          </div>

          <p className="text-center text-sm text-black/55 mt-6">
            Already have an account?{" "}
            <Link
              href="/signin"
              className="text-black font-medium hover:underline underline-offset-4 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden lg:block bg-black overflow-hidden order-1 lg:order-2">
        <img
          src="/art-institute-of-chicago-dfOOsg0Qj98-unsplash.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover [filter:grayscale(1)_contrast(1.1)_brightness(0.95)]"
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        <span className="absolute top-6 left-6 h-3 w-3 border-t border-l border-white/30" />
        <span className="absolute top-6 right-6 h-3 w-3 border-t border-r border-white/30" />
        <span className="absolute bottom-6 left-6 h-3 w-3 border-b border-l border-white/30" />
        <span className="absolute bottom-6 right-6 h-3 w-3 border-b border-r border-white/30" />

        <Link
          href="/"
          className="absolute top-10 right-10 flex items-center gap-2.5 group"
        >
          <span className={`text-2xl tracking-tight text-white ${font.className}`}>
            Memory
          </span>
        </Link>

        <div className="absolute bottom-12 left-12 right-12 text-white">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/55 mb-5">
            <span className="h-px w-6 bg-white/40" />
            A garden for new ideas
          </div>
          <p className={`text-3xl md:text-4xl leading-[1.05] tracking-tight ${font.className}`}>
            &ldquo;What is now proved was once only imagined.&rdquo;
          </p>
          <p className="mt-4 text-sm text-white/55 tracking-wide">
            — William Blake
          </p>
        </div>
      </div>
    </div>
  )
}