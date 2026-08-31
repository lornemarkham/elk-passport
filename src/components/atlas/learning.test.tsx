import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LearningList } from "./learning";
import type { LearningOpportunity } from "@/lib/knowledge/learningOpportunities";

/**
 * **Information, not a question.**
 *
 * These proposals survived extraction and Atlas's own validation and were
 * withheld only because none could be proven to describe the entity the page
 * was read for. Atlas does not know whether any is a distinct real thing,
 * whether it already exists, or how it relates — so it has not earned the
 * right to ask (ADR 045), and the panel offers nothing to click.
 */
const opportunity = (
  sources: LearningOpportunity["sources"],
): LearningOpportunity =>
  ({
    entityId: "big-white",
    entityName: "Big White Ski Resort",
    sources,
    discovered: sources.length,
    processed: sources.length,
    unread: 0,
    applied: 0,
    readNotApplied: sources.length,
    rejected: 0,
    failed: 0,
    learningAreas: [],
    publishers: ["bigwhite.com"],
    complete: true,
    learnedNothing: true,
  }) as unknown as LearningOpportunity;

const source = (
  id: string,
  withheld?: { kind: string; name: string }[],
): LearningOpportunity["sources"][number] =>
  ({
    id,
    url: `https://www.bigwhite.com/${id}`,
    host: "bigwhite.com",
    sourceType: "official-website",
    reason: "The dining directory.",
    area: "Dining",
    status: "queued",
    state: "read-not-applied",
    alsoTeaches: 0,
    withheld,
  }) as unknown as LearningOpportunity["sources"][number];

describe("what a read described and Atlas did not create", () => {
  it("names each thing with its kind, and totals them", () => {
    render(
      <LearningList
        opportunities={[
          opportunity([
            source("explore/food-dining", [
              { kind: "Activity", name: "Horse Drawn Sleigh Dining Tours" },
              { kind: "Activity", name: "Shopping Shuttle" },
            ]),
          ]),
        ]}
        unattributed={[]}
      />,
    );
    expect(
      screen.getByText(/Also described, and not created — 2/),
    ).toBeTruthy();
    expect(screen.getByText("Horse Drawn Sleigh Dining Tours")).toBeTruthy();
    expect(screen.getByText("Shopping Shuttle")).toBeTruthy();
  });

  it("offers no action — this is not a decision Atlas has earned", () => {
    render(
      <LearningList
        opportunities={[
          opportunity([
            source("explore/food-dining", [
              { kind: "Organization", name: "On-Mountain Restaurants" },
            ]),
          ]),
        ]}
        unattributed={[]}
      />,
    );
    // No control of any kind: nothing to accept, create, dismiss or reject.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText(/I do not want this/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
  });

  it("says nothing at all about a page Atlas never interpreted", () => {
    // The legacy case. Absence must not render as "0 described".
    const { container } = render(
      <LearningList
        opportunities={[opportunity([source("summer")])]}
        unattributed={[]}
      />,
    );
    expect(container.textContent).not.toMatch(/Also described/);
  });

  it("says nothing when a recorded interpretation found nothing", () => {
    const { container } = render(
      <LearningList
        opportunities={[opportunity([source("summer", [])])]}
        unattributed={[]}
      />,
    );
    expect(container.textContent).not.toMatch(/Also described/);
  });
});
