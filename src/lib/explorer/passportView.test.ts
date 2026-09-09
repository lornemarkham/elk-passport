import { describe, expect, it } from "vitest";
import type { GeographicScope } from "@/domain/discovery/geographicScope";
import type { DiscoveryVerdict } from "@/lib/data/explorer-dossier-repo";
import { passportView } from "./passportView";

/**
 * Each case is a real entity from the live Okanagan corpus, because the
 * point of this panel is explaining live disappointments rather than
 * hypothetical ones.
 */

const OKANAGAN: GeographicScope = {
  kind: "atlas-region",
  regionId: "region-okanagan",
  label: "Okanagan",
};

const candidate = (
  overrides: Partial<NonNullable<DiscoveryVerdict["candidate"]>> = {},
): DiscoveryVerdict => ({
  candidate: {
    id: "e1",
    kind: "Place",
    name: "Kalamalka Lake Park",
    subtype: "park",
    description: "A park.",
    heroUrl: "https://example.test/a.jpg",
    mediaCount: 3,
    coordinates: [-119.3, 50.2],
    containsCount: 0,
    regionIds: ["region-okanagan"],
    ...overrides,
  },
});

describe("passportView", () => {
  it("reports Atlas's own suppression, before any Passport rule runs", () => {
    const view = passportView(
      {
        suppressed: {
          id: "e1",
          kind: "Place",
          name: "Kalamalka Lake Provincial Park and Protected Area",
          reason: "no-description",
        },
      },
      OKANAGAN,
    );

    expect(view.stage).toBe("suppressed-by-atlas");
    expect(view.suppressionReason).toBe("no-description");
    expect(view.candidate).toBeUndefined();
  });

  it("names the region scope when Atlas has placed the entity nowhere", () => {
    const view = passportView(candidate({ regionIds: [] }), OKANAGAN);

    expect(view.stage).toBe("outside-scope");
    expect(view.explanation).toContain("Okanagan");
    expect(view.regionIds).toEqual([]);
  });

  it("reports the feed rule that excluded an in-scope candidate", () => {
    const view = passportView(
      candidate({
        kind: "Activity",
        name: "Snowboarding",
        subtype: "Snowboarding",
        heroUrl: undefined,
        coordinates: undefined,
      }),
      OKANAGAN,
    );

    expect(view.stage).toBe("excluded-from-feed");
    expect(view.feedExclusion).toBe("generic-activity");
  });

  it("says an entity is in the feed, and where its card leads", () => {
    const view = passportView(candidate(), OKANAGAN);

    expect(view.stage).toBe("in-feed");
    expect(view.destination).toBe("/places/e1");
    expect(view.detailReady).toBe(true);
  });

  it("distinguishes a shown card with nowhere to go", () => {
    const view = passportView(
      candidate({
        kind: "Organization",
        name: "The BullWheel",
        subtype: "bar",
        coordinates: undefined,
      }),
      OKANAGAN,
    );

    expect(view.stage).toBe("in-feed");
    expect(view.destination).toBeUndefined();
    expect(view.explanation).toContain("no Passport page exists");
  });

  it("treats no active scope as looking everywhere rather than as a failure", () => {
    const view = passportView(candidate({ regionIds: [] }), undefined);

    expect(view.stage).toBe("in-feed");
    expect(view.inScope).toBe(true);
  });
});
