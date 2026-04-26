"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <DashboardLayout>
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: "calc(100vh - 120px)" }}>
        <div className="text-center max-w-sm">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {error.message || "An unexpected error occurred."}
          </p>
          <Button onClick={reset} variant="outline" className="rounded-lg">
            Try again
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
