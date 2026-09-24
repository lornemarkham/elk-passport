import { describe, expect, it } from "vitest";
import { destinationFor } from "./destination";
import { candidateToExperience } from "./atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: "id-1",
  kind: "Place",
  name: "Somewhere",
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});

describe("destinationFor", () => {
  it("sends a detail-ready Place to its own specialised page", () => {
    const experience = candidateToExperience(
      candidate({
        kind: "Place",
        name: "Ellison Park",
        heroUrl: "https://example.com/ellison.jpg",
        coordinates: [-119.44, 50.18],
      }),
    );
    expect(experience.detailReady).toBe(true);
    expect(destinationFor(experience)).toBe("/places/id-1");
  });

  it("never sends an Organization to /places/{organizationId}", () => {
    const experience = candidateToExperience(
      candidate({
        id: "org-bullwheel",
        kind: "Organization",
        name: "The BullWheel",
      }),
    );
    expect(destinationFor(experience)).not.toBe("/places/org-bullwheel");
  });

  it("sends an Organization to its own traveller page", () => {
    const experience = candidateToExperience(
      candidate({
        id: "org-black-mountain",
        kind: "Organization",
        name: "Black Mountain Haunted House",
      }),
    );
    expect(destinationFor(experience)).toBe("/passport/org-black-mountain");
  });

  it("sends an Activity to its own traveller page", () => {
    const experience = candidateToExperience(
      candidate({
        id: "activity-night-skiing",
        kind: "Activity",
        name: "night skiing",
      }),
    );
    expect(destinationFor(experience)).toBe("/passport/activity-night-skiing");
  });

  it("sends an Event to its own traveller page, dated or not", () => {
    const dated = candidateToExperience(
      candidate({
        id: "event-fireworks",
        kind: "Event",
        name: "Saturday Night Fireworks",
        startTime: "2026-10-31T02:00:00.000Z",
      }),
    );
    const undated = candidateToExperience(
      candidate({ id: "event-undated", kind: "Event", name: "Someday" }),
    );
    expect(destinationFor(dated)).toBe("/passport/event-fireworks");
    // The date decided whether it could be opened at all, which made an
    // undated Event a dead card for no reason it could do anything about.
    expect(destinationFor(undated)).toBe("/passport/event-undated");
  });

  it("gives a thin Place a page it can actually fill, rather than none", () => {
    const experience = candidateToExperience(
      candidate({
        kind: "Place",
        name: "Kekuli Bay Provincial Park",
        coordinates: [-119.34, 50.18],
      }),
    );
    // Readiness still chooses *which* page. It no longer decides whether the
    // thing is reachable — those were always two different questions.
    expect(experience.detailReady).toBe(false);
    expect(destinationFor(experience)).toBe("/passport/id-1");
  });

  it("goes to the thing itself, not to whatever contains it", () => {
    const bullwheel = candidateToExperience(
      candidate({
        id: "org-bullwheel",
        kind: "Organization",
        name: "The BullWheel",
        context: {
          id: "place-bigwhite",
          kind: "Place",
          name: "Big White Ski Resort",
        },
      }),
    );
    // Landing on Big White was the best answer available while Organizations
    // had no page of their own. They do, so a card for The BullWheel opens
    // The BullWheel; its context still explains where that is.
    expect(destinationFor(bullwheel)).toBe("/passport/org-bullwheel");
    expect(bullwheel.context?.name).toBe("Big White Ski Resort");
  });

  it("leaves nothing Atlas holds without a destination", () => {
    const kinds = ["Place", "Organization", "Activity", "Event"] as const;
    for (const kind of kinds) {
      for (const rich of [true, false]) {
        const experience = candidateToExperience(
          candidate({
            id: `${kind}-${rich}`,
            kind,
            name: `A ${kind}`,
            heroUrl: rich ? "https://example.com/x.jpg" : undefined,
            coordinates: rich ? [-119.4, 49.8] : undefined,
          }),
        );
        expect(destinationFor(experience)).toBeTruthy();
      }
    }
  });
});

describe("candidateToExperience", () => {
  it("keeps candidacy independent of detail readiness", () => {
    const experience = candidateToExperience(
      candidate({ kind: "Activity", name: "night skiing", subtype: "skiing" }),
    );
    // It became an Experience — i.e. it is a candidate — while having nowhere
    // near enough content for a page.
    expect(experience.kind).toBe("Activity");
    expect(experience.detailReady).toBe(false);
  });

  it("carries the subtype and the context Atlas derived, and invents no attributes", () => {
    const experience = candidateToExperience(
      candidate({
        kind: "Organization",
        subtype: "restaurant",
        context: {
          id: "place-bigwhite",
          kind: "Place",
          name: "Big White Ski Resort",
        },
      }),
    );
    expect(experience.subtype).toBe("restaurant");
    expect(experience.context?.name).toBe("Big White Ski Resort");
    // The fabricated attributes are gone: no invented season, companions,
    // duration or pet policy.
    expect(experience.seasons).toEqual([]);
    expect(experience.companions).toEqual([]);
    expect(experience.duration).toEqual({ minMinutes: 0, maxMinutes: 0 });
  });

  it("has no tier", () => {
    const experience = candidateToExperience(candidate({}));
    expect("tier" in experience).toBe(false);
  });
});

describe("card context and affordance data", () => {
  it("carries context only when Atlas supplies it", () => {
    const withCtx = candidateToExperience(
      candidate({
        kind: "Organization",
        name: "The BullWheel",
        context: {
          id: "place-bigwhite",
          kind: "Place",
          name: "Big White Ski Resort",
        },
      }),
    );
    const without = candidateToExperience(
      candidate({ kind: "Activity", name: "night skiing", subtype: "skiing" }),
    );
    expect(withCtx.context?.name).toBe("Big White Ski Resort");
    // Atlas holds no edge from night skiing to Big White, so Passport must
    // hold nothing either — no name inference, no region substitution.
    expect(without.context).toBeUndefined();
  });

  it("a context-bearing Organization navigates, and its context explains where", () => {
    const bullwheel = candidateToExperience(
      candidate({
        id: "org-bullwheel",
        kind: "Organization",
        name: "The BullWheel",
        context: {
          id: "place-bigwhite",
          kind: "Place",
          name: "Big White Ski Resort",
        },
      }),
    );
    expect(destinationFor(bullwheel)).toBe("/passport/org-bullwheel");
    expect(bullwheel.context?.name).toBe("Big White Ski Resort");
  });
});
