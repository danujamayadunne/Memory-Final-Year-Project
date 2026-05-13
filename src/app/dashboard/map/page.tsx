"use client"

import { useEffect, useState, useCallback, useRef, useReducer } from "react"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { FormattedSummary } from "@/components/formatted-summary"
import {
  Network,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize,
  ExternalLink,
  Clock,
} from "lucide-react"
import { findRelatedSummariesWithAI, type SummaryItemForSimilarity } from "@/lib/similarity"

type SummaryItem = {
  id: string
  url: string
  summary: string
  title?: string
  created_at: string
  tags?: Array<{ id: string; name: string; color: string }>
}

type SimNode = {
  id: string
  label: string
  x: number
  y: number
  vx: number
  vy: number
  color: string
  data: SummaryItem
}

type SimLink = {
  source: string
  target: string
  similarity: number
}

type Camera = { x: number; y: number; scale: number }

type Drag = {
  type: "pan" | "node"
  nodeId?: string
  lastX: number
  lastY: number
  startX: number
  startY: number
  moved: boolean
  pointerId: number
}

const NODE_W = 174
const NODE_H = 40
const NODE_R = 10
const MIN_SCALE = 0.02
const MAX_SCALE = 8

const PALETTE = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#06b6d4",
]

function hexToRgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + "…" : s
}

