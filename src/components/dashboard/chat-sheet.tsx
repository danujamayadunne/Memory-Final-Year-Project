"use client"

import { useState, useEffect } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Send,
  Bot,
  User,
  Loader2,
  Brain,
} from "lucide-react"

type SummaryItem = {
  id: string
  url: string
  summary: string
  title?: string
  created_at: string
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
  chatType: 'questions' | 'gaps' | 'path' | 'general'
}

export function ChatSheet({ summary, isOpen, onClose, chatType }: ChatSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && summary) {
      setMessages([])
    }
  }, [isOpen, summary, chatType])

  const formatBoldText = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const context = summary ? `Summary: ${summary.summary}\n\n` : ""
      const updatedMessages = [...messages, userMessage]

      const recentMessages = updatedMessages.slice(-10)
      const conversation = recentMessages.map(m => `${m.type === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')

      const requestBody = {
        summaryId: summary?.id || "general",
        type: 'general',
        content: `${context}${conversation}`
      }

      const res = await fetch("/api/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get AI response')
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: formatBoldText(data.suggestions?.[0] || "I'm here to help! What would you like to know?"),
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: formatBoldText(`Sorry, I couldn't process your message: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`),
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const getChatTitle = () => {
    switch (chatType) {
      case 'questions': return 'Follow-up Questions'
      case 'gaps': return 'Learning Gaps'
      case 'path': return 'Learning Path'
      default: return 'AI Assistant'
    }
  }

  const getChatDescription = () => {
    switch (chatType) {
      case 'questions': return 'Ask questions to deepen your understanding'
      case 'gaps': return 'Identify knowledge gaps and areas for improvement'
      case 'path': return 'Get personalized learning recommendations'
      default: return 'Chat about your content and learning goals'
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {getChatTitle()}
          </SheetTitle>
          <SheetDescription>
            {getChatDescription()}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {summary && (
            <Card className="mb-4">
              <CardContent className="p-3">
                <div className="text-sm">
                  <div className="font-medium truncate">{summary.title || summary.url}</div>
                  <div className="text-muted-foreground text-xs mt-1 line-clamp-2">
                    {summary.summary}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {loading ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Bot className="h-6 w-6 text-primary mt-1" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex items-start gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${message.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                    }`}>
                    {message.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`flex-1 ${message.type === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block p-3 rounded-lg ${message.type === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                      }`}>
                      <p
                        className="text-sm whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: message.type === 'ai' ? formatBoldText(message.content) : message.content
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              size="sm"
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
