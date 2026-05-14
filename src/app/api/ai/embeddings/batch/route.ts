import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { generateEmbedding } from "@/lib/ai/provider";
import { embeddingCache } from "@/lib/embedding-cache";

const MAX_CANDIDATES = 200;

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

export async function POST(req: NextRequest) {
  try {
    const { text, candidates } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Field 'text' is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json(
        { error: "Field 'candidates' must be a non-empty array of strings" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cleanCandidates = candidates
      .filter((c: unknown) => typeof c === "string" && c.trim().length > 0)
      .slice(0, MAX_CANDIDATES) as string[];

    const uniqueTexts = Array.from(new Set([text, ...cleanCandidates]));

    const embeddings = await Promise.all(
      uniqueTexts.map((t) => embeddingCache.getOrCompute(t, generateEmbedding))
    );

    const embeddingMap = new Map<string, number[]>();
    uniqueTexts.forEach((t, i) => embeddingMap.set(t, embeddings[i]));

    const sourceVec = embeddingMap.get(text);
    if (!sourceVec) {
      return NextResponse.json(
        { error: "Failed to embed source text" },
        { status: 500 }
      );
    }

    const similarities = cleanCandidates.map((c) => {
      const vec = embeddingMap.get(c);
      return vec ? cosineSimilarity(sourceVec, vec) : 0;
    });

    return NextResponse.json({ similarities });
  } catch (error: unknown) {
    console.error("Error in batch similarity:", error);
    const message =
      error instanceof Error ? error.message : "Failed to compute batch similarity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
