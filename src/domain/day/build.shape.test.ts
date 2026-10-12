import { describe, expect, it } from "vitest";
import { alternativesFor, buildDay, MOVE_MINUTES } from "./build";
import { readBrief, reviseBrief } from "./brief";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate, RainReading } from "@/lib/data/types";
import { townById } from "@/domain/discovery/towns";

/**
 * **Shaping a day that is the person's, not the builder's.**
 *
 * Fixture subjects only. Every name here is a test label; what matters is that
 * every stop the builder returns is one of them, and that every fact it states
 * is one these fixtures state.
 */
const VERNON = townById("vernon")!;

const place = (
  name: string,
  over: Partial<DiscoveryCandidate> & {
    km?: number;
    east?: number;
    rain?: RainReading;
  } = {},
): DiscoveryCandidate => {
  const { km = 5, east = 0, rain, ...rest } = over;
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
      coordinates: [VERNON.longitude + east / 79, VERNON.latitude + km / 111],
    },
    ...(rain
      ? { environment: { rain: { reading: rain, basis: "stated" } } }
      : {}),
    ...rest,
  } as DiscoveryCandidate;
};

const aff = (...names: string[]) =>
  names.map((name) => ({ name, basis: "stated-activity" }));

const POOL = [
  place("Lakeside Beach", {
    km: 2,
    subtype: "beach",
    rain: "exposed",
    knowledge: { affordances: aff("swimming", "beach") },
  }),
  place("Ridge Trail", {
    km: 6,
    subtype: "trail",
    rain: "exposed",
    knowledge: { affordances: aff("hiking", "viewpoint") },
  }),
  place("Town Playground", {
    km: 1,
    knowledge: { affordances: aff("playground", "picnic") },
  }),
  place("Hilltop Winery", {
    km: 8,
    subtype: "winery",
    knowledge: {
      affordances: aff("wine tasting"),
      practical: [{ label: "Tasting fee", value: "$15 per person" }],
    },
  }),
  place("Rose Garden", {
    km: 3,
    east: 2,
    subtype: "garden",
    knowledge: {
      affordances: aff("garden walk"),
      practical: [{ label: "Admission", value: "Free" }],
    },
  }),
  place("Science Hall", {
    km: 2.5,
    subtype: "science centre",
    rain: "sheltered",
    knowledge: {
      affordances: aff("interactive exhibits"),
      practical: [
        { label: "Admission", value: "$12 for adults, $8 for children" },
        { label: "Hours", value: "10am–5pm daily" },
      ],
    },
  }),
  place("Covered Market", {
    km: 4,
    subtype: "market",
    rain: "partly-sheltered",
    knowledge: { affordances: aff("market", "food") },
  }),
  place("Climbing Gym", {
    km: 5,
    east: 1,
    subtype: "climbing gym",
    rain: "sheltered",
    knowledge: { affordances: aff("climbing") },
  }),
].map(candidateToExperience);

const ids = (day: ReturnType<typeof buildDay>) =>
  day.stops.map((s) => s.experience.id);

describe("what the person decides stays decided", () => {
  const brief = readBrief("four hours near Vernon");

  it("keeps a kept stop through a revision that would have dropped it", () => {
    const first = buildDay({ pool: POOL, brief });
    const kept = first.stops[0]!.experience.id;
    const revised = reviseBrief(brief, "make it more adventurous, indoors");
    const after = buildDay({ pool: POOL, brief: revised, keep: [kept] });
    expect(ids(after)).toContain(kept);
    expect(after.stops.find((s) => s.experience.id === kept)?.kept).toBe(true);
  });

  it("uses the order they set, and routes anything new after it", () => {
    const first = buildDay({ pool: POOL, brief });
    const reversed = [...ids(first)].reverse();
    const after = buildDay({
      pool: POOL,
      brief,
      order: reversed,
      keep: reversed,
    });
    expect(ids(after)).toEqual(reversed);
  });

  it("gives a stop the time they set, and shares the rest", () => {
    const first = buildDay({ pool: POOL, brief });
    const id = first.stops[0]!.experience.id;
    const after = buildDay({ pool: POOL, brief, minutes: { [id]: 120 } });
    const stop = after.stops.find((s) => s.experience.id === id)!;
    expect(stop.minutes).toBe(120);
    expect(stop.timeSet).toBe(true);
    const others = after.stops.filter((s) => s.experience.id !== id);
    expect(others.every((s) => s.minutes < first.stops[1]!.minutes)).toBe(true);
  });

  it("takes as many stops as they ask for, within reason", () => {
    expect(buildDay({ pool: POOL, brief, count: 1 }).stops).toHaveLength(1);
    expect(buildDay({ pool: POOL, brief, count: 5 }).stops).toHaveLength(5);
    expect(
      buildDay({ pool: POOL, brief, count: 40 }).stops.length,
    ).toBeLessThanOrEqual(6);
  });
});