export default function MapPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<SummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [selectedItem, setSelectedItem] = useState<SummaryItem | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const nodesRef = useRef<SimNode[]>([])
  const linksRef = useRef<SimLink[]>([])
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 })
  const simRef = useRef({ alpha: 1, running: false })
  const dragRef = useRef<Drag | null>(null)
  const hoveredRef = useRef<string | null>(null)
  const hoveredPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const selectedIdRef = useRef<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const rafRef = useRef(0)
  const mountedRef = useRef(true)
  const animatingRef = useRef(false)
  const [, rerender] = useReducer((c: number) => c + 1, 0)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("web_summaries")
        .select("id, url, summary, title, created_at, tags")
        .order("created_at", { ascending: false })
      if (data && mountedRef.current) setItems(data as SummaryItem[])
    } catch (err) {
      console.error("Error loading data:", err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (items.length > 0) {
      const t = setTimeout(buildGraph, 200)
      return () => clearTimeout(t)
    }
  }, [items])

  const buildGraph = async () => {
    if (items.length === 0) return
    setBuilding(true)
    setProgress({ current: 0, total: items.length })

    const radius = Math.max(350, items.length * 50)
    const nodes: SimNode[] = items.map((item, i) => {
      const angle = (2 * Math.PI * i) / items.length
      const jitter = (Math.random() - 0.5) * radius * 0.2
      let label = item.title || ""
      if (!label) {
        try { label = new URL(item.url).hostname } catch { label = item.url }
      }
      return {
        id: item.id,
        label: truncate(label, 22),
        x: Math.cos(angle) * radius + jitter,
        y: Math.sin(angle) * radius + jitter,
        vx: 0, vy: 0,
        color: item.tags?.[0]?.color || PALETTE[i % PALETTE.length],
        data: item,
      }
    })
    nodesRef.current = nodes
    linksRef.current = []

    try {
      const links: SimLink[] = []
      const seen = new Set<string>()

      for (let i = 0; i < items.length; i++) {
        if (!mountedRef.current) break
        setProgress({ current: i + 1, total: items.length })

        const related = await findRelatedSummariesWithAI(
          items[i] as SummaryItemForSimilarity,
          items.filter((_, j) => j !== i) as SummaryItemForSimilarity[],
          5, 0.45,
        )

        for (const { item: rel, score } of related) {
          const key = [items[i].id, rel.id].sort().join("|")
          if (!seen.has(key)) {
            seen.add(key)
            links.push({ source: items[i].id, target: rel.id, similarity: score })
          }
        }
        linksRef.current = [...links]
        rerender()
      }

      simRef.current = { alpha: 1.0, running: true }
      startAnimLoop()
    } catch (err) {
      console.error("Error building graph:", err)
    } finally {
      if (mountedRef.current) setBuilding(false)
    }
  }

  const runSimStep = () => {
    const nodes = nodesRef.current
    const links = linksRef.current
    const sim = simRef.current
    if (!sim.running || sim.alpha < 0.001) { sim.running = false; return }
    const map = new Map(nodes.map(n => [n.id, n]))

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const dSq = Math.max(dx * dx + dy * dy, 400)
        const d = Math.sqrt(dSq)
        const f = 18000 / dSq
        const fx = (dx / d) * f, fy = (dy / d) * f
        a.vx -= fx; a.vy -= fy
        b.vx += fx; b.vy += fy
      }
    }

    for (const l of links) {
      const s = map.get(l.source), t = map.get(l.target)
      if (!s || !t) continue
      const dx = t.x - s.x, dy = t.y - s.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const desired = 320 * (1 - l.similarity * 0.35)
      const f = (d - desired) * 0.05 * (0.5 + l.similarity * 0.5)
      const fx = (dx / d) * f, fy = (dy / d) * f
      s.vx += fx; s.vy += fy
      t.vx -= fx; t.vy -= fy
    }

    for (const n of nodes) {
      n.vx -= n.x * 0.005
      n.vy -= n.y * 0.005
    }

    for (const n of nodes) {
      if (dragRef.current?.type === "node" && dragRef.current.nodeId === n.id) continue
      n.vx *= 0.78
      n.vy *= 0.78
      n.x += n.vx * sim.alpha
      n.y += n.vy * sim.alpha
    }

    sim.alpha *= 0.992
  }

  const startAnimLoop = useCallback(() => {
    if (animatingRef.current) return
    animatingRef.current = true
    const tick = () => {
      if (!mountedRef.current) { animatingRef.current = false; return }
      if (simRef.current.running) runSimStep()
      rerender()
      if (simRef.current.running || dragRef.current) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        animatingRef.current = false
        rerender()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const fitToView = useCallback(() => {
    const svg = svgRef.current
    const nodes = nodesRef.current
    if (!svg || nodes.length === 0) return

    const rect = svg.getBoundingClientRect()
    const w = rect.width, h = rect.height
    if (w === 0 || h === 0) return

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
    }

    const gw = (maxX - minX) || 1
    const gh = (maxY - minY) || 1
    const padX = NODE_W + 100
    const padY = NODE_H + 100
    const scale = Math.min(w / (gw + padX), h / (gh + padY), 1.5)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    cameraRef.current = { x: w / 2 - cx * scale, y: h / 2 - cy * scale, scale }
    rerender()
  }, [])

  useEffect(() => {
    if (!building && nodesRef.current.length > 0) {
      const t = setTimeout(fitToView, 700)
      return () => clearTimeout(t)
    }
  }, [building, fitToView])

  const findNodeAtScreen = (sx: number, sy: number): SimNode | null => {
    const cam = cameraRef.current
    const hw = NODE_W / 2, hh = NODE_H / 2
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i]
      const nx = cam.x + n.x * cam.scale
      const ny = cam.y + n.y * cam.scale
      if (Math.abs(sx - nx) <= hw && Math.abs(sy - ny) <= hh) return n
    }
    return null
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const pos = (e: PointerEvent | WheelEvent) => {
      const r = svg.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const p = pos(e)
      const node = findNodeAtScreen(p.x, p.y)
      svg.setPointerCapture(e.pointerId)

      dragRef.current = {
        type: node ? "node" : "pan",
        nodeId: node?.id,
        lastX: p.x, lastY: p.y,
        startX: p.x, startY: p.y,
        moved: false,
        pointerId: e.pointerId,
      }
      svg.style.cursor = "grabbing"
      startAnimLoop()
    }

    const onMove = (e: PointerEvent) => {
      const p = pos(e)
      const drag = dragRef.current

      if (!drag) {
        const node = findNodeAtScreen(p.x, p.y)
        const id = node?.id ?? null
        if (hoveredRef.current !== id) {
          hoveredRef.current = id
          svg.style.cursor = node ? "pointer" : "default"
        }
        if (node) {
          const svgRect = svg.getBoundingClientRect()
          hoveredPosRef.current = { x: e.clientX - svgRect.left, y: e.clientY - svgRect.top }
        }
        rerender()
        return
      }

      const dx = p.x - drag.lastX
      const dy = p.y - drag.lastY
      drag.lastX = p.x
      drag.lastY = p.y

      if (Math.abs(p.x - drag.startX) > 3 || Math.abs(p.y - drag.startY) > 3) {
        drag.moved = true
      }

      if (drag.type === "node" && drag.nodeId) {
        const cam = cameraRef.current
        const node = nodesRef.current.find(n => n.id === drag.nodeId)
        if (node) {
          node.x += dx / cam.scale
          node.y += dy / cam.scale
          node.vx = 0
          node.vy = 0
          simRef.current.alpha = Math.max(simRef.current.alpha, 0.12)
          simRef.current.running = true
          startAnimLoop()
        }
      } else {
        cameraRef.current.x += dx
        cameraRef.current.y += dy
      }
      rerender()
    }

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return

      try { svg.releasePointerCapture(drag.pointerId) } catch { }

      if (!drag.moved) {
        const p = pos(e)
        const node = findNodeAtScreen(p.x, p.y)
        if (node) {
          selectedIdRef.current = node.id
          setSelectedItem(node.data)
          setSheetOpen(true)
        } else {
          selectedIdRef.current = null
        }
      }

      dragRef.current = null
      const p = pos(e)
      const under = findNodeAtScreen(p.x, p.y)
      svg.style.cursor = under ? "pointer" : "default"
      rerender()
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = pos(e)
      const cam = cameraRef.current

      const isPinch = e.ctrlKey || e.metaKey
      const zoomSpeed = isPinch ? 0.006 : 0.003

      const factor = Math.exp(-e.deltaY * zoomSpeed)
      const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cam.scale * factor))
      const r = ns / cam.scale
      cam.x = p.x - (p.x - cam.x) * r
      cam.y = p.y - (p.y - cam.y) * r
      cam.scale = ns

      if (e.deltaX) cam.x -= e.deltaX * 0.5

      rerender()
    }

    svg.addEventListener("pointerdown", onDown)
    svg.addEventListener("pointermove", onMove)
    svg.addEventListener("pointerup", onUp)
    svg.addEventListener("pointercancel", onUp)
    svg.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      svg.removeEventListener("pointerdown", onDown)
      svg.removeEventListener("pointermove", onMove)
      svg.removeEventListener("pointerup", onUp)
      svg.removeEventListener("pointercancel", onUp)
      svg.removeEventListener("wheel", onWheel)
    }
  }, [startAnimLoop])

  const zoomBy = useCallback((factor: number) => {
    const svg = svgRef.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const cx = r.width / 2, cy = r.height / 2
    const cam = cameraRef.current
    const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cam.scale * factor))
    const ratio = ns / cam.scale
    cam.x = cx - (cx - cam.x) * ratio
    cam.y = cy - (cy - cam.y) * ratio
    cam.scale = ns
    rerender()
  }, [])

  const cam = cameraRef.current
  const nodes = nodesRef.current
  const links = linksRef.current
  const hovered = hoveredRef.current
  const selected = selectedIdRef.current
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const hlId = hovered || selected
  const connIds = new Set<string>()
  if (hlId) {
    connIds.add(hlId)
    for (const l of links) {
      if (l.source === hlId || l.target === hlId) {
        connIds.add(l.source)
        connIds.add(l.target)
      }
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: "calc(100vh - 120px)" }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
        <div className="flex items-center justify-between pb-4 shrink-0">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Knowledge Graph
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {nodes.length} summaries &middot; {links.length} connections
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-lg border overflow-hidden relative bg-background">
          {building && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <div className="text-center bg-background border rounded-xl px-8 py-6 shadow-lg">
                <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Building knowledge graph...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Analyzing {progress.current} of {progress.total} summaries
                </p>
                <div className="mt-3 h-1.5 w-48 bg-muted rounded-full overflow-hidden mx-auto">
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {items.length === 0 && !loading && !building ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-6">
                <Network className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="font-medium mb-1">No summaries to map</h3>
                <p className="text-sm text-muted-foreground">Add summaries to see connections</p>
              </div>
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full"
              style={{ touchAction: "none", cursor: "default" }}
            >
              <defs>
                <clipPath id="nodeClip">
                  <rect
                    x={-NODE_W / 2} y={-NODE_H / 2}
                    width={NODE_W} height={NODE_H}
                    rx={NODE_R}
                  />
                </clipPath>
                <filter id="cardShadow" x="-25%" y="-25%" width="150%" height="150%">
                  <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000" floodOpacity="0.12" />
                </filter>
              </defs>

              <g transform={`translate(${cam.x},${cam.y}) scale(${cam.scale})`}>
                {links.map((link, i) => {
                  const s = nodeMap.get(link.source)
                  const t = nodeMap.get(link.target)
                  if (!s || !t) return null
                  const isHL = !hlId || link.source === hlId || link.target === hlId
                  return (
                    <line
                      key={i}
                      x1={s.x} y1={s.y}
                      x2={t.x} y2={t.y}
                      stroke={isHL
                        ? hexToRgba(s.color, 0.3 + link.similarity * 0.4)
                        : "var(--border)"}
                      strokeWidth={(isHL ? 1.5 + link.similarity * 2.5 : 0.6) / cam.scale}
                      strokeLinecap="round"
                      opacity={isHL ? 1 : 0.15}
                    />
                  )
                })}
              </g>

              {nodes.map(node => {
                const sx = cam.x + node.x * cam.scale
                const sy = cam.y + node.y * cam.scale
                const isH = hovered === node.id
                const isS = selected === node.id
                const active = !hlId || connIds.has(node.id)

                return (
                  <g
                    key={node.id}
                    transform={`translate(${sx},${sy})`}
                    opacity={active ? 1 : 0.18}
                  >
                    <g clipPath="url(#nodeClip)" filter={isH || isS ? "url(#cardShadow)" : undefined}>
                      <rect
                        x={-NODE_W / 2} y={-NODE_H / 2}
                        width={NODE_W} height={NODE_H}
                        fill="var(--card)"
                      />
                      <rect
                        x={-NODE_W / 2} y={-NODE_H / 2}
                        width={5} height={NODE_H}
                        fill={node.color}
                      />
                    </g>
                    <rect
                      x={-NODE_W / 2} y={-NODE_H / 2}
                      width={NODE_W} height={NODE_H}
                      rx={NODE_R}
                      fill="none"
                      stroke={isH || isS ? node.color : "var(--border)"}
                      strokeWidth={isH || isS ? 1.8 : 1}
                    />
                    <text
                      x={4} y={1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={12}
                      fontFamily="var(--font-sans)"
                      fontWeight={500}
                      fill={active ? "var(--card-foreground)" : "var(--muted-foreground)"}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {node.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}

          {(() => {
            const hId = hoveredRef.current
            if (!hId || dragRef.current) return null
            const hNode = nodesRef.current.find(n => n.id === hId)
            if (!hNode) return null

            const nodeScreenX = cameraRef.current.x + hNode.x * cameraRef.current.scale
            const nodeScreenY = cameraRef.current.y + hNode.y * cameraRef.current.scale

            const connCount = linksRef.current.filter(
              l => l.source === hId || l.target === hId
            ).length

            const summaryPreview = hNode.data.summary
              ?.replace(/^[-•*]\s*/gm, "")
              .replace(/\n+/g, " ")
              .slice(0, 160)

            return (
              <div
                className="absolute z-20 pointer-events-none"
                style={{
                  left: nodeScreenX + NODE_W / 2 + 12,
                  top: nodeScreenY - 20,
                  maxWidth: 280,
                }}
              >
                <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg px-4 py-3 text-sm space-y-2">
                  <p className="font-semibold text-[13px] leading-snug">
                    {hNode.data.title || hNode.data.url}
                  </p>

                  {summaryPreview && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {summaryPreview}{hNode.data.summary && hNode.data.summary.length > 160 ? "…" : ""}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {hNode.data.tags?.slice(0, 3).map(tag => (
                      <span
                        key={tag.id}
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: hexToRgba(tag.color, 0.12), color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t">
                    <span>{connCount} connection{connCount !== 1 ? "s" : ""}</span>
                    <span>&middot;</span>
                    <span>
                      {new Date(hNode.data.created_at).toLocaleDateString(undefined, {
                        month: "short", day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

          {items.length > 0 && (
            <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border bg-background/90 p-1 backdrop-blur-sm shadow-sm">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(1.5)}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(1 / 1.5)}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="h-px bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fitToView}>
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Sheet open={sheetOpen} onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) { selectedIdRef.current = null; rerender() }
        }}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="border-b pb-4">
              <SheetTitle className="text-lg font-semibold pr-8 leading-snug">
                {selectedItem?.title || selectedItem?.url}
              </SheetTitle>
              <SheetDescription asChild>
                <a
                  href={selectedItem?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 mt-1 text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  <span className="break-all line-clamp-1">{selectedItem?.url}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              </SheetDescription>
            </SheetHeader>
            {selectedItem && (
              <div className="mt-6 space-y-5">
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
                    Summary
                  </h3>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <FormattedSummary content={selectedItem.summary} className="text-[15px] leading-[1.7]" />
                  </div>
                </div>

                {selectedItem.tags && selectedItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {selectedItem.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ backgroundColor: hexToRgba(tag.color, 0.12), color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2 border-t">
                  <Clock className="h-3 w-3" />
                  {new Date(selectedItem.created_at).toLocaleDateString(undefined, {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  )
}