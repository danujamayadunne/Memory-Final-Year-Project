import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp, { type OutputInfo } from "sharp";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY as string;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

type ImageAnalysis = {
  description: string;
  tags: string[];
};

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

async function ensureSupportedFormat(buffer: Buffer, mimeType: string) {
  if (SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    return { buffer, mimeType };
  }

  const converted = await sharp(buffer).png().toBuffer();
  return {
    buffer: converted,
    mimeType: "image/png",
  };
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string; binary: Buffer }> {
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:(.*?);base64,(.*)$/);
    if (!match) {
      throw new Error("Invalid data URL");
    }
    const [, mimeType, data] = match;
    const rawBuffer = Buffer.from(data, "base64");
    const normalized = await ensureSupportedFormat(rawBuffer, mimeType || "image/png");
    return {
      base64: normalized.buffer.toString("base64"),
      mimeType: normalized.mimeType,
      binary: normalized.buffer,
    };
  }

  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "Accept":
        "image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }

  const mimeType =
    response.headers.get("content-type") || inferMimeTypeFromUrl(imageUrl);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const normalized = await ensureSupportedFormat(buffer, mimeType);

  return {
    base64: normalized.buffer.toString("base64"),
    mimeType: normalized.mimeType,
    binary: normalized.buffer,
  };
}

function inferMimeTypeFromUrl(url: string): string {
  const lowered = url.toLowerCase();
  if (lowered.endsWith(".png")) return "image/png";
  if (lowered.endsWith(".webp")) return "image/webp";
  if (lowered.endsWith(".gif")) return "image/gif";
  if (lowered.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

async function analyzeImage(base64Image: string, mimeType: string): Promise<ImageAnalysis> {
  if (!genAI) throw new Error("Missing GOOGLE_GEMINI_API_KEY");

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt =
    `You are labeling an image for a personal knowledge base. ` +
    `Return ONLY valid minified JSON with two keys: "description" and "tags". ` +
    `"description" must be 1-2 complete sentences in English describing the image. ` +
    `"tags" must be an array of exactly 3 concise English tags (single words or short phrases). ` +
    `Example: {"description":"...","tags":["tag1","tag2","tag3"]}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
    }, { signal: controller.signal });

    clearTimeout(timeoutId);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Failed to parse image analysis response");
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const description =
        typeof parsed.description === "string"
          ? parsed.description.trim()
          : "";
      const tags = Array.isArray(parsed.tags)
        ? parsed.tags
            .map((tag: unknown) =>
              typeof tag === "string" ? tag.trim() : ""
            )
            .filter((tag: string) => tag.length > 0)
            .slice(0, 3)
        : [];

      return {
        description,
        tags,
      };
    } catch (error) {
      throw new Error("Invalid JSON returned from image analysis");
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.message?.includes("model is overloaded")) {
      throw new Error("Image analysis service is temporarily unavailable. Please try again in a moment.");
    }
    if (error?.name === "AbortError") {
      throw new Error("Image analysis timed out. Please try again.");
    }
    throw error;
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GOOGLE_GEMINI_API_KEY");
  }

  const payload = text.slice(0, 8000);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: payload }] },
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

  return data.embedding.values as number[];
}

function sanitizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(tag);
    }
  }

  return unique.slice(0, 5);
}

function rgbToColorTag(r: number, g: number, b: number): string | null {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let hue = 0;

  if (delta !== 0) {
    if (max === rn) {
      hue = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      hue = (bn - rn) / delta + 2;
    } else {
      hue = (rn - gn) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  if (saturation < 0.15) {
    if (lightness > 0.8) return "Color: White";
    if (lightness < 0.2) return "Color: Black";
    return "Color: Gray";
  }

  if (lightness < 0.25 && saturation < 0.4) {
    return "Color: Black";
  }

  if (lightness < 0.4 && hue >= 15 && hue <= 50) {
    return "Color: Brown";
  }

  if (hue >= 345 || hue < 15) return "Color: Red";
  if (hue < 45) return "Color: Orange";
  if (hue < 70) return "Color: Yellow";
  if (hue < 170) return "Color: Green";
  if (hue < 200) return "Color: Teal";
  if (hue < 255) return "Color: Blue";
  if (hue < 300) return "Color: Purple";
  if (hue < 345) return "Color: Pink";

  return "Color: Red";
}

async function extractDominantColorTag(buffer: Buffer): Promise<string | null> {
  try {
    const { data } = (await sharp(buffer)
      .resize(1, 1, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })) as { data: Buffer; info: OutputInfo };

    const [r, g, b] = data;
    return rgbToColorTag(r, g, b);
  } catch (error) {
    console.warn("Failed to extract dominant color:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, sourceUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "Invalid imageUrl" }, { status: 400 });
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

    const { base64, mimeType, binary } = await fetchImageAsBase64(imageUrl);
    const analysis = await analyzeImage(base64, mimeType);
    const colorTag = await extractDominantColorTag(binary);
    const tags = sanitizeTags([
      ...analysis.tags,
      ...(colorTag ? [colorTag] : []),
    ]);

    const { data, error } = await supabase
      .from("image_memories")
      .insert({
        user_id: user.id,
        image_url: imageUrl,
        source_url: sourceUrl || null,
        description: analysis.description,
        tags: tags,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const embeddingInput = `${analysis.description}\nTags: ${tags.join(", ")}`.trim();

    if (embeddingInput.length > 10) {
      generateEmbedding(embeddingInput)
        .then(async (embedding) => {
          const vectorString = `[${embedding.join(",")}]`;
          await supabase
            .from("image_memories")
            .update({ embedding: vectorString })
            .eq("id", data.id)
            .eq("user_id", user.id);
        })
        .catch((embeddingError) => {
          console.error("Error generating image embedding:", embeddingError);
        });
    }

    return NextResponse.json({
      item: {
        ...data,
        tags,
      },
    });
  } catch (error: any) {
    console.error("Image upload failed:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}


