import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { encrypt, decrypt } from "@/lib/ai/encryption";
import { getAllUserKeys } from "@/lib/ai/keys";
import type { AIProvider } from "@/lib/ai/provider";

const VALID_PROVIDERS: AIProvider[] = ["openai", "anthropic", "custom"];

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await getAllUserKeys(supabase, user.id);

    const sanitized = keys.map((k) => ({
      id: k.id,
      provider: k.provider,
      model_id: k.model_id,
      base_url: k.base_url,
      label: k.label,
      is_active: k.is_active,
      key_hint: maskKey(decrypt(k.encrypted_key)),
      created_at: k.created_at,
      updated_at: k.updated_at,
    }));

    return NextResponse.json({ keys: sanitized });
  } catch (e: any) {
    console.error("[GET /api/settings/api-keys]", e);
    return NextResponse.json(
      { error: e?.message || "Failed to fetch keys" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { provider, apiKey, modelId, baseUrl, label } = body;

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) {
      return NextResponse.json(
        { error: "API key is required and must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (provider === "custom" && !baseUrl) {
      return NextResponse.json(
        { error: "Base URL is required for custom providers" },
        { status: 400 }
      );
    }

    const encrypted = encrypt(apiKey.trim());

    const { data: existing } = await supabase
      .from("user_api_keys")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("user_api_keys")
        .update({
          encrypted_key: encrypted,
          model_id: modelId || null,
          base_url: baseUrl || null,
          label: label || null,
          is_active: true,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);

      if (error) throw error;
    } else {
      await supabase
        .from("user_api_keys")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .neq("provider", provider);

      const { error } = await supabase.from("user_api_keys").insert({
        user_id: user.id,
        provider,
        encrypted_key: encrypted,
        model_id: modelId || null,
        base_url: baseUrl || null,
        label: label || null,
        is_active: true,
      });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[POST /api/settings/api-keys]", e);
    return NextResponse.json(
      { error: e?.message || "Failed to save key" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Key ID required" }, { status: 400 });
    }

    await supabase
      .from("user_api_keys")
      .update({ is_active: false })
      .eq("user_id", user.id);

    const { error } = await supabase
      .from("user_api_keys")
      .update({ is_active: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[PUT /api/settings/api-keys]", e);
    return NextResponse.json(
      { error: e?.message || "Failed to activate key" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Key ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_api_keys")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[DELETE /api/settings/api-keys]", e);
    return NextResponse.json(
      { error: e?.message || "Failed to delete key" },
      { status: 500 }
    );
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}
