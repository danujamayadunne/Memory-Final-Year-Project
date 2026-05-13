"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Loader, Mail, UserRound, AlertTriangle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function AccountSettingsPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (user?.email) setEmail(user.email)
  }, [user?.email])

  const handleUpdateEmail = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      toast.error("Enter an email address")
      return
    }
    if (trimmed === user?.email) {
      toast.message("No change", { description: "That is already your email." })
      return
    }

    setUpdating(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ email: trimmed })
      if (error) throw error
      toast.success("Confirmation sent", {
        description: "Check your new inbox to confirm the email change.",
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not update email"
      toast.error(message)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const res = await fetch("/api/account", { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Could not delete account")
      }
      toast.success("Account deleted")
      await signOut()
      router.push("/")
      router.refresh()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not delete account"
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-10">
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Email
          </h2>
          <div className="mt-4 rounded-lg border overflow-hidden">
            <div className="px-4 py-3 flex items-start gap-3 border-b">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="font-medium text-sm">Sign-in email</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Changing your email sends a confirmation link to the new address.
                </p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-0 bg-muted/50 hover:bg-muted/70 focus-visible:bg-muted/70 rounded-lg transition-colors"
                disabled={updating}
              />
              <Button
                size="sm"
                className="rounded-lg"
                onClick={handleUpdateEmail}
                disabled={updating}
              >
                {updating ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  "Update email"
                )}
              </Button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Danger zone
          </h2>
          <div className="mt-4 rounded-lg border border-destructive/25 overflow-hidden bg-destructive/[0.02]">
            <div className="px-4 py-3 flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="font-medium text-sm">Delete account</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Permanently remove your account and sign you out. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="px-4 pb-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-lg gap-2"
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserRound className="h-4 w-4" />
                        Delete account
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All data associated with this account will be removed. This action is permanent.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-lg bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => void handleDeleteAccount()}
                    >
                      Delete forever
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