describe("a time budget a real day could keep", () => {
  it("keeps time back for moving, and says it is a buffer", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("four hours near Vernon"),
    });
    const budget = day.budget!;
    // From the start, between each stop, and home again.
    expect(budget.moves).toBe(day.stops.length + 1);
    expect(budget.moveMinutes).toBe(budget.moves * MOVE_MINUTES);
    expect(budget.stopMinutes + budget.moveMinutes).toBeLessThanOrEqual(240);
    expect(budget.overBy).toBe(0);
    expect(day.unknowns.join(" ")).toMatch(/buffer, not a drive time/);
  });

  it("uses their hours rather than rounding them away", () => {
    for (const hours of [2, 3, 5, 7]) {
      const day = buildDay({
        pool: POOL,
        brief: readBrief(`${hours} hours near Vernon`),
      });
      const { stopMinutes, moveMinutes, totalMinutes } = day.budget!;
      expect(totalMinutes - (stopMinutes + moveMinutes)).toBeLessThan(15);
      expect(stopMinutes + moveMinutes).toBeLessThanOrEqual(totalMinutes);
    }
  });

  it("says when it assumed the hours", () => {
    expect(
      buildDay({ pool: POOL, brief: readBrief("near Vernon") }).budget
        ?.hoursAssumed,
    ).toBe(true);
    expect(
      buildDay({ pool: POOL, brief: readBrief("3 hours near Vernon") }).budget
        ?.hoursAssumed,
    ).toBe(false);
  });

  it("says when hand-set time runs past their hours", () => {
    const brief = readBrief("two hours near Vernon");
    const first = buildDay({ pool: POOL, brief });
    const id = first.stops[0]!.experience.id;
    const day = buildDay({ pool: POOL, brief, minutes: { [id]: 180 } });
    expect(day.budget!.overBy).toBeGreaterThan(0);
  });

  it("names the time it was given in the opening", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("leave at 9, home by 1, near Vernon"),
    });
    expect(day.opening).toMatch(/Out at 9 am, home by 1 pm/);
  });
});

describe("money, as published", () => {
  it("leaves out a place whose lowest published price is past the whole budget", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("four hours near Vernon, $10, wine"),
      count: 6,
    });
    expect(ids(day)).not.toContain("hilltop-winery");
    // $8 for a child is under $10, so the science hall can stay.
    const eligible = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon, $10, science"),
      count: 1,
    });
    expect(ids(eligible)).toEqual(["science-hall"]);
  });

  it("keeps places that publish nothing — silence is not a price", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("four hours near Vernon, free"),
      count: 6,
    });
    expect(ids(day)).toContain("town-playground");
    expect(ids(day)).not.toContain("science-hall");
  });

  it("lists published prices in their own words and never adds them up", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon"),
      keep: [
        "science-hall",
        "hilltop-winery",
        "rose-garden",
        "town-playground",
      ],
      count: 4,
    });
    const money = day.money!;
    expect(money.priced.map((p) => p.cost)).toContain("$15 per person");
    expect(money.free).toContain("Rose Garden");
    expect(money.unpublished).toBeGreaterThan(0);
    expect(JSON.stringify(money)).not.toMatch(/total/i);
  });
});

describe("what they said no to", () => {
  it("leaves out places that state it, and nothing else", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon, no hiking, no swimming"),
      count: 6,
    });
    expect(ids(day)).not.toContain("ridge-trail");
    expect(ids(day)).not.toContain("lakeside-beach");
    expect(day.stops.length).toBe(6);
  });
});

