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
import {
  Send,
  Bot,
  User,
  Loader,
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

  const suggestedPrompts = [
    "What are the key takeaways?",
    "Summarize the main argument",
    "Explain the methodology",
    "What are the implications?",
  ]

  useEffect(() => {
    if (isOpen && summary) {
      setMessages([{
        id: 'welcome',
        type: 'ai',
        content: `I can help you understand **${summary.title || 'this article'}**. Ask me to summarize key points, explain concepts, or explore connections. What would you like to know?`,
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

  const showSuggestions = messages.length === 1 && !loading

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full flex flex-col h-full sm:max-w-lg gap-0 p-0 border-l">

        <SheetHeader className="flex-shrink-0 border-b px-6 pt-6 pb-5">
          <div className="flex gap-4">
            <div className="flex h-13 w-1 shrink-0 items-center justify-center rounded-full bg-chart-1/80">
              <Sparkles className="h-5 w-5 text-chart-1" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <SheetTitle className="font-serif text-lg font-normal">Research Assistant</SheetTitle>
              <SheetDescription className="text-xs">
                Ask questions about your saved content
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {summary && (
          <div className="flex-shrink-0 px-6 py-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <h4 className="font-medium text-sm leading-snug line-clamp-2">
                {summary.title || summary.url}
              </h4>
              <a
                href={summary.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-muted-foreground hover:text-chart-1 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                View source
                <ExternalLink className="h-3 w-3" />
              </a>
              {summary.tags && summary.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {summary.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag.id}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${message.type === 'user'
                  ? 'bg-chart-1 text-white'
                  : 'bg-muted'
                  }`}>
                  {message.type === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className={`flex-1 min-w-0 max-w-[88%] ${message.type === 'user' ? 'items-end flex flex-col' : ''}`}>
                  <div className={`rounded-2xl px-4 py-3 ${message.type === 'user'
                    ? 'bg-chart-1 text-white rounded-br-md'
                    : 'bg-muted/60 rounded-bl-md border border-border/40'
                    }`}>
                    <div
                      className={`text-sm leading-[1.6] whitespace-pre-wrap ${message.type === 'user' ? 'text-white' : 'text-foreground'
                        }`}
                      dangerouslySetInnerHTML={{
                        __html: message.type === 'ai' ? formatBoldText(message.content) : message.content
                      }}
                    />
                  </div>
                  <div className={`text-[11px] text-muted-foreground mt-1.5 px-1 ${message.type === 'user' ? 'text-right' : ''}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-muted">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted/60 border border-border/40 px-4 py-3">
                  <Loader className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Analyzing...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="flex-shrink-0 border-t px-6 py-4 bg-muted/20 space-y-3">
          {showSuggestions && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setInput(prompt)
                      inputRef.current?.focus()
                    }}
                    className="text-xs px-3 py-2 rounded-lg border bg-background hover:bg-muted/50 hover:border-chart-1/30 transition-colors text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask about key points, methodology, implications..."
              disabled={loading || !summary}
              className="flex-1 h-11 border bg-background rounded-lg focus-visible:ring-2 focus-visible:ring-chart-1/20 focus-visible:ring-offset-0"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !input.trim() || !summary}
              size="icon"
              className="h-11 w-11 shrink-0 rounded-lg bg-chart-1 hover:bg-chart-1/90 text-white"
            >
              {loading ? (
                <Loader className="h-4 w-4 animate-spin" />
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