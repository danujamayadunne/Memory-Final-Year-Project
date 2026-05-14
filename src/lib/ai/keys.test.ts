import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { encrypt } from "./encryption";
import { getAllUserKeys, getUserProviderConfig, type AppSupabaseClient } from "./keys";

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function createSupabaseMock(handlers: {
  activeKey?: QueryResult<{
    provider: string;
    encrypted_key: string;
    model_id: string | null;
    base_url: string | null;
  }>;
  allKeys?: QueryResult<
    Array<{
      id: string;
      provider: string;
      encrypted_key: string;
      model_id: string | null;
      base_url: string | null;
      label: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>
  >;
}) {
  return {
    from: (table: string) => {
      if (table !== "user_api_keys") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                single: async () => handlers.activeKey ?? { data: null, error: null },
              }),
            }),
            order: async () => handlers.allKeys ?? { data: [], error: null },
          }),
        }),
      };
    },
  };
}

describe("keys", () => {
  const originalSecret = process.env.ENCRYPTION_SECRET;

  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = "test-encryption-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ENCRYPTION_SECRET;
    } else {
      process.env.ENCRYPTION_SECRET = originalSecret;
    }
  });

  it("returns the active provider config with a decrypted API key", async () => {
    const apiKey = "sk-test-provider-key";
    const supabase = createSupabaseMock({
      activeKey: {
        data: {
          provider: "openai",
          encrypted_key: encrypt(apiKey),
          model_id: "gpt-4o",
          base_url: null,
        },
        error: null,
      },
    });

    const client = supabase as unknown as AppSupabaseClient;

    await expect(getUserProviderConfig(client, "user-1")).resolves.toEqual({
      provider: "openai",
      apiKey,
      modelId: "gpt-4o",
      baseUrl: undefined,
    });
  });

  it("returns null when no active key exists", async () => {
    const supabase = createSupabaseMock({
      activeKey: { data: null, error: { message: "not found" } },
    });

    await expect(
      getUserProviderConfig(supabase as unknown as AppSupabaseClient, "user-1")
    ).resolves.toBeNull();
  });

  it("returns all stored keys for a user", async () => {
    const supabase = createSupabaseMock({
      allKeys: {
        data: [
          {
            id: "key-1",
            provider: "openai",
            encrypted_key: encrypt("sk-one"),
            model_id: "gpt-4o",
            base_url: null,
            label: "Work",
            is_active: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        ],
        error: null,
      },
    });

    await expect(getAllUserKeys(supabase as unknown as AppSupabaseClient, "user-1")).resolves.toEqual([
      {
        id: "key-1",
        provider: "openai",
        encrypted_key: expect.any(String),
        model_id: "gpt-4o",
        base_url: null,
        label: "Work",
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });
});
