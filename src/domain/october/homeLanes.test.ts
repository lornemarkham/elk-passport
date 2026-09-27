import { describe, expect, it } from "vitest";
import { happeningThisWeekend, happeningTonight, upcoming } from "./calendar";
import { asDiscoveryUnits } from "@/domain/discovery/discoveryUnits";
import type { Experience } from "@/domain/experience/types";

/**
 * **October Home and Discover must not disagree about what a candidate is.**
 *
 * Home was already using the same windows; what it lacked was the grouping
 * step, so an attraction and its modes arrived as separate cards competing
 * with each other. These pin the composed shape of a Home lane — the pipeline
 * the page actually runs — rather than the window function on its own.
 *
 * Nothing here knows Black Mountain by id, title, publisher or URL. The fixture
 * is an attraction with two modes and stated nights, and it would behave the
 * same way if it were called anything else.
 */

const VANCOUVER_EVENING = (day: string) => new Date(`${day}T20:00:00-07:00`);

function thing(
  id: string,
  title: string,
  extra: Partial<Experience> = {},
): Experience {
  return {
    id,
    slug: id,
    title,
    kind: "Place",
    subtype: "Attraction",
    shortDescription: "",
    regionIds: [],
    ...extra,
  } as Experience;
}

/** The `includes` edge, one hop, exactly as Atlas serves it. */
const WHOLE = {
  id: "bm",
  kind: "Place" as const,
  name: "The Black Mountain Haunted House",
};

/** An attraction Atlas holds as three things: the whole, and two modes. */
const HAUNT = thing("bm", "The Black Mountain Haunted House");
const EVENING = thing("bm-evening", "Evening Haunt", {
  partOf: WHOLE,
  availability: {
    basis: "stated-days" as const,
    days: ["2026-10-16", "2026-10-17", "2026-10-31"],
  },
});
const FAMILY = thing("bm-family", "Family Fun Hours", {
  partOf: WHOLE,
  availability: { basis: "stated-days" as const, days: ["2026-10-17"] },
});

const CORPUS = [HAUNT, EVENING, FAMILY];

const tonightUnits = (day: string) =>
  asDiscoveryUnits(happeningTonight(CORPUS, VANCOUVER_EVENING(day)), CORPUS);

describe("October Home lanes, composed the way the page composes them", () => {
  it("shows one unit with both modes on the night both are open", () => {
    // Saturday October 17: Evening Haunt and Family Fun Hours.
    const units = tonightUnits("2026-10-17");
    expect(units).toHaveLength(1);
    expect(units[0]!.head.title).toBe("The Black Mountain Haunted House");
    expect(units[0]!.options.map((o) => o.title)).toEqual([
      "Evening Haunt",
      "Family Fun Hours",
    ]);
  });

  it("shows one unit with only the mode that is actually open", () => {
    // Friday October 16: Evening Haunt only.
    const units = tonightUnits("2026-10-16");
    expect(units).toHaveLength(1);
    expect(units[0]!.head.title).toBe("The Black Mountain Haunted House");
    expect(units[0]!.options.map((o) => o.title)).toEqual(["Evening Haunt"]);
  });

  it("is absent entirely on a night nothing is open", () => {
    // Monday October 19: neither mode names this day.
    expect(tonightUnits("2026-10-19")).toEqual([]);
  });

  it("never lets the modes compete with the attraction as separate cards", () => {
    const units = tonightUnits("2026-10-17");
    const titles = units.map((u) => u.head.title);
    expect(titles).not.toContain("Evening Haunt");
    expect(titles).not.toContain("Family Fun Hours");
  });

  it("groups before the lane cap, so one attraction cannot fill Tonight", () => {
    // Three of a thing's parts must not spend a three-card budget. Composing
    // first is what makes Home's smaller cap honest rather than lossy.
    const others = [
      thing("a", "Something Else", {
        availability: { basis: "stated-days" as const, days: ["2026-10-17"] },
      }),
      thing("b", "Another Thing", {
        availability: { basis: "stated-days" as const, days: ["2026-10-17"] },
      }),
    ];
    const all = [...CORPUS, ...others];
    const units = asDiscoveryUnits(
      happeningTonight(all, VANCOUVER_EVENING("2026-10-17")),
      all,
    ).slice(0, 3);
    expect(units.map((u) => u.head.title)).toContain("Something Else");
    expect(units.map((u) => u.head.title)).toContain("Another Thing");
    expect(units).toHaveLength(3);
  });

  it("composes the weekend and coming-up lanes the same way", () => {
    // Thursday October 15 looks into the Fri/Sat/Sun window.
    const thursday = VANCOUVER_EVENING("2026-10-15");
    const weekend = asDiscoveryUnits(
      happeningThisWeekend(CORPUS, thursday),
      CORPUS,
    );
    expect(weekend).toHaveLength(1);
    expect(weekend[0]!.head.title).toBe("The Black Mountain Haunted House");

    const soon = asDiscoveryUnits(upcoming(CORPUS, thursday), CORPUS);
    expect(soon.map((u) => u.head.title)).toEqual([
      "The Black Mountain Haunted House",
    ]);
  });
});
