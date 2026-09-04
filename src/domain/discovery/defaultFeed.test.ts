import { describe, expect, it } from "vitest";
import {
  defaultFeed,
  feedExclusion,
  availableKinds,
  kindLabel,
} from "./defaultFeed";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

const make = (over: Partial<DiscoveryCandidate>) =>
  candidateToExperience({
    id: "id-1",
    kind: "Place",
    name: "Somewhere",
    description: "A description Atlas actually holds.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    ...over,
  });

describe("default feed policy", () => {
  it("A · drops an Activity whose name is only its own type, structurally", () => {
    // No name list anywhere — `Snowboarding` of type `Snowboarding`.
    expect(
      feedExclusion(
        make({
          kind: "Activity",
          name: "Snowboarding",
          subtype: "Snowboarding",
        }),
      ),
    ).toBe("generic-activity");
    expect(
      feedExclusion(
        make({ kind: "Activity", name: "camping", subtype: "camping" }),
      ),
    ).toBe("generic-activity");
  });

  it("A · keeps an Activity whose name says more than its type", () => {
    expect(
      feedExclusion(
        make({
          kind: "Activity",
          name: "Fairy Doors Tour",
          subtype: "self-guided tour",
          heroUrl: "x",
        }),
      ),
    ).toBeUndefined();
  });

  it("B · drops infrastructure and institutions by the source's own subtype", () => {
    expect(
      feedExclusion(make({ name: "Trail Patking", subtype: "parking" })),
    ).toBe("infrastructure-or-institution");
    expect(
      feedExclusion(
        make({
          kind: "Organization",
          name: "Okanagan College",
          subtype: "Educational Institution",
        }),
      ),
    ).toBe("infrastructure-or-institution");
  });

  it("C · UNKNOWN is never a blanket exclusion — a substantial one survives", () => {
    // `Big White` and `Rhonda Lake` are unclassified and carry photographs.
    // No named exception exists for either.
    expect(
      feedExclusion(
        make({ name: "Big White", subtype: "unknown", heroUrl: "photo.jpg" }),
      ),
    ).toBeUndefined();
    expect(
      feedExclusion(
        make({ name: "Rhonda Lake", subtype: "unknown", heroUrl: "photo.jpg" }),
      ),
    ).toBeUndefined();
  });

  it("C · an unclassified record Atlas knows nothing else about leaves the feed", () => {
    expect(
      feedExclusion(make({ name: "Vernon city centre", subtype: "unknown" })),
    ).toBe("unclassified-and-thin");
  });

  it("C · unclassified survives on context or containment, not only on media", () => {
    expect(
      feedExclusion(
        make({
          name: "Somewhere",
          subtype: "unknown",
          context: { id: "p", kind: "Place", name: "Big White Ski Resort" },
        }),
      ),
    ).toBeUndefined();
    expect(
      feedExclusion(
        make({ name: "Somewhere", subtype: "unknown", containsCount: 3 }),
      ),
    ).toBeUndefined();
  });

  it("D · a specific but bare Activity leaves the feed — the night-skiing case", () => {
    expect(
      feedExclusion(
        make({ kind: "Activity", name: "night skiing", subtype: "skiing" }),
      ),
    ).toBe("activity-without-substance");
  });

  it("D · derives generically — a different bare Activity behaves identically", () => {
    expect(
      feedExclusion(
        make({
          kind: "Activity",
          name: "Kids snowmobile rides",
          subtype: "snowmobiling",
        }),
      ),
    ).toBe("activity-without-substance");
  });

  it("never uses media as a proxy for importance on a classified Place", () => {
    // Kekuli Bay Provincial Park: no photograph, no context, and it stays,
    // because Atlas can say what it is.
    expect(
      feedExclusion(
        make({
          name: "Kekuli Bay Provincial Park",
          subtype: "provincial park",
        }),
      ),
    ).toBeUndefined();
  });

  it("does not depend on detail readiness", () => {
    const bare = make({
      name: "Kekuli Bay Provincial Park",
      subtype: "provincial park",
    });
    expect(bare.detailReady).toBe(false);
    expect(feedExclusion(bare)).toBeUndefined();
  });

  it("defaultFeed selects membership without reordering", () => {
    const list = [
      make({ id: "a", name: "Kalamalka Lake Park", subtype: "park" }),
      make({ id: "b", kind: "Activity", name: "camping", subtype: "camping" }),
      make({ id: "c", name: "Ellison Park", subtype: "park" }),
    ];
    expect(defaultFeed(list).map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("offers browse kinds from the real corpus, in plain language", () => {
    const list = [
      make({ kind: "Place" }),
      make({ kind: "Organization" }),
      make({ kind: "Activity" }),
    ];
    expect(availableKinds(list)).toEqual(["Place", "Organization", "Activity"]);
    expect(kindLabel("Activity")).toBe("Things to do");
    expect(availableKinds([make({ kind: "Place" })])).toEqual(["Place"]);
  });
});
