"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormattedSummary } from "@/components/formatted-summary"
import { Network, ExternalLink, Loader2, ZoomIn, ZoomOut, RotateCcw, Settings2 } from "lucide-react"
import { findRelatedSummariesWithAI, type SummaryItemForSimilarity } from "@/lib/similarity"
import dynamic from "next/dynamic"

const Graph = dynamic(() => import("react-graph-vis"), { ssr: false }) as any

type SummaryItem = {
  id: string
  url: string
  summary: string
  title?: string
  created_at: string
  tags?: Array<{ id: string; name: string; color: string }>
}

type VisNode = {
  id: string
  label: string
  title: string
  url: string
  summary: string
  created_at: string
  tags?: Array<{ id: string; name: string; color: string }>
  color?: {
    background: string
    border: string
    highlight: {
      background: string
      border: string
    }
  }
  shape: string
  font?: {
    size: number
    color: string
    face: string
  }
  borderWidth?: number
  borderWidthSelected?: number
  shadow?: {
    enabled: boolean
    color: string
    size: number
    x: number
    y: number
  }
}

type VisEdge = {
  from: string
  to: string
  value: number
  similarity: number
  color?: {
    color: string
    highlight: string
  }
  width?: number
  smooth?: {
    type: string
    roundness: number
  }
}

type VisGraphData = {
  nodes: VisNode[]
  edges: VisEdge[]
}

