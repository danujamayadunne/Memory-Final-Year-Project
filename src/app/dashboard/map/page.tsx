"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
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
  RotateCcw,
  Settings2,
  ExternalLink,
  Search,
} from "lucide-react"
import { findRelatedSummariesWithAI, type SummaryItemForSimilarity } from "@/lib/similarity"
import dynamic from "next/dynamic"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as any

type SummaryItem = {
  id: string
  url: string
  summary: string
  title?: string
  created_at: string
  tags?: Array<{ id: string; name: string; color: string }>
}

type GraphNode = SummaryItem & {
  id: string
  tagColor?: string
}

type GraphLink = {
  source: string
  target: string
  similarity: number
}

type GraphData = {
  nodes: GraphNode[]
  links: GraphLink[]
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 107, g: 114, b: 128 }
}

export default function MapPage() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<SummaryItem[]>([])
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(false)
  const [buildingGraph, setBuildingGraph] = useState(false)
  const [buildProgress, setBuildProgress] = useState({ current: 0, total: 0 })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [similarityThreshold, setSimilarityThreshold] = useState([0.6])
  const [maxConnections, setMaxConnections] = useState([5])
  const [searchQuery, setSearchQuery] = useState("")
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set())
  const graphRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 800, height: 500 }
      setDimensions({ width: Math.max(200, width), height: Math.max(200, height) })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const scheduleZoomToFit = useCallback(() => {
    const attemptFit = (attempts = 0) => {
      if (attempts > 20) return
      if (graphRef.current?.zoomToFit) {
        graphRef.current.zoomToFit(400, 60)
      } else {
        setTimeout(() => attemptFit(attempts + 1), 100)
      }
    }
    setTimeout(() => attemptFit(), 150)
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()
    try {
      const { data: summaries } = await supabase
        .from("web_summaries")
        .select("id, url, summary, title, created_at, tags")
        .order("created_at", { ascending: false })
      if (summaries) setItems(summaries as SummaryItem[])
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const buildGraph = useCallback(async () => {
    if (items.length === 0) return
    setBuildingGraph(true)
    try {
      const nodes: GraphNode[] = items.map((item) => ({
        ...item,
        id: item.id,
        tagColor: item.tags?.[0]?.color || "#6b7280",
      }))

      const links: GraphLink[] = []
      const threshold = similarityThreshold[0]
      const maxConn = maxConnections[0]
      const processedPairs = new Set<string>()

      for (let i = 0; i < items.length; i++) {
        setBuildProgress({ current: i + 1, total: items.length })
        const related = await findRelatedSummariesWithAI(
          items[i] as SummaryItemForSimilarity,
          items.filter((_, idx) => idx !== i) as SummaryItemForSimilarity[],
          maxConn,
          threshold
        )
        related.forEach(({ item: relatedItem, score }) => {
          const pairKey = [items[i].id, relatedItem.id].sort().join("-")
          if (!processedPairs.has(pairKey) && score >= threshold) {
            processedPairs.add(pairKey)
            links.push({
              source: items[i].id,
              target: relatedItem.id,
              similarity: score,
            })
          }
        })
      }

      setGraphData({ nodes, links })
    } catch (error) {
      console.error("Error building graph:", error)
    } finally {
      setBuildingGraph(false)
    }
  }, [items, similarityThreshold, maxConnections])

  useEffect(() => {
    if (items.length > 0) {
      const t = setTimeout(() => buildGraph(), 500)
      return () => clearTimeout(t)
    }
  }, [items.length, similarityThreshold[0], maxConnections[0], buildGraph])

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node)
      setSheetOpen(true)
      const connectedIds = new Set<string>([node.id])
      graphData.links.forEach((l) => {
        if (l.source === node.id || l.target === node.id) {
          connectedIds.add(typeof l.source === "string" ? l.source : (l.source as GraphNode).id)
          connectedIds.add(typeof l.target === "string" ? l.target : (l.target as GraphNode).id)
        }
      })
      setHighlightNodes(connectedIds)
    },
    [graphData.links]
  )

  const handleBackgroundClick = useCallback(() => {
    setHighlightNodes(new Set())
  }, [])

  const handleZoomIn = () => {
    if (graphRef.current) {
      const scale = graphRef.current.zoom()
      graphRef.current.zoom(scale * 1.2, 200)
    }
  }

  const handleZoomOut = () => {
    if (graphRef.current) {
      const scale = graphRef.current.zoom()
      graphRef.current.zoom(scale * 0.8, 200)
    }
  }

  const handleFit = () => {
    if (graphRef.current?.zoomToFit) graphRef.current.zoomToFit(400, 60)
  }

  const filteredGraphData = useMemo(() => {
    if (!searchQuery.trim()) return graphData
    const q = searchQuery.toLowerCase()
    const visibleIds = new Set(
      graphData.nodes.filter((n) => {
        const title = (n.title || n.url || "").toLowerCase()
        const summary = (n.summary || "").toLowerCase()
        const tags = (n.tags || []).map((t) => t.name.toLowerCase()).join(" ")
        return title.includes(q) || summary.includes(q) || tags.includes(q)
      }).map((n) => n.id)
    )
    const visibleLinks = graphData.links.filter(
      (l) =>
        visibleIds.has(typeof l.source === "string" ? l.source : (l.source as GraphNode).id) &&
        visibleIds.has(typeof l.target === "string" ? l.target : (l.target as GraphNode).id)
    )
    return {
      nodes: graphData.nodes.filter((n) => visibleIds.has(n.id)),
      links: visibleLinks,
    }
  }, [graphData, searchQuery])

  const nodeCanvasObject = useCallback(
    (node: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.title
        ? node.title.length > 28
          ? node.title.substring(0, 28) + "…"
          : node.title
        : node.url.length > 32
          ? node.url.substring(0, 32) + "…"
          : node.url

      const tagColor = node.tagColor || "#6b7280"
      const rgb = hexToRgb(tagColor)
      const isHighlight = highlightNodes.size === 0 || highlightNodes.has(node.id)
      const opacity = isHighlight ? 1 : 0.25

      const fontSize = 12 / globalScale
      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      const textWidth = ctx.measureText(label).width
      const pad = 12
      const w = Math.min(220, textWidth + pad * 2)
      const h = 44

      const x = (node.x ?? 0) - w / 2
      const y = (node.y ?? 0) - h / 2

      ctx.save()
      ctx.globalAlpha = opacity

      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`
      ctx.strokeStyle = tagColor
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, 8)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = "#111827"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(label, (node.x ?? 0), node.y ?? 0)

      ctx.restore()
    },
    [highlightNodes]
  )

  const nodePointerAreaPaint = useCallback(
    (node: GraphNode & { x?: number; y?: number }, color: string, ctx: CanvasRenderingContext2D) => {
      const w = 220
      const h = 44
      ctx.fillStyle = color
      ctx.fillRect((node.x ?? 0) - w / 2, (node.y ?? 0) - h / 2, w, h)
    },
    []
  )

  const linkColor = useCallback((link: GraphLink) => {
    const s = link.similarity
    if (s >= 0.7) return "rgba(34, 197, 94, 0.6)"
    if (s >= 0.5) return "rgba(59, 130, 246, 0.5)"
    return "rgba(107, 114, 128, 0.4)"
  }, [])

  const linkWidth = useCallback((link: GraphLink) => {
    return Math.max(1, Math.min(3, link.similarity * 4))
  }, [])

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-full max-w-sm space-y-6 text-center px-4">
            <div>
              <h1 className="text-xl font-medium">Sign in required</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in to view the knowledge map
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-0 flex-1">
        <div className="space-y-4 shrink-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative border border-input rounded-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search summaries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 border-0 bg-muted/50 hover:bg-muted/70 focus-visible:bg-muted/70 rounded-lg transition-colors"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Similarity</Label>
              <Slider
                min={0.1}
                max={0.9}
                step={0.05}
                value={similarityThreshold}
                onValueChange={setSimilarityThreshold}
                className="w-24 sm:w-32"
              />
              <span className="text-xs text-muted-foreground tabular-nums w-8">
                {similarityThreshold[0].toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Max links</Label>
              <Slider
                min={1}
                max={10}
                step={1}
                value={maxConnections}
                onValueChange={setMaxConnections}
                className="w-20"
              />
              <span className="text-xs tabular-nums w-6">{maxConnections[0]}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-9 pb-5 shrink-0">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Map ({filteredGraphData.nodes.length} summaries · {filteredGraphData.links.length} connections)
          </h2>
        </div>

        <div className="rounded-lg border overflow-hidden flex-1 min-h-[400px]">
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden bg-muted/30"
            style={{ height: "calc(100vh - 280px)", minHeight: 400 }}
          >
            {buildingGraph ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm font-medium">Building graph...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {buildProgress.current} of {buildProgress.total} summaries
                  </p>
                </div>
              </div>
            ) : filteredGraphData.nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center px-6">
                  <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-1">
                    {searchQuery ? "No matches" : "No summaries to map"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? "Try a different search term"
                      : "Add summaries to see connections"}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <ForceGraph2D
                  ref={graphRef}
                  graphData={filteredGraphData}
                  width={dimensions.width}
                  height={dimensions.height}
                  nodeId="id"
                  linkSource="source"
                  linkTarget="target"
                  nodeCanvasObject={nodeCanvasObject}
                  nodePointerAreaPaint={nodePointerAreaPaint}
                  linkColor={linkColor}
                  linkWidth={linkWidth}
                  linkDirectionalArrowLength={4}
                  linkDirectionalArrowRelPos={1}
                  onNodeClick={handleNodeClick}
                  onBackgroundClick={handleBackgroundClick}
                  backgroundColor="transparent"
                  d3AlphaDecay={0.02}
                  d3VelocityDecay={0.3}
                  cooldownTicks={250}
                  onEngineStop={scheduleZoomToFit}
                  enableNodeDrag
                  enableZoomInteraction
                  enablePanInteraction
                />
                <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border bg-background/95 p-1 backdrop-blur">
                  <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleZoomIn}
                        disabled={buildingGraph}
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleZoomOut}
                    disabled={buildingGraph}
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleFit}
                    disabled={buildingGraph}
                    aria-label="Fit to view"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-lg overflow-y-auto"
          >
            <SheetHeader className="border-b pb-4">
              <SheetTitle className="font-serif text-lg font-normal pr-8">
                {selectedNode?.title || selectedNode?.url}
              </SheetTitle>
              <SheetDescription asChild>
                <a
                  href={selectedNode?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 mt-1 text-muted-foreground hover:text-foreground text-sm"
                >
                  <span className="break-all">{selectedNode?.url}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              </SheetDescription>
            </SheetHeader>
            {selectedNode && (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
                    Summary
                  </h3>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <FormattedSummary content={selectedNode.summary} className="text-[15px] leading-[1.7]" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {selectedNode.tags?.map((tag) => (
                    <span
                      key={tag.id}
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(selectedNode.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  )
}
