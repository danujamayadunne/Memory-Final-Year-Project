"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import {
  Send,
  User,
  Loader2,
  ExternalLink,
  Brain,
  FileText,
  StickyNote,
  ImageIcon,
  Sparkles,
  ArrowDown,
} from "lucide-react"

type SourceItem = {
  type: "summary" | "note" | "image"
  id: string
  title: string
  url?: string
  imageUrl?: string
  snippet: string
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: SourceItem[]
  timestamp: Date
}

const SUGGESTED_PROMPTS = [
  "What have I saved about AI recently?",
  "Summarize my notes",
  "What images have I saved?",
  "Find links related to productivity",
  "What are the main topics in my saved content?",
  "Show me connections between my saved articles",
]

function SourceBadge({ source }: { source: SourceItem }) {
  const icon =
    source.type === "summary" ? (
      <FileText className="h-3 w-3" />
    ) : source.type === "note" ? (
      <StickyNote className="h-3 w-3" />
    ) : (
      <ImageIcon className="h-3 w-3" />
    )

  const label =
    source.type === "summary"
      ? "Link"
      : source.type === "note"
        ? "Note"
        : "Image"

  return (
    <div className="group/source flex items-start gap-2.5 rounded-xl border bg-background p-3 transition-colors hover:bg-muted/50 min-w-[220px] max-w-[280px]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="opacity-0 transition-opacity group-hover/source:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          )}
        </div>
        <p className="text-xs font-medium leading-snug line-clamp-2 mt-0.5">
          {source.title}
        </p>
      </div>
    </div>
  )
}

function formatMarkdown(text: string) {
  let html = text
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-4 mb-1.5">$1</h2>')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/`(.*?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-[13px]">$1</code>')
  html = html.replace(/\[Source (\d+)\]/g, '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-chart-1/10 text-chart-1 text-[11px] font-medium">Source $1</span>')
  html = html.replace(
    /^[-•] (.+)$/gm,
    '<div class="flex gap-2 items-start my-0.5"><span class="text-muted-foreground mt-1.5 text-[8px]">●</span><span>$1</span></div>'
  )
  return html
}

export default function MyMemoryPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100)
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim()
    if (!messageText || isStreaming) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsStreaming(true)

    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        sources: [],
        timestamp: new Date(),
      },
    ])

    try {
      const allMessages = [...messages, userMessage]
      const recentMessages = allMessages.slice(-10)
      const conversation = recentMessages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n")

      const res = await fetch("/api/ai/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          conversation: allMessages.length > 1 ? conversation : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to get response")
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response stream")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === "sources") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources: data.sources } : m
                )
              )
            } else if (data.type === "text") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + data.content }
                    : m
                )
              )
            } else if (data.type === "error") {
              throw new Error(data.error)
            }
          } catch (parseError) {
            if (parseError instanceof SyntaxError) continue
            throw parseError
          }
        }
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
              ...m,
              content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"
                }. Please try again.`,
            }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 160) + "px"
  }

  const isEmpty = messages.length === 0

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] -mt-6 -mx-9">
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="max-w-2xl w-full space-y-8">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Brain className="h-8 w-8 text-chart-1" />
                  <p className="font-serif italic text-3xl tracking-tight">
                    My Memory
                  </p>
                </div>
                <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                  Ask anything about your saved links, notes, and images.
                  I&apos;ll search across all your content to find the answer.
                </p>
              </div>

              <div className="relative">
                <div className="flex items-center gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-chart-1/20 transition-shadow">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your saved content..."
                    rows={1}
                    className="flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground min-h-[44px] max-h-[160px]"
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={isStreaming || !input.trim()}
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl bg-chart-1 hover:bg-chart-1/90 text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground text-center">
                  Try asking
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="text-xs px-3.5 py-2 rounded-full border bg-background hover:bg-muted/50 hover:border-chart-1/30 transition-all text-muted-foreground hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto min-h-0"
            >
              <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
                {messages.map((message) => (
                  <div key={message.id}>
                    {message.role === "user" ? (
                      <div className="flex items-start gap-3 justify-end">
                        <div className="max-w-[80%]">
                          <div className="rounded-2xl rounded-br-md bg-chart-1 text-white px-4 py-3">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1.5 text-right px-1">
                            {message.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-chart-1 text-white">
                          <User className="h-4 w-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Brain className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-3">
                          {message.sources && message.sources.length > 0 && (
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3" />
                                Found {message.sources.length} relevant source
                                {message.sources.length !== 1 ? "s" : ""}
                              </p>
                              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                                {message.sources.map((source) => (
                                  <SourceBadge
                                    key={source.id}
                                    source={source}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {message.content ? (
                            <div className="rounded-2xl rounded-bl-md bg-muted/60 border border-border/40 px-4 py-3">
                              <div
                                className="text-sm leading-[1.7] whitespace-pre-wrap [&_h2]:first:mt-0 [&_h3]:first:mt-0"
                                dangerouslySetInnerHTML={{
                                  __html: formatMarkdown(message.content),
                                }}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted/60 border border-border/40 px-4 py-3">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                              <span className="text-sm text-muted-foreground">
                                Searching your memory...
                              </span>
                            </div>
                          )}

                          <p className="text-[11px] text-muted-foreground px-1">
                            {message.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {showScrollButton && (
              <div className="absolute bottom-23 left-1/2 -translate-x-1/2 z-10">
                <Button
                  onClick={scrollToBottom}
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full shadow-md"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex-shrink-0 border-t bg-background/80 backdrop-blur-sm px-6 py-4">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-chart-1/20 transition-shadow">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a follow-up question..."
                    rows={1}
                    disabled={isStreaming}
                    className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground min-h-[44px] max-h-[160px] disabled:opacity-50"
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={isStreaming || !input.trim()}
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl bg-chart-1 hover:bg-chart-1/90 text-white"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