export default function MapPage() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<SummaryItem[]>([])
  const [graphData, setGraphData] = useState<VisGraphData>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(false)
  const [buildingGraph, setBuildingGraph] = useState(false)
  const [buildProgress, setBuildProgress] = useState({ current: 0, total: 0 })
  const [selectedNode, setSelectedNode] = useState<VisNode | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [similarityThreshold, setSimilarityThreshold] = useState([0.3])
  const [maxConnections, setMaxConnections] = useState([5])
  const networkRef = useRef<any>(null)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      const { data: summaries } = await supabase
        .from("web_summaries")
        .select("id, url, summary, title, created_at, tags")
        .order("created_at", { ascending: false })

      if (summaries) {
        setItems(summaries as SummaryItem[])
      }
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

      const nodes: VisNode[] = items.map((item) => {
        const tagColor = item.tags?.[0]?.color || "#6b7280"

        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
          return result
            ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
            }
            : { r: 107, g: 114, b: 128 }
        }
        const rgb = hexToRgb(tagColor)
        const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`
        const highlightBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`
        const hoverBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`

        const label = item.title
          ? (item.title.length > 32 ? item.title.substring(0, 32) + "..." : item.title)
          : (item.url.length > 38 ? item.url.substring(0, 38) + "..." : item.url)

        const summaryPreview = item.summary.length > 120
          ? item.summary.substring(0, 120) + "..."
          : item.summary
        const tooltip = `${item.title || item.url}\n\n${summaryPreview}`

        return {
          id: item.id,
          label: label,
          title: tooltip,
          url: item.url,
          summary: item.summary,
          created_at: item.created_at,
          tags: item.tags,
          shape: "box",
          color: {
            background: bgColor,
            border: tagColor,
            highlight: {
              background: highlightBg,
              border: tagColor,
            },
            hover: {
              background: hoverBg,
              border: tagColor,
            },
          },
          font: {
            size: 15,
            color: "#111827",
            face: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif",
            bold: true,
          },
          borderWidth: 2.5,
          borderWidthSelected: 4,
          shadow: {
            enabled: true,
            color: "rgba(0,0,0,0.15)",
            size: 8,
            x: 3,
            y: 3,
          },
          margin: 14,
          padding: 12,
        }
      })

      const edges: VisEdge[] = []
      const threshold = similarityThreshold[0]
      const maxConn = maxConnections[0]
      const processedPairs = new Set<string>()

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        setBuildProgress({
          current: i + 1,
          total: items.length,
        })

        const related = await findRelatedSummariesWithAI(
          item as SummaryItemForSimilarity,
          items.filter((_, idx) => idx !== i) as SummaryItemForSimilarity[],
          maxConn,
          threshold
        )

        related.forEach(({ item: relatedItem, score }) => {
          const pairKey = [item.id, relatedItem.id].sort().join('-')

          if (!processedPairs.has(pairKey) && score >= threshold) {
            processedPairs.add(pairKey)

            const opacity = Math.min(0.85, Math.max(0.4, score * 1.2))
            let edgeColor: string
            if (score >= 0.7) {
              edgeColor = `rgba(34, 197, 94, ${opacity})` // Green for high similarity
            } else if (score >= 0.5) {
              edgeColor = `rgba(59, 130, 246, ${opacity})` // Blue for medium-high
            } else {
              edgeColor = `rgba(107, 114, 128, ${opacity})` // Gray for lower
            }

            edges.push({
              from: item.id,
              to: relatedItem.id,
              value: Math.round(score * 10),
              similarity: score,
              color: {
                color: edgeColor,
                highlight: score >= 0.7 ? "#22c55e" : "#3b82f6",
              },
              width: Math.max(2, Math.min(5, score * 5)),
              smooth: {
                type: "continuous",
                roundness: 0.5,
              },
            })
          }
        })
      }

      setGraphData({ nodes, edges })
    } catch (error) {
      console.error("Error building graph:", error)
    } finally {
      setBuildingGraph(false)
    }
  }, [items, similarityThreshold, maxConnections])

  useEffect(() => {
    if (items.length > 0) {
      const timeoutId = setTimeout(() => {
        buildGraph()
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [items.length, similarityThreshold[0], maxConnections[0], buildGraph])

  const handleNodeClick = useCallback((params: any) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0]
      const node = graphData.nodes.find((n) => n.id === nodeId)
      if (node) {
        setSelectedNode(node)
        setShowModal(true)
      }
    }
  }, [graphData.nodes])

  const handleZoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale()
      networkRef.current.moveTo({ scale: scale * 1.2 })
    }
  }

  const handleZoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale()
      networkRef.current.moveTo({ scale: scale * 0.8 })
    }
  }

  const handleReset = () => {
    if (networkRef.current) {
      networkRef.current.fit({
        animation: {
          duration: 400,
          easingFunction: "easeInOutQuad",
        },
      })
    }
  }

  const graphOptions = {
    nodes: {
      shape: "box",
      font: {
        size: 15,
        face: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif",
        bold: true,
      },
      borderWidth: 2.5,
      borderWidthSelected: 4,
      shadow: {
        enabled: true,
        color: "rgba(0,0,0,0.18)",
        size: 10,
        x: 4,
        y: 4,
      },
      margin: 14,
      padding: 12,
      widthConstraint: {
        maximum: 240,
        minimum: 120,
      },
      heightConstraint: {
        minimum: 65,
      },
      chosen: {
        node: (values: any, id: string, selected: boolean, hovering: boolean) => {
          if (selected || hovering) {
            values.borderWidth = 4
            values.shadow = {
              enabled: true,
              color: "rgba(59, 130, 246, 0.35)",
              size: 14,
              x: 5,
              y: 5,
            }
          }
        },
      },
    },
    edges: {
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 1.4,
          type: "arrow",
        },
      },
      arrowStrikethrough: false,
      smooth: {
        type: "continuous",
        roundness: 0.5,
      },
      color: {
        inherit: false,
        opacity: 0.7,
      },
      width: 2.5,
      selectionWidth: 4,
      hoverWidth: 3,
      dashes: false,
      shadow: {
        enabled: true,
        color: "rgba(0,0,0,0.1)",
        size: 3,
        x: 1,
        y: 1,
      },
      chosen: {
        edge: (values: any) => {
          values.width = 4
          values.shadow = {
            enabled: true,
            color: "rgba(59, 130, 246, 0.4)",
            size: 5,
            x: 2,
            y: 2,
          }
        },
      },
    },
    physics: {
      enabled: true,
      stabilization: {
        enabled: true,
        iterations: 200,
        fit: true,
      },
      barnesHut: {
        gravitationalConstant: -2000,
        centralGravity: 0.1,
        springLength: 180,
        springConstant: 0.05,
        damping: 0.1,
        avoidOverlap: 1.2,
      },
    },
    interaction: {
      hover: true,
      hoverConnectedEdges: true,
      tooltipDelay: 150,
      zoomView: true,
      dragView: true,
      selectConnectedEdges: true,
    },
    layout: {
      improvedLayout: true,
      hierarchical: {
        enabled: false,
      },
    },
  }

  const events = {
    select: handleNodeClick,
    stabilizationEnd: () => {
      if (networkRef.current) {
        networkRef.current.fit({
          animation: {
            duration: 400,
            easingFunction: "easeInOutQuad",
          },
        })
      }
    },
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Please sign in</CardTitle>
              <CardDescription>You need to be signed in to view the map</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Network className="h-8 w-8" />
              Knowledge Map
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize connections between your saved summaries
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Graph Settings
            </CardTitle>
            <CardDescription>
              Adjust how summaries are connected in the map
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="similarity-threshold">
                  Similarity Threshold: {similarityThreshold[0].toFixed(2)}
                </Label>
                <span className="text-xs text-muted-foreground">
                  Higher = fewer connections
                </span>
              </div>
              <Slider
                id="similarity-threshold"
                min={0.1}
                max={0.9}
                step={0.05}
                value={similarityThreshold}
                onValueChange={setSimilarityThreshold}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="max-connections">
                  Max Connections per Node: {maxConnections[0]}
                </Label>
                <span className="text-xs text-muted-foreground">
                  Maximum related summaries per node
                </span>
              </div>
              <Slider
                id="max-connections"
                min={1}
                max={10}
                step={1}
                value={maxConnections}
                onValueChange={setMaxConnections}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Visualization</CardTitle>
                <CardDescription>
                  {graphData.nodes.length} summaries, {graphData.edges.length} connections
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={buildingGraph || graphData.nodes.length === 0}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={buildingGraph || graphData.nodes.length === 0}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={buildingGraph || graphData.nodes.length === 0}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {buildingGraph ? (
              <div className="h-[600px] flex items-center justify-center border rounded-lg">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Building graph...</h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    Processing {buildProgress.current} of {buildProgress.total} summaries
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Similarity calculations are cached for faster performance
                  </p>
                </div>
              </div>
            ) : graphData.nodes.length === 0 ? (
              <div className="h-[600px] flex items-center justify-center border rounded-lg">
                <div className="text-center">
                  <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No summaries to map</h3>
                  <p className="text-muted-foreground mb-4">
                    Start by adding some summaries to see connections
                  </p>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden bg-background" style={{ height: "600px" }}>
                <Graph
                  graph={graphData}
                  options={graphOptions}
                  events={events}
                  getNetwork={(network: any) => {
                    networkRef.current = network
                  }}
                  style={{ height: "100%", width: "100%" }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-h-[90vh] rounded-2xl min-w-[800px] shadow-none flex flex-col bg-white/5 backdrop-blur-lg border border-white/10 text-white">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {selectedNode?.title || selectedNode?.url}
              </DialogTitle>
              <DialogDescription>
                <a
                  href={selectedNode?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white hover:underline flex items-center gap-1"
                >
                  {selectedNode?.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold tracking-tight">Summary</h3>
                <div className="prose prose-sm max-w-none text-white">
                  <FormattedSummary
                    content={selectedNode?.summary || ""}
                    className="text-white/90"
                  />
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex flex-col items-start gap-2 justify-between pt-4 border-t border-white/10 mt-4">
              <div className="flex flex-wrap gap-2">
                {selectedNode?.tags?.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="px-3 py-1 font-medium">
                    {tag.name}
                  </Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground px-2">
                Created: {selectedNode && new Date(selectedNode.created_at).toLocaleString()}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