describe("families, couples, solo, friends", () => {
  it("leans a couple toward what a couple might want, and labels it a suggestion", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("two hours near Vernon with my wife"),
    });
    const garden = day.stops.find((s) => s.experience.id === "rose-garden");
    expect(garden).toBeDefined();
    expect(garden?.fit).toMatch(/^A pick for two — it lists/);
  });

  it("leans a group of friends somewhere else", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("two hours near Vernon with friends"),
      count: 3,
    });
    expect(ids(day)).toContain("climbing-gym");
  });

  it("asks a different thing of different people at the same place", () => {
    const solo = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon, solo, swimming"),
      keep: ["lakeside-beach"],
      count: 1,
    });
    const kids = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon, with the kids, swimming"),
      keep: ["lakeside-beach"],
      count: 1,
    });
    expect(solo.stops[0]!.challenge).toBeDefined();
    expect(kids.stops[0]!.challenge).toBeDefined();
    expect(solo.stops[0]!.challenge).not.toBe(kids.stops[0]!.challenge);
  });

  it("does not repeat a side quest in one day while there is another", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon, with friends"),
      keep: ["lakeside-beach", "covered-market", "ridge-trail"],
      count: 3,
    });
    const lines = day.stops.map((s) => s.challenge).filter(Boolean);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("asks for an age rather than assuming one", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("the family, near Vernon"),
    });
    expect(day.unknowns.join(" ")).toMatch(/say how old the kids are/);
    expect(day.opening).toMatch(/with the family/);
  });

  it("prints an allergy as something to ask, first", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon, my friend is allergic to shellfish"),
    });
    expect(day.unknowns[0]).toMatch(/shellfish allergy/);
  });
});

describe("the weather", () => {
  const wet = {
    wet: true,
    chance: 80,
    description: "Rain",
    source: "MSC",
    area: "Vernon",
  };

  it("sinks open-air places when rain is forecast, without removing them", () => {
    const dry = buildDay({
      pool: POOL,
      brief: readBrief("three hours near Vernon, swimming"),
    });
    const rainy = buildDay({
      pool: POOL,
      brief: readBrief("three hours near Vernon"),
      weather: wet,
    });
    expect(ids(dry)).toContain("lakeside-beach");
    expect(rainy.stops.some((s) => s.rain === "stands")).toBe(true);
    expect(rainy.opening).toMatch(/Rain is forecast/);
    expect(rainy.weather?.source).toBe("MSC");
  });

  it("gives an exposed stop a rain plan from somewhere Atlas says is under cover", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon, swimming"),
      keep: ["lakeside-beach"],
      count: 1,
    });
    const beach = day.stops[0]!;
    expect(beach.rain).toBe("exposed");
    expect(beach.rainPlan).toBeDefined();
    const plan = beach.rainPlan!.experience;
    expect(["sheltered", "partly-sheltered", "runs-in-rain"]).toContain(
      plan.environment?.rain?.reading,
    );
    expect(POOL.map((e) => e.id)).toContain(plan.id);
    expect(beach.rainPlan!.km).toBeGreaterThan(0);
  });

  it("does not hand out a rain plan for a stop nobody has classified, on a dry day", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon"),
      keep: ["town-playground"],
      count: 1,
    });
    expect(day.stops[0]!.rainPlan).toBeUndefined();
  });

  it("does on a wet day, because Atlas cannot say it is covered", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon"),
      keep: ["town-playground"],
      count: 1,
      weather: wet,
    });
    expect(day.stops[0]!.rainPlan).toBeDefined();
  });

  it("offers nothing when nothing nearby says it is under cover", () => {
    const outdoorOnly = POOL.filter(
      (e) => e.environment?.rain?.reading === "exposed",
    );
    const day = buildDay({
      pool: outdoorOnly,
      brief: readBrief("near Vernon"),
      count: 2,
    });
    expect(day.stops.every((s) => !s.rainPlan)).toBe(true);
  });

  it("prints the rain plan the screen chose, not a fresh one", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon"),
      keep: ["lakeside-beach"],
      count: 1,
      rainPlans: { "lakeside-beach": "climbing-gym" },
    });
    expect(day.stops[0]!.rainPlan?.experience.id).toBe("climbing-gym");
  });
});

