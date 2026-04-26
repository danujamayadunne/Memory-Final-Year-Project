import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type AIProvider = "gemini" | "openai" | "anthropic" | "custom";

export type ProviderConfig = {
  provider: AIProvider;
  apiKey: string;
  modelId?: string;
  baseUrl?: string;
};

const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  custom: "gpt-4o",
};

function getDefaultGeminiConfig(): ProviderConfig | null {
  const key =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) return null;
  return { provider: "gemini", apiKey: key, modelId: "gemini-2.5-flash" };
}

export function resolveConfig(userConfig: ProviderConfig | null): ProviderConfig {
  if (userConfig) return userConfig;
  const fallback = getDefaultGeminiConfig();
  if (!fallback) throw new Error("No AI provider configured");
  return fallback;
}

export async function generateText(
  config: ProviderConfig,
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const model = config.modelId || DEFAULT_MODELS[config.provider];
  const temp = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 4096;

  switch (config.provider) {
    case "gemini": {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const m = genAI.getGenerativeModel({
        model,
        generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
      });
      const result = await m.generateContent(prompt);
      return result.response.text();
    }

    case "openai":
    case "custom": {
      const client = new OpenAI({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      });
      const result = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: temp,
        max_tokens: maxTokens,
      });
      return result.choices[0]?.message?.content || "";
    }

    case "anthropic": {
      const client = new Anthropic({ apiKey: config.apiKey });
      const result = await client.messages.create({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const block = result.content[0];
      return block.type === "text" ? block.text : "";
    }
  }
}

export async function generateTextWithImage(
  config: ProviderConfig,
  prompt: string,
  imageBase64: string,
  imageMimeType: string
): Promise<string> {
  const model = config.modelId || DEFAULT_MODELS[config.provider];

  switch (config.provider) {
    case "gemini": {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const m = genAI.getGenerativeModel({ model });
      const result = await m.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
            ],
          },
        ],
      });
      return result.response.text();
    }

    case "openai":
    case "custom": {
      const client = new OpenAI({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      });
      const dataUri = `data:${imageMimeType};base64,${imageBase64}`;
      const result = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: 1024,
      });
      return result.choices[0]?.message?.content || "";
    }

    case "anthropic": {
      const mediaType = imageMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      const client = new Anthropic({ apiKey: config.apiKey });
      const result = await client.messages.create({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: imageBase64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });
      const block = result.content[0];
      return block.type === "text" ? block.text : "";
    }
  }
}

export async function* streamText(
  config: ProviderConfig,
  prompt: string,
  options?: { temperature?: number; maxTokens?: number; systemPrompt?: string }
): AsyncGenerator<string> {
  const model = config.modelId || DEFAULT_MODELS[config.provider];
  const temp = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 4096;

  switch (config.provider) {
    case "gemini": {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const m = genAI.getGenerativeModel({
        model,
        generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
      });
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      if (options?.systemPrompt) {
        contents.push({ role: "user", parts: [{ text: `${options.systemPrompt}\n\n${prompt}` }] });
      } else {
        contents.push({ role: "user", parts: [{ text: prompt }] });
      }
      const response = await m.generateContentStream({ contents });
      for await (const chunk of response.stream) {
        const text = typeof chunk.text === "function" ? chunk.text() : chunk.text;
        if (text) yield text;
      }
      break;
    }

    case "openai":
    case "custom": {
      const client = new OpenAI({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      });
      const messages: OpenAI.ChatCompletionMessageParam[] = [];
      if (options?.systemPrompt) {
        messages.push({ role: "system", content: options.systemPrompt });
      }
      messages.push({ role: "user", content: prompt });
      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: temp,
        max_tokens: maxTokens,
        stream: true,
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
      break;
    }

    case "anthropic": {
      const client = new Anthropic({ apiKey: config.apiKey });
      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
        messages: [{ role: "user", content: prompt }],
      });
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
      break;
    }
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const geminiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY;

  if (!geminiKey) {
    throw new Error("Gemini API key required for embeddings");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        output_dimensionality: 768,
        content: { parts: [{ text: text.slice(0, 10000) }] },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.embedding?.values) {
    throw new Error("Unexpected embedding response format");
  }
  return data.embedding.values;
}
