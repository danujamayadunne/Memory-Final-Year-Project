"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormattedSummary } from "@/components/formatted-summary"
import { ExternalLink } from "lucide-react"

type SummaryItem = {
  id: string
  url: string
  summary: string
  title?: string
  created_at: string
  tags?: Array<{ id: string; name: string; color: string }>
}

interface SummaryDialogProps {
  item: SummaryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SummaryDialog({ item, open, onOpenChange }: SummaryDialogProps) {
  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-[720px] flex flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-background p-0 shadow-xl sm:max-w-[720px]">

        <DialogHeader className="flex-shrink-0 border-b px-8 pt-8 pb-6">
          <div className="flex gap-4">
            <div className="flex h-13 w-1 shrink-0 self-stretch rounded-full bg-chart-1/80" aria-hidden />
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-serif text-xl font-normal leading-snug text-foreground">
                {item.title || item.url}
              </DialogTitle>
              <DialogDescription asChild>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-1.5 mt-1 text-muted-foreground transition-colors hover:text-foreground text-xs"
                >
                  <span className="break-all">{item.url}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                </a>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Summary
            </span>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-p:text-foreground/90 prose-li:marker:text-chart-1/70">
            <FormattedSummary content={item.summary} className="text-[15px] leading-[1.7]" />
          </div>
        </div>

        <div className="flex-shrink-0 border-t bg-muted/30 px-8 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {item.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {new Date(item.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
