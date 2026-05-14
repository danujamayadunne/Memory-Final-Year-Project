import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { embeddingCache } from "@/lib/embedding-cache";
import { generateEmbedding } from "@/lib/ai/provider";

const SIMILARITY_HIGH = 0.65;
const SIMILARITY_RELAXED = 0.5;
const RPC_MATCH_THRESHOLD = 0.3;

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

function parseStoredEmbedding(raw: unknown, expectedLength: number): number[] | null {
  try {
    let parsed: number[] | null = null;
    if (typeof raw === "string") {
      parsed = raw
        .replace(/[\[\]]/g, "")
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((n) => !Number.isNaN(n));
    } else if (Array.isArray(raw)) {
      parsed = raw.map(Number).filter((n) => !Number.isNaN(n));
    } else if (raw && typeof raw === "object") {
      parsed = Object.values(raw as Record<string, unknown>)
        .map((v) => Number(v))
        .filter((n) => !Number.isNaN(n));
    }
    if (!parsed?.length || parsed.length !== expectedLength) return null;
    return parsed;
  } catch {
    return null;
  }
}

function applyTieredThreshold<T extends { similarity: number }>(items: T[]): T[] {
  const strict = items.filter((item) => item.similarity >= SIMILARITY_HIGH);
  if (strict.length > 0) return strict;
  return items.filter((item) => item.similarity >= SIMILARITY_RELAXED);
}

export async function POST(req: NextRequest) {
  try {
    const { query, limit = 50 } = await req.json();

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queryEmbedding = await embeddingCache.getOrCompute(
      query.trim(),
      generateEmbedding
    );
    const vectorString = `[${queryEmbedding.join(",")}]`;

    const { data: summaries, error: fetchError } = await supabase.rpc(
      "match_summaries",
      {
        query_embedding_text: vectorString,
        match_threshold: RPC_MATCH_THRESHOLD,
        match_count: limit * 2,
        user_id_param: user.id,
      }
    );

    if (fetchError) {
      console.warn("RPC failed, using fallback:", fetchError.message);

      const { data: allSummaries, error: sqlError } = await supabase
        .from("web_summaries")
        .select("id, url, summary, title, created_at, tags, embedding")
        .eq("user_id", user.id)
        .not("embedding", "is", null);

      if (sqlError) throw sqlError;
      if (!allSummaries || allSummaries.length === 0) {
        return NextResponse.json({ results: [] });
      }

      const scored = allSummaries
        .map((summary: any) => {
          const vec = parseStoredEmbedding(summary.embedding, queryEmbedding.length);
          if (!vec) return null;
          const similarity = cosineSimilarity(queryEmbedding, vec);
          const { embedding: _, ...rest } = summary;
          return { ...rest, similarity };
        })
        .filter((item: any): item is { similarity: number } & Record<string, unknown> =>
          item !== null
        )
        .sort((a: any, b: any) => b.similarity - a.similarity);

      const finalResults = applyTieredThreshold(scored as any[])
        .slice(0, limit)
        .map(({ similarity: _s, ...rest }: any) => rest);

      return NextResponse.json({ results: finalResults });
    }

    const ranked = (summaries || []).map((item: any) => ({
      ...item,
      similarity: Number(item.similarity),
    }));
    const finalResults = applyTieredThreshold(ranked)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ similarity: _s, ...rest }: any) => rest);

    return NextResponse.json({ results: finalResults });
  } catch (error: any) {
    console.error("Error performing vector search:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to perform search" },
      { status: 500 }
    );
  }
}
