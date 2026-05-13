"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  Key,
  Plus,
  Trash2,
  Check,
  Loader,
  Sparkles,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
} from "lucide-react"

type SavedKey = {
  id: string
  provider: string
  model_id: string | null
  base_url: string | null
  label: string | null
  is_active: boolean
  key_hint: string
  created_at: string
}

const PROVIDER_INFO: Record<
  string,
  { name: string; placeholder: string; models: string[]; docsUrl: string }
> = {
  openai: {
    name: "OpenAI",
    placeholder: "sk-...",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-3.5-turbo",
      "o1",
      "o1-mini",
    ],
    docsUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    name: "Anthropic",
    placeholder: "sk-ant-...",
    models: [
      "claude-sonnet-4-20250514",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  custom: {
    name: "Custom (OpenAI-compatible)",
    placeholder: "your-api-key",
    models: [],
    docsUrl: "",
  },
}

export default function AiModelSettingsPage() {
  const { user } = useAuth()
  const [keys, setKeys] = useState<SavedKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [provider, setProvider] = useState<string>("openai")
  const [apiKey, setApiKey] = useState("")
  const [modelId, setModelId] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [label, setLabel] = useState("")
  const [showKey, setShowKey] = useState(false)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys")
      if (!res.ok) throw new Error("Failed to fetch keys")
      const data = await res.json()
      setKeys(data.keys || [])
    } catch (err) {
      console.error("Error fetching keys:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchKeys()
  }, [user, fetchKeys])

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("API key is required")
      return
    }
    if (provider === "custom" && !baseUrl.trim()) {
      toast.error("Base URL is required for custom providers")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          modelId: modelId || undefined,
          baseUrl: baseUrl || undefined,
          label: label || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }

      toast.success("API key saved and activated")
      resetForm()
      fetchKeys()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save key"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (id: string) => {
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Failed to activate")
      toast.success("Provider switched")
      fetchKeys()
    } catch {
      toast.error("Failed to switch provider")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/api-keys?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("API key removed")
      fetchKeys()
    } catch {
      toast.error("Failed to remove key")
    }
  }

  const handleResetToDefault = async () => {
    try {
      for (const key of keys) {
        if (key.is_active) {
          const res = await fetch(`/api/settings/api-keys?id=${key.id}`, {
            method: "DELETE",
          })
          if (!res.ok) throw new Error("Failed to reset")
        }
      }
      toast.success("Switched back to default Gemini")
      fetchKeys()
    } catch {
      toast.error("Failed to reset")
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setApiKey("")
    setModelId("")
    setBaseUrl("")
    setLabel("")
    setShowKey(false)
  }

  const activeKey = keys.find((k) => k.is_active)
  const info = PROVIDER_INFO[provider]

  return (
    <DashboardLayout>
      <div className="max-w-2xl">

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            AI Provider
          </h2>
        </div>

        <div className="mt-4 rounded-lg border overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  {activeKey
                    ? PROVIDER_INFO[activeKey.provider]?.name || activeKey.provider
                    : "Gemini"}
                  {activeKey?.model_id && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {activeKey.model_id}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeKey ? "Using your API key" : "Default"}
                </p>
              </div>
            </div>
            {activeKey && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs rounded-lg"
                onClick={handleResetToDefault}
              >
                Reset to Gemini
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2.5 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Gemini is provided free. Add your own key to use OpenAI,
          Anthropic, or any compatible API instead.
        </p>

        <div className="flex items-center justify-between pt-10 pb-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            API Keys
          </h2>
          {!showForm && (
            <Button
              size="sm"
              className="rounded-lg"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-4 w-4" />
              Add Key
            </Button>
          )}
        </div>

        {showForm && (
          <div className="rounded-lg border p-4 space-y-4 mb-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Provider
              </label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  setProvider(v)
                  setModelId("")
                  setBaseUrl("")
                }}
              >
                <SelectTrigger className="h-11 border-0 bg-muted/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="custom">
                    Custom (OpenAI-compatible)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  API Key
                </label>
                {info?.docsUrl && (
                  <a
                    href={info.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    Get a key
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder={info?.placeholder || "your-api-key"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 h-11 border-0 bg-muted/50 hover:bg-muted/70 focus-visible:bg-muted/70 rounded-lg transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {provider === "custom" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Base URL
                </label>
                <Input
                  placeholder="https://api.example.com/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="h-11 border-0 bg-muted/50 hover:bg-muted/70 focus-visible:bg-muted/70 rounded-lg transition-colors"
                />
                <p className="text-xs text-muted-foreground">
                  Works with Groq, Together, Fireworks, Ollama, and any
                  OpenAI-compatible endpoint
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Model
              </label>
              {info?.models.length ? (
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger className="h-11 border-0 bg-muted/50 rounded-lg">
                    <SelectValue placeholder="Use provider default" />
                  </SelectTrigger>
                  <SelectContent>
                    {info.models.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="e.g. llama-3.1-70b-versatile"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="h-11 border-0 bg-muted/50 hover:bg-muted/70 focus-visible:bg-muted/70 rounded-lg transition-colors"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Label (optional)
              </label>
              <Input
                placeholder="e.g. My OpenAI Key"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="h-11 border-0 bg-muted/50 hover:bg-muted/70 focus-visible:bg-muted/70 rounded-lg transition-colors"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="rounded-lg"
              >
                {saving ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg"
                onClick={resetForm}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 && !showForm ? (
          <div className="rounded-lg border border-dashed py-16 px-6 text-center">
            <Key className="h-10 w-10 text-muted-foreground/60 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm mb-1">
              No custom API keys configured
            </p>
            <p className="text-muted-foreground/80 text-sm">
              Using default Gemini provider
            </p>
          </div>
        ) : keys.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            {keys.map((key, idx, arr) => (
              <div
                key={key.id}
                className={`flex items-center justify-between px-4 py-3 ${idx < arr.length - 1 ? "border-b" : ""
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {key.is_active ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                        <Check className="h-4 w-4 text-emerald-600" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <Key className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {key.label ||
                          PROVIDER_INFO[key.provider]?.name ||
                          key.provider}
                      </span>
                      {key.is_active && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{key.key_hint}</span>
                      {key.model_id && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{key.model_id}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!key.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleActivate(key.id)}
                      className="text-xs rounded-lg"
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="pt-10">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pb-4">
            About Embeddings
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Semantic search and the knowledge map always use Gemini embeddings
            regardless of your chosen provider. This ensures consistent vector
            compatibility across all your saved content. Only text generation
            (summaries, chat, completions) uses your custom provider.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
