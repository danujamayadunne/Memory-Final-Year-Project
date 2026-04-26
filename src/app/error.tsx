"use client"

import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
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
  )
}
