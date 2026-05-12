import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  calculateRelevanceScore,
  findRelatedSummaries,
  type SummaryItemForSimilarity,
} from "./similarity";

const selected: SummaryItemForSimilarity = {
  id: "selected",
  url: "https://example.com/selected",
  title: "Selected summary",
  summary: "A detailed summary about machine learning workflows.",
  tags: [{ id: "tag-1", name: "AI", color: "#000000" }],
};

const related: SummaryItemForSimilarity = {
  id: "related",
  url: "https://example.com/related",
  title: "Related summary",
  summary: "Another summary about machine learning pipelines.",
  tags: [{ id: "tag-1", name: "AI", color: "#000000" }],
};

const unrelated: SummaryItemForSimilarity = {
  id: "unrelated",
  url: "https://example.com/unrelated",
  title: "Unrelated summary",
  summary: "Gardening tips for spring planting.",
};

describe("similarity", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ similarity: 0.8 }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns zero when either summary is too short for comparison", async () => {
    await expect(
      calculateRelevanceScore(
        { ...selected, title: "", summary: "short" },
        { ...related, title: "", summary: "also" },
      ),
    ).resolves.toBe(0);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("boosts relevance when summaries share tags", async () => {
    const score = await calculateRelevanceScore(selected, related);

    expect(score).toBeGreaterThan(0.75);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns related summaries sorted by relevance score", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as {
          text1: string;
          text2: string;
        };

        const similarity = body.text2.includes("machine learning") ? 0.9 : 0.1;

        return {
          ok: true,
          json: async () => ({ similarity }),
        };
      }),
    );

    const results = await findRelatedSummaries(selected, [related, unrelated], 5, 0.25);

    expect(results).toHaveLength(1);
    expect(results[0]?.item.id).toBe("related");
    expect(results[0]?.score).toBeGreaterThanOrEqual(0.25);
  });
});
