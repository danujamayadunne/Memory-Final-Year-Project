import { describe, expect, it } from "vitest";

import { markdownToTiptapWithCitation } from "./tiptap-editor";

describe("markdownToTiptapWithCitation", () => {
  it("appends a Harvard-style citation blockquote to converted markdown", () => {
    const html = markdownToTiptapWithCitation(
      "- First point\n- Second point",
      "https://example.com/article",
      "Example Article",
    );

    expect(html).toContain("<ul>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("Example Article");
    expect(html).toContain('href="https://example.com/article"');
    expect(html).toContain("Available at:");
  });
});
