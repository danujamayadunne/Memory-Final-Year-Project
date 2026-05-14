import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { generateEmbedding } from "@/lib/ai/provider";
import { embeddingCache } from "@/lib/embedding-cache";

const similarityCache = new Map<string, number>();
const SIMILARITY_CACHE_LIMIT = 1000;

function getCacheKey(text1: string, text2: string): string {
  const [first, second] = [text1, text2].sort();
  return `${first}|||${second}`;
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

function rememberSimilarity(key: string, value: number) {
  if (similarityCache.size >= SIMILARITY_CACHE_LIMIT) {
    const firstKey = similarityCache.keys().next().value;
    if (firstKey) similarityCache.delete(firstKey);
  }
  similarityCache.set(key, value);
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
    const cachedScore = similarityCache.get(similarityKey);
    if (cachedScore !== undefined) {
      return NextResponse.json({ similarity: cachedScore, cached: true });
    }

    const [embedding1, embedding2] = await Promise.all([
      embeddingCache.getOrCompute(text1, generateEmbedding),
      embeddingCache.getOrCompute(text2, generateEmbedding),
    ]);

    const similarity = cosineSimilarity(embedding1, embedding2);
    rememberSimilarity(similarityKey, similarity);

    return NextResponse.json({ similarity, cached: false });
  } catch (error: any) {
    console.error("Error calculating similarity:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to calculate similarity" },
      { status: 500 }
    );
  }
}
