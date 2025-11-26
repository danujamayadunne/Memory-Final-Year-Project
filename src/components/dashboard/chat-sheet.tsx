"use client"

import { useState, useEffect, useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Send,
  Bot,
  User,
  Loader2,
  Brain,
  ExternalLink,
  Sparkles,
} from "lucide-react"

type SummaryItem = {
  id: string
  url: string
  summary: string
  title?: string
  created_at: string
  tags?: Array<{ id: string; name: string; color: string }>
}

type ChatMessage = {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
}

type ChatSheetProps = {
  summary: SummaryItem | null
  isOpen: boolean
  onClose: () => void
}

export function ChatSheet({ summary, isOpen, onClose }: ChatSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && summary) {

      setMessages([{
        id: 'welcome',
        type: 'ai',
        content: `I'm ready to answer questions about **${summary.title || 'this article'}**. What would you like to know?`,
        timestamp: new Date()
      }])
      setInput("")
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, summary])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const formatBoldText = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !summary) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = input.trim()
    setInput("")
    setLoading(true)

    try {
      const updatedMessages = [...messages, userMessage]
      const recentMessages = updatedMessages.slice(-10)
      const conversation = recentMessages.map(m =>
        `${m.type === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n')

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryId: summary.id,
          conversation: conversation
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get AI response')
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.suggestions?.[0] || "I'm here to help! What would you like to know?",
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full flex flex-col h-full">
        <SheetHeader className="px-6 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg">Ask Questions</SheetTitle>
                <SheetDescription className="text-xs mt-1">
                  Get answers based on the article
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        {summary && (
          <div className="px-6 border-b flex-shrink-0">
            <Card className="border-0 shadow-none bg-background/50">
              <CardContent className="p-0">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm line-clamp-2 leading-tight">
                      {summary.title || summary.url}
                    </h4>
                    <a
                      href={summary.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  {summary.tags && summary.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {summary.tags.slice(0, 3).map(tag => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="text-xs h-5 px-1.5"
                          style={{ borderColor: `${tag.color}40`, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${message.type === 'user'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-primary/10 text-primary border border-primary/20'
                  }`}>
                  {message.type === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className={`flex-1 min-w-0 ${message.type === 'user' ? 'items-end flex flex-col' : ''}`}>
                  <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 ${message.type === 'user'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted border border-border/50'
                    }`}>
                    <div
                      className={`text-sm leading-relaxed whitespace-pre-wrap ${message.type === 'user' ? 'text-primary-foreground' : 'text-foreground'
                        }`}
                      dangerouslySetInnerHTML={{
                        __html: message.type === 'ai' ? formatBoldText(message.content) : message.content
                      }}
                    />
                  </div>
                  <div className={`text-xs text-muted-foreground mt-1.5 px-1 ${message.type === 'user' ? 'text-right' : ''
                    }`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary border border-primary/20">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="inline-flex items-center gap-2 bg-muted border border-border/50 rounded-2xl px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-background">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about this article..."
                disabled={loading || !summary}
                className="min-h-[44px] rounded-xl border focus:border-primary transition-colors"
              />
              {input.trim() && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Sparkles className="h-4 w-4 text-primary/60" />
                </div>
              )}
            </div>
            <Button
              onClick={sendMessage}
              disabled={loading || !input.trim() || !summary}
              size="lg"
              className="h-[44px] flex items-center justify-center rounded-xl shadow-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
