import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { embeddingCache } from "@/lib/embedding-cache";
import { generateEmbedding } from "@/lib/ai/provider";

const COLOR_KEYWORDS = [
  "red", "green", "blue", "yellow", "orange", "purple",
  "pink", "brown", "black", "white", "gray", "grey",
  "cyan", "magenta", "teal",
];

const SIMILARITY_STRICT = 0.65;
const SIMILARITY_RELAXED = 0.5;

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;
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

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    if (!bodyText.trim()) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    let parsed: { query?: string; limit?: number };
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const { query, limit = 48 } = parsed;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trimmedQuery = query.trim();
    const queryLower = trimmedQuery.toLowerCase();
    const queryColors = COLOR_KEYWORDS.filter((color) =>
      queryLower.includes(color)
    );

    const directLookupColumns = "id, image_url, source_url, description, tags, created_at";

    const matchesColorRequirement = (item: any) => {
      if (queryColors.length === 0) return true;
      const description = item.description?.toLowerCase() || "";
      const tags = Array.isArray(item.tags)
        ? item.tags.map((tag: string) => tag.toLowerCase())
        : [];
      return queryColors.some(
        (color) =>
          description.includes(color) ||
          tags.some((tag: string) => tag.includes(color))
      );
    };

    const { data: directHits, error: directError } = await supabase
      .from("image_memories")
      .select(directLookupColumns)
      .eq("user_id", user.id)
      .ilike("description", `%${queryLower}%`)
      .limit(limit);

    if (directError) throw directError;

    if (directHits && directHits.length > 0) {
      const filtered = directHits.filter(matchesColorRequirement);
      if (filtered.length > 0) {
        return NextResponse.json({ results: filtered });
      }
    }

    const queryEmbedding = await embeddingCache.getOrCompute(
      trimmedQuery,
      generateEmbedding
    );

    const { data: rows, error } = await supabase
      .from("image_memories")
      .select(`${directLookupColumns}, embedding`)
      .eq("user_id", user.id)
      .not("embedding", "is", null);

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const ranked = rows
      .map((row: any) => {
        const vec = parseStoredEmbedding(row.embedding, queryEmbedding.length);
        if (!vec) return null;
        const similarity = cosineSimilarity(queryEmbedding, vec);
        const { embedding: _, ...rest } = row;
        return { ...rest, similarity };
      })
      .filter((item: any): item is { similarity: number } & Record<string, unknown> =>
        item !== null
      )
      .filter(matchesColorRequirement)
      .sort((a: any, b: any) => b.similarity - a.similarity);

    const strict = ranked.filter((item: any) => item.similarity >= SIMILARITY_STRICT);
    const thresholded =
      strict.length > 0
        ? strict
        : ranked.filter((item: any) => item.similarity >= SIMILARITY_RELAXED);

    const limited = thresholded
      .slice(0, limit)
      .map(({ similarity: _s, ...rest }: any) => rest);

    return NextResponse.json({ results: limited });
  } catch (error: any) {
    console.error("Error performing image semantic search:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to perform semantic search" },
      { status: 500 }
    );
  }
}
