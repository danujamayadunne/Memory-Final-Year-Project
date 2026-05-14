import { decrypt } from "./encryption";
import type { ProviderConfig, AIProvider } from "./provider";
import type { createClient } from "@/lib/supabase/server";

export type AppSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type StoredKey = {
  id: string;
  provider: AIProvider;
  encrypted_key: string;
  model_id: string | null;
  base_url: string | null;
  label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getUserProviderConfig(
  supabase: AppSupabaseClient,
  userId: string
): Promise<ProviderConfig | null> {
  try {
    const { data, error } = await supabase
      .from("user_api_keys")
      .select("provider, encrypted_key, model_id, base_url")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      provider: data.provider as AIProvider,
      apiKey: decrypt(data.encrypted_key),
      modelId: data.model_id || undefined,
      baseUrl: data.base_url || undefined,
    };
  } catch {
    return null;
  }
}

export async function getAllUserKeys(
  supabase: AppSupabaseClient,
  userId: string
): Promise<StoredKey[]> {
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("id, provider, encrypted_key, model_id, base_url, label, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}
