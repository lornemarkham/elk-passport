import { describe, expect, it } from "vitest";
import { buildDay } from "@/domain/day/build";
import { readBrief } from "@/domain/day/brief";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { townById } from "@/domain/discovery/towns";
import {
  budgetFor,
  directionsFor,
  findByFor,
  kmLine,
  minutesLine,
  prepFor,
  printableFromDay,
  sideQuestsFor,
  timeFor,
} from "./printable";

const VERNON = townById("vernon")!;

// Fixtures, not Atlas: the shape `buildDay`'s own tests use.
const place = (
  name: string,
  over: Partial<DiscoveryCandidate> & { km?: number | null } = {},
): DiscoveryCandidate => {
  const { km = 5, ...rest } = over;
  return {
    id: name.toLowerCase().replace(/\W+/g, "-"),
    kind: "Place",
    name,
    subtype: "park",
    description: "A description long enough to be real.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    geography: {
      state: "observed",
      locality: "Vernon",
      area: { id: "okanagan", name: "Okanagan" },
      ...(km === null
        ? {}
        : {
            coordinates: [VERNON.longitude, VERNON.latitude + km / 111] as [
              number,
              number,
            ],
          }),
    },
    ...rest,
  };
};

const aff = (...names: string[]) =>
  names.map((name) => ({ name, basis: "stated-activity" }));

const POOL = [
  place("Polson Park", {
    km: 1,
    knowledge: {
      affordances: aff("playground", "picnic"),
      features: ["Washrooms", "Playground"],
    },
  }),
  place("Okanagan Science Centre", {
    km: 2,
    subtype: "science centre",
    knowledge: {
      affordances: aff("interactive exhibits"),
      practical: [
        { label: "Admission", value: "$12 for adults, $8 for children" },
      ],
      conditions: ["Children under 12 must be with an adult"],
    },
  }),
  place("Kal Beach", { km: 6, knowledge: { affordances: aff("swimming") } }),
].map(candidateToExperience);

const day = (said: string, pool = POOL) =>
  buildDay({ pool, brief: readBrief(said) });

describe("printableFromDay", () => {
  it("keeps every stop the builder chose, in order, numbered from one", () => {
    const planned = day("three hours near Vernon");
    const printable = printableFromDay(planned);
    expect(printable.stops.map((s) => s.id)).toEqual(
      planned.stops.map((s) => s.experience.id),
    );
    expect(printable.stops.map((s) => s.number)).toEqual(
      planned.stops.map((_, i) => i + 1),
    );
    expect(printable.sample).toBe(false);
  });

  it("carries a published price and leaves an unpublished one absent", () => {
    const printable = printableFromDay(day("three hours near Vernon"));
    const science = printable.stops.find((s) =>
      s.title.startsWith("Okanagan Science"),
    );
    const park = printable.stops.find((s) => s.title === "Polson Park");
    expect(science?.cost).toBe("$12 for adults, $8 for children");
    expect(park?.cost).toBeUndefined();
  });

  it("never states opening hours that were not published", () => {
    const printable = printableFromDay(day("three hours near Vernon"));
    for (const stop of printable.stops) expect(stop.open).toBeUndefined();
  });

  it("lists what Atlas says you can do there, deduplicated, as optional", () => {
    const printable = printableFromDay(day("three hours near Vernon"));
    const park = printable.stops.find((s) => s.title === "Polson Park");
    // "playground" (verb) and "Playground" (feature) are one thing.
    expect(park?.alsoHere).toEqual(["playground", "picnic", "Washrooms"]);
  });

  it("writes the date out when one was carried in", () => {
    const planned = buildDay({
      pool: POOL,
      brief: readBrief("three hours near Vernon", { on: "2026-10-17" }),
    });
    expect(printableFromDay(planned).dateLine).toBe(
      "Saturday, October 17, 2026",
    );
  });

  it("marks a sample as a sample", () => {
    expect(printableFromDay(day("Vernon"), { sample: true }).sample).toBe(true);
  });
});

describe("prepFor", () => {
  it("labels every line by what kind of claim it is", () => {
    const items = prepFor(day("three hours near Vernon"));
    for (const item of items) {
      expect(["published", "check", "suggested"]).toContain(item.basis);
    }
    expect(items.find((i) => i.id === "route")?.basis).toBe("check");
    expect(items.find((i) => i.id === "told")?.basis).toBe("suggested");
  });

  it("names exactly the stops with no published hours or prices", () => {
    const items = prepFor(day("three hours near Vernon"));
    const prices = items.find((i) => i.id === "prices");
    expect(prices?.why).toContain("Polson Park");
    expect(prices?.why).not.toContain("Okanagan Science Centre");
  });

  it("repeats a published feature and a published rule as published", () => {
    const items = prepFor(day("three hours near Vernon"));
    const published = items.filter((i) => i.basis === "published");
    expect(published.map((i) => i.label)).toContain(
      "Washrooms listed at Polson Park",
    );
    expect(
      published.find((i) => i.label === "Rules at Okanagan Science Centre")
        ?.why,
    ).toContain("Children under 12 must be with an adult");
  });

  it("does not invent a playground into a washroom: only practical features", () => {
    const items = prepFor(day("three hours near Vernon"));
    expect(items.map((i) => i.label)).not.toContain(
      "Playground listed at Polson Park",
    );
  });

  it("suggests cash only when a place names a price", () => {
    const withPrice = prepFor(day("three hours near Vernon"));
    expect(withPrice.some((i) => i.id === "money")).toBe(true);
    const parksOnly = prepFor(
      day("three hours near Vernon", [POOL[0]!, POOL[2]!]),
    );
    expect(parksOnly.some((i) => i.id === "money")).toBe(false);
  });

  it("adds the child's things only when an age was actually given", () => {
    expect(
      prepFor(day("three hours near Vernon with my 6-year-old")).some(
        (i) => i.id === "layers",
      ),
    ).toBe(true);
    expect(
      prepFor(day("three hours near Vernon with the kids")).some(
        (i) => i.id === "layers",
      ),
    ).toBe(false);
  });

  it("names the forecast's date when there is one", () => {
    const planned = buildDay({
      pool: POOL,
      brief: readBrief("Vernon", { on: "2026-10-17" }),
    });
    expect(prepFor(planned).find((i) => i.id === "weather")?.label).toBe(
      "The forecast for Saturday, October 17, 2026",
    );
  });
});

