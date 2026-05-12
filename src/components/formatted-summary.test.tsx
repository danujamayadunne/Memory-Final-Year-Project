// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormattedSummary } from "./formatted-summary";

describe("FormattedSummary", () => {
  it("strips intro phrases and renders bullet items", () => {
    render(
      <FormattedSummary content={"Summary:\n- First point\n- Second point"} />,
    );

    expect(screen.queryByText(/^Summary:/i)).not.toBeInTheDocument();
    expect(screen.getByText("First point")).toBeInTheDocument();
    expect(screen.getByText("Second point")).toBeInTheDocument();
  });

  it("renders prose paragraphs when the summary has no bullets", () => {
    render(
      <FormattedSummary content="First sentence. Second sentence continues the thought." />,
    );

    expect(
      screen.getByText("First sentence. Second sentence continues the thought."),
    ).toBeInTheDocument();
  });
});