describe("facts it may state", () => {
  it("quotes published hours as published, without turning them into 'open'", () => {
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon, interactive exhibits"),
      keep: ["science-hall"],
      count: 1,
    });
    expect(day.stops[0]!.hours).toBe("10am–5pm daily");
    expect(day.stops[0]!.open).toBeUndefined();
  });

  it("says how far home is from the last stop, in straight-line km", () => {
    const day = buildDay({ pool: POOL, brief: readBrief("near Vernon") });
    expect(day.homeKm).toBeGreaterThan(0);
  });

  it("flags a move too long for a flat buffer", () => {
    const far = candidateToExperience(
      place("Far Lake", { km: 40, knowledge: { affordances: aff("fishing") } }),
    );
    const day = buildDay({
      pool: [...POOL, far],
      brief: readBrief("all day near Vernon, fishing"),
      keep: ["far-lake"],
      count: 2,
    });
    expect(day.stops.some((s) => s.longMove)).toBe(true);
    expect(day.unknowns.join(" ")).toMatch(/will not cover it/);
  });
});

describe("choosing a different stop", () => {
  const brief = readBrief("three hours near Vernon");
  const day = buildDay({ pool: POOL, brief });

  it("offers real alternatives that are not already in the day", () => {
    const options = alternativesFor({ pool: POOL, brief, day, index: 0 });
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(3);
    for (const option of options) {
      expect(POOL.map((e) => e.id)).toContain(option.experience.id);
      expect(ids(day)).not.toContain(option.experience.id);
      expect(option.because.length).toBeGreaterThan(0);
    }
  });

  it("respects what they already said no to", () => {
    const options = alternativesFor({
      pool: POOL,
      brief,
      day,
      index: 0,
      without: POOL.map((e) => e.id).filter((id) => id !== "climbing-gym"),
    });
    expect(options.map((o) => o.experience.id)).toEqual(
      ids(day).includes("climbing-gym") ? [] : ["climbing-gym"],
    );
  });

  it("has nothing for a stop that does not exist", () => {
    expect(alternativesFor({ pool: POOL, brief, day, index: 9 })).toEqual([]);
  });
});

/**
 * **What Day Builder decides reaches paper** (integration, INT-5 / risk R4).
 * The field guide is the print surface, so everything the screen shaped —
 * the rain plan, each stop's own time, the move buffer, who it might suit —
 * has to survive `printableFromDay`.
 */
describe("on paper", () => {
  it("carries the rain plan the screen chose", async () => {
    const { printableFromDay } = await import("@/lib/analog/printable");
    const day = buildDay({
      pool: POOL,
      brief: readBrief("near Vernon"),
      keep: ["lakeside-beach"],
      count: 1,
      rainPlans: { "lakeside-beach": "climbing-gym" },
    });
    const paper = printableFromDay(day);
    expect(paper.stops[0]!.rainPlan?.title).toBe(
      day.stops[0]!.rainPlan!.experience.title,
    );
    expect(paper.stops[0]!.rainPlan?.because).toBe(
      day.stops[0]!.rainPlan!.because,
    );
  });

  it("prints each stop's own minutes, and the buffer as a buffer", async () => {
    const { printableFromDay } = await import("@/lib/analog/printable");
    const first = buildDay({
      pool: POOL,
      brief: readBrief("four hours near Vernon"),
    });
    const id = first.stops[0]!.experience.id;
    const day = buildDay({
      pool: POOL,
      brief: readBrief("four hours near Vernon"),
      keep: [id],
      minutes: { [id]: 120 },
    });
    const paper = printableFromDay(day);
    expect(paper.stops.map((s) => s.minutes)).toEqual(
      day.stops.map((s) => s.minutes),
    );
    expect(paper.stops.find((s) => s.id === id)).toMatchObject({
      minutes: 120,
      timeSet: true,
    });
    expect(paper.time.evenSplit).toBe(false);
    expect(paper.time.buffer).toEqual({
      perMove: MOVE_MINUTES,
      moves: day.budget!.moves,
      minutes: day.budget!.moveMinutes,
    });
  });

  it("keeps who it might suit, as a suggestion", async () => {
    const { printableFromDay } = await import("@/lib/analog/printable");
    const day = buildDay({
      pool: POOL,
      brief: readBrief("four hours near Vernon, just the two of us"),
    });
    const paper = printableFromDay(day);
    day.stops.forEach((stop, i) => {
      expect(paper.stops[i]!.fit).toBe(stop.fit);
    });
  });
});
