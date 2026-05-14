import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { embeddingCache } from "./embedding-cache";

describe("embeddingCache", () => {
  beforeEach(() => {
    embeddingCache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes cache keys before storing embeddings", () => {
    const embedding = [0.1, 0.2, 0.3];

    embeddingCache.set("  Hello World  ", embedding);

    expect(embeddingCache.get("hello world")).toEqual(embedding);
  });

  it("expires cached embeddings after the TTL", () => {
    const embedding = [0.4, 0.5, 0.6];

    embeddingCache.set("memory query", embedding);
    vi.advanceTimersByTime(6 * 60 * 60 * 1000 + 1);

    expect(embeddingCache.get("memory query")).toBeNull();
  });
});
