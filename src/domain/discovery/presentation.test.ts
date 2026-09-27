import { describe, expect, it } from "vitest";
import {
  byDay,
  hasMedia,
  knownFacts,
  leadOf,
  withoutLead,
} from "./presentation";
import type { DiscoveryUnit } from "./discoveryUnits";
import type { Experience } from "@/domain/experience/types";

/**
 * Presentation must never become ranking.
 *
 * These pin the one property that keeps that true: the lane's order is
 * temporal truth and nothing in here is allowed to reorder it. The large slot
 * is chosen from what is *known* about a record, which is a fact, rather than
 * from what anyone thinks of it, which the corpus cannot support.
 */

function unit(
  id: string,
  title: string,
  extra: Partial<Experience> = {},
  options: Experience[] = [],
): DiscoveryUnit {
  return {
    head: {
      id,
      slug: id,
      title,
      kind: "Event",
      subtype: "Event",
      shortDescription: "",
      regionIds: [],
      ...extra,
    } as Experience,
    options,
  };
}

const withPicture = {
  heroMedia: {
    type: "image" as const,
    src: "https://example.test/a.jpg",
    alt: "",
  },
};

describe("presentation", () => {
  it("gives the large slot to the soonest thing that can carry a picture", () => {
    const lane = [
      unit("a", "No picture"),
      unit("b", "Has a picture", withPicture),
      unit("c", "Also has one", withPicture),
    ];
    expect(leadOf(lane)!.head.id).toBe("b");
  });

  it("falls back to the soonest when nothing has a picture", () => {
    const lane = [unit("a", "First"), unit("b", "Second")];
    expect(leadOf(lane)!.head.id).toBe("a");
  });

  it("never reorders the lane", () => {
    // The rest keeps its temporal order even when the lead is taken from the
    // middle of it. Soonest-first is truth, not a display preference.
    const lane = [
      unit("a", "First"),
      unit("b", "Second", withPicture),
      unit("c", "Third"),
    ];
    expect(withoutLead(lane).map((u) => u.head.id)).toEqual(["a", "c"]);
  });

  it("has nothing to lead with when the lane is empty", () => {
    expect(leadOf([])).toBeUndefined();
    expect(withoutLead([])).toEqual([]);
  });

  it("counts what is known without judging it", () => {
    expect(knownFacts(unit("a", "Bare"))).toBe(0);
    expect(
      knownFacts(
        unit("b", "Full", {
          ...withPicture,
          startTime: "2026-10-17T19:00:00Z",
          shortDescription: "Something",
        }),
      ),
    ).toBe(3);
    expect(hasMedia(unit("c", "Pic", withPicture))).toBe(true);
    expect(hasMedia(unit("d", "None"))).toBe(false);
  });

  it("files a lane under the day each thing next happens", () => {
    const lane = [
      unit("a", "Later", { startTime: "2026-10-20T02:00:00Z" }),
      unit("b", "Sooner", { startTime: "2026-10-18T02:00:00Z" }),
      unit("c", "Same day as b", { startTime: "2026-10-18T05:00:00Z" }),
    ];
    const days = byDay(lane, "2026-10-17");
    expect(days.map((d) => d.day)).toEqual(["2026-10-17", "2026-10-19"]);
    // Grouped, not duplicated: two things on one day share one heading.
    expect(days[0]!.units).toHaveLength(2);
  });

  it("leaves out anything with no day ahead rather than inventing one", () => {
    const undated = unit("x", "No date at all");
    expect(byDay([undated], "2026-10-17")).toEqual([]);
  });

  it("files a grouped attraction under its next night, once", () => {
    // Eight nights must produce one row under the next one, not eight rows.
    const nights = {
      availability: {
        basis: "stated-days" as const,
        days: ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-31"],
      },
    };
    const haunt = unit("h", "A Haunt", nights, [
      { id: "h-1", title: "Evening Haunt" } as Experience,
    ]);
    const days = byDay([haunt], "2026-10-17");
    expect(days).toHaveLength(1);
    expect(days[0]!.day).toBe("2026-10-17");
  });
});