describe("timeFor", () => {
  it("separates what they said from what the plan assumed", () => {
    expect(timeFor(day("three hours near Vernon")).statedHours).toBe(3);
    const unsaid = timeFor(day("near Vernon"));
    expect(unsaid.statedHours).toBeUndefined();
    expect(unsaid.plannedHours).toBe(4);
  });

  it("adds up only the legs that were measured, and counts the rest", () => {
    const pool = [
      ...POOL,
      candidateToExperience(place("Unplaced Farm", { km: null })),
    ];
    const planned = buildDay({
      pool,
      brief: readBrief("eight hours near Vernon"),
    });
    const time = timeFor(planned);
    const legs = planned.stops.map((s) => s.km);
    expect(time.unmeasuredLegs).toBe(
      legs.filter((k) => k === undefined).length,
    );
    expect(time.unmeasuredLegs).toBeGreaterThan(0);
    expect(time.measuredKm).toBeCloseTo(
      legs.reduce<number>((sum, k) => sum + (k ?? 0), 0),
      0,
    );
  });

  it("reports the plan's minutes per stop, not a claim about the place", () => {
    const planned = day("three hours near Vernon");
    expect(timeFor(planned).minutesPerStop).toBe(planned.stops[0]!.minutes);
  });
});

describe("budgetFor", () => {
  it("lists prices in the publisher's words and never totals them", () => {
    const budget = budgetFor(day("three hours near Vernon, $60"));
    expect(budget.statedBudget).toBe(60);
    expect(budget.published).toEqual([
      {
        title: "Okanagan Science Centre",
        cost: "$12 for adults, $8 for children",
      },
    ]);
    expect(budget.unpublished).toContain("Polson Park");
    expect(Object.keys(budget)).not.toContain("total");
  });
});

describe("sideQuestsFor", () => {
  it("is deterministic for the same day", () => {
    const planned = day("three hours near Vernon");
    expect(sideQuestsFor(planned)).toEqual(sideQuestsFor(planned));
    expect(sideQuestsFor(planned)).toHaveLength(4);
  });

  it("draws from the kids' list only when a young child was named", () => {
    const kidIds = new Set(["birds", "leaf", "rocks", "colours"]);
    const grownUps = sideQuestsFor(day("three hours near Vernon"));
    expect(grownUps.some((q) => kidIds.has(q.id))).toBe(false);
    const withKid = sideQuestsFor(
      day("three hours near Vernon with my 6-year-old"),
    );
    expect(withKid.filter((q) => kidIds.has(q.id))).toHaveLength(2);
    expect(withKid).toHaveLength(4);
  });
});

describe("directionsFor", () => {
  it("links by coordinate when Atlas has one", () => {
    expect(directionsFor(POOL[0]!)).toMatch(/query=50\.\d+,-119\.\d+/);
  });

  it("falls back to name and town, and makes nothing up without either", () => {
    const named = candidateToExperience(place("Unplaced Farm", { km: null }));
    expect(directionsFor(named)).toContain(
      encodeURIComponent("Unplaced Farm, Vernon"),
    );
    const nowhere = candidateToExperience({
      ...place("Nowhere", { km: null }),
      geography: { state: "unknown" },
    });
    expect(directionsFor(nowhere)).toBeUndefined();
  });
});

describe("findByFor", () => {
  it("writes coordinates a person can type, or the name and town", () => {
    expect(findByFor(POOL[0]!)).toMatch(/^50\.\d{5}, -119\.\d{5}$/);
    const named = candidateToExperience(place("Unplaced Farm", { km: null }));
    expect(findByFor(named)).toBe("Unplaced Farm, Vernon");
  });
});

describe("lines", () => {
  it("writes minutes the way a person would", () => {
    expect(minutesLine(45)).toBe("45 min");
    expect(minutesLine(60)).toBe("1 hr");
    expect(minutesLine(75)).toBe("1 hr 15 min");
  });

  it("writes km without false precision", () => {
    expect(kmLine(0.4)).toBe("under 1 km");
    expect(kmLine(6.6)).toBe("7 km");
  });
});
