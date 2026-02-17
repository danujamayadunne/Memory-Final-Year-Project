import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY as string;

const embeddingCache = new Map<string, number[]>();
const similarityCache = new Map<string, number>();

function getCacheKey(text1: string, text2: string): string {
  const [first, second] = [text1, text2].sort();
  return `${first}|||${second}`;
}

function getTextHash(text: string): string {

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

async function generateEmbedding(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GOOGLE_GEMINI_API_KEY");
  }

  const textHash = getTextHash(text);
  if (embeddingCache.has(textHash)) {
    return embeddingCache.get(textHash)!;
  }

  try {

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          output_dimensionality: 768,
          content: { parts: [{ text: text.slice(0, 10000) }] }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.embedding && data.embedding.values) {
      const embedding = data.embedding.values;
      embeddingCache.set(textHash, embedding);
      return embedding;
    }

    throw new Error("Unexpected embedding response format");
  } catch (error: any) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }

  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

export async function PUT(req: NextRequest) {
  try {
    const { text1, text2 } = await req.json();

    if (!text1 || !text2) {
      return NextResponse.json(
        { error: "Both text1 and text2 are required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const similarityKey = getCacheKey(text1, text2);
    if (similarityCache.has(similarityKey)) {
      return NextResponse.json({
        similarity: similarityCache.get(similarityKey)!,
        cached: true
      });
    }

    const [embedding1, embedding2] = await Promise.all([
      generateEmbedding(text1),
      generateEmbedding(text2),
    ]);

    const similarity = cosineSimilarity(embedding1, embedding2);

    similarityCache.set(similarityKey, similarity);

    return NextResponse.json({ similarity, cached: false });
  } catch (error: any) {
    console.error("Error calculating similarity:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to calculate similarity" },
      { status: 500 }
    );
  }
}