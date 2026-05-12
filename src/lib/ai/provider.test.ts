import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveConfig, type ProviderConfig } from "./provider";

describe("resolveConfig", () => {
  const originalGeminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  beforeEach(() => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GOOGLE_GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalGeminiKey === undefined) {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    } else {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalGeminiKey;
    }
  });

  it("returns the user config when one is provided", () => {
    const userConfig: ProviderConfig = {
      provider: "openai",
      apiKey: "user-key",
      modelId: "gpt-4o",
    };

    expect(resolveConfig(userConfig)).toEqual(userConfig);
  });

  it("falls back to Gemini when no user config is provided", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "gemini-key";

    expect(resolveConfig(null)).toEqual({
      provider: "gemini",
      apiKey: "gemini-key",
      modelId: "gemini-2.5-flash",
    });
  });

  it("throws when no provider is configured", () => {
    expect(() => resolveConfig(null)).toThrow("No AI provider configured");
  });
});
