import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { embeddingCache } from "@/lib/embedding-cache";

const COLOR_KEYWORDS = [
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "brown",
  "black",
  "white",
  "gray",
  "grey",
  "cyan",
  "magenta",
  "teal",
];

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY as string;

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

async function generateEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) {
    return cached;
  }

  if (!GEMINI_API_KEY) {
    throw new Error("Missing GOOGLE_GEMINI_API_KEY");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
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
  if (!data.embedding || !data.embedding.values) {
    throw new Error("Unexpected embedding response format");
  }

  const embedding = data.embedding.values;
  embeddingCache.set(text, embedding);
  return embedding;
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
    const queryEmbedding = await generateEmbedding(trimmedQuery);

    const { data: rows, error } = await supabase
      .from("image_memories")
      .select("id, image_url, source_url, description, tags, created_at, embedding")
      .eq("user_id", user.id)
      .not("embedding", "is", null);

    if (error) {
      throw error;
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ results: [] });
    }

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

    const directMatches = rows.filter((row) => {
      const description = row.description?.toLowerCase() || "";
      const tags = Array.isArray(row.tags)
        ? row.tags.some((tag: string) => tag.toLowerCase().includes(queryLower))
        : false;
      return (
        (description.includes(queryLower) || tags) &&
        matchesColorRequirement(row)
      );
    });

    if (directMatches.length > 0) {
      const unique = directMatches
        .slice(0, limit)
        .map(({ embedding, ...rest }) => rest);
      return NextResponse.json({ results: unique });
    }

    const ranked = rows
      .map((row: any) => {
        try {
          let storedVector: number[] | null = null;
          if (typeof row.embedding === "string") {
            storedVector = row.embedding
              .replace(/[\[\]]/g, "")
              .split(",")
              .map((value: string) => Number(value.trim()))
              .filter((value: number) => !Number.isNaN(value));
          } else if (Array.isArray(row.embedding)) {
            storedVector = row.embedding.map(Number);
          } else if (row.embedding && typeof row.embedding === "object") {
            storedVector = Object.values(row.embedding).map((value: any) => Number(value));
          }

          if (!storedVector || storedVector.length !== queryEmbedding.length) {
            return null;
          }

          const similarity = cosineSimilarity(queryEmbedding, storedVector);
          return {
            ...row,
            similarity,
          };
        } catch (err) {
          console.error("Failed to process embedding for image memory", err);
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter(matchesColorRequirement)
      .sort((a, b) => b.similarity - a.similarity);

    const strictMatches = ranked.filter((item) => item.similarity >= 0.65);
    const relaxedMatches = ranked.filter((item) => item.similarity >= 0.5);

    const thresholded =
      strictMatches.length > 0 ? strictMatches : relaxedMatches;

    const limited = thresholded.slice(0, limit);
    return NextResponse.json({
      results: limited.map(({ embedding, similarity, ...rest }) => rest),
    });
  } catch (error: any) {
    console.error("Error performing image semantic search:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to perform semantic search" },
      { status: 500 }
    );
  }
}


