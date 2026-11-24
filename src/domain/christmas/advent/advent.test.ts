import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import { findsIn } from "../discover";
import { readChristmas } from "../themes";
import { presetDates, whenChoicesFor, whenLabel } from "../when";
import { ADVENT_IDEAS, ideaOnDay } from "./ideas";
import {
  ALL_DAYS,
  DEFAULT_PREFS,
  dayOf,
  openDays,
  previewActive,
  previewDays,
  readPrefs,
  stageOf,
  writePrefs,
  type AdventPrefs,
} from "./model";
import { lowestPrice, oncePerPart, optionAt, planDays } from "./pick";
import {
  EMPTY_PROGRESS,
  completedCount,
  progressLine,
  readProgress,
  swap,
  toggleDone,
} from "./progress";

/**
 * **Advent Adventure** (owner brief M1053): 25 doors, a real event only on a
 * day it happens, the family's limits kept, never an empty door.
 */

function exp(over: Partial<Experience>): Experience {
  return {
    id: over.id ?? over.title ?? "x",
    kind: "Place",
    slug: "x",
    title: "Somewhere",
    shortDescription: "",
    detailReady: false,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 1,
    priceLevel: 0,
    duration: { minMinutes: 0, maxMinutes: 0 },
    regionIds: [],
    familyFriendly: false,
    petFriendly: false,
    requiresReservation: false,
    isActive: true,
    ...over,
  };
}

function near(town: string, kmEast: number, over: Partial<Experience>) {
  const t = townById(town)!;
  const dLng = kmEast / (111.32 * Math.cos((t.latitude * Math.PI) / 180));
  return exp({
    geography: {
      state: "observed",
      coordinates: [t.longitude + dLng, t.latitude],
      coordinatesBasis: "observed",
      area: { id: t.area.toLowerCase(), name: t.area },
    },
    ...over,
  });
}

const on = (day: string, hours = "18:00:00Z"): Partial<Experience> => ({
  kind: "Event",
  startTime: `${day}T${hours}`,
  endTime: `${day}T23:00:00Z`,
  timePrecision: "minute",
  occurrence: { reading: "occurrence", actionable: true },
});

const TODAY = "2026-12-10";
const ctx = { at: "vernon", townName: "Vernon", today: TODAY };
const prefs = (over: Partial<AdventPrefs> = {}): AdventPrefs => ({
  ...DEFAULT_PREFS,
  ...over,
});

const RAW = [
  near("vernon", 2, {
    id: "parade",
    title: "Vernon Christmas Light Up Parade",
    ...on("2026-12-05"),
  }),
  near("vernon", 3, {
    id: "nutcracker",
    title: "The Nutcracker",
    ...on("2026-12-06"),
    knowledge: {
      affordances: [],
      features: [],
      practical: [{ label: "Tickets", value: "$45 adults" }],
    },
  }),
  near("vernon", 1, {
    id: "market",
    title: "Vernon Christmas Market",
    kind: "Event",
    startTime: "2026-12-01T17:00:00Z",
    endTime: "2026-12-20T02:00:00Z",
    timePrecision: "day",
    occurrence: { reading: "occurrence", actionable: true },
  }),
  near("vernon", 80, {
    id: "far",
    title: "Far Away Christmas Festival",
    ...on("2026-12-05"),
  }),
  exp({
    id: "unplaced",
    title: "Silver Star New Years Eve Celebration",
    ...on("2026-12-31"),
  }),
  near("vernon", 2, {
    id: "santa-skate",
    title: "Skate with Santa",
    ...on("2026-12-12"),
    environment: { exposure: { value: "outdoor", basis: "derived" } },
  }),
] as Experience[];
const corpus = findsIn(RAW, TODAY);
const corpusOn = (today: string) => findsIn(RAW, today);

describe("New Year's Eve and Day are part of Christmas", () => {
  it("reads New Year's events held in the season, and only those", () => {
    const nye = exp({
      title: "New Year’s Eve Party – Ring in 2027",
      ...on("2026-12-31"),
    });
    expect(readChristmas(nye)?.themes).toContain("newyear");
    const day = exp({
      title: "New Year’s Day Celebration",
      ...on("2027-01-01"),
    });
    expect(readChristmas(day)?.themes).toContain("newyear");
    const lunar = exp({
      title: "Lunar New Year Celebration",
      ...on("2027-02-06"),
    });
    expect(readChristmas(lunar)?.themes ?? []).not.toContain("newyear");
    const fireworks = exp({
      title: "Fireworks at Big White",
      ...on("2026-12-11"),
    });
    expect(readChristmas(fireworks)?.themes).toContain("festivals");
  });

  it("says New Year's Eve and Day as presets until they have gone", () => {
    expect(presetDates("nye", "2026-11-23")).toEqual({
      from: "2026-12-31",
      to: "2026-12-31",
    });
    expect(presetDates("nyd", "2026-12-31")).toEqual({
      from: "2027-01-01",
      to: "2027-01-01",
    });
    expect(whenLabel({ from: "2026-12-31", to: "2026-12-31" }, TODAY)).toBe(
      "New Year's Eve",
    );
    expect(whenChoicesFor("2026-12-31").map((c) => c.value)).toContain("nye");
    expect(whenChoicesFor("2027-01-01").map((c) => c.value)).not.toContain(
      "nye",
    );
    expect(whenChoicesFor("2027-01-02").map((c) => c.value)).not.toContain(
      "nyd",
    );
  });
});

describe("the days", () => {
  it("has 25 doors in December and nine New Year's days after", () => {
    expect(ALL_DAYS.filter((d) => d.door)).toHaveLength(25);
    expect(dayOf(1).date).toBe("2026-12-01");
    expect(dayOf(25)).toMatchObject({ date: "2026-12-25", door: true });
    expect(dayOf(26)).toMatchObject({ date: "2026-12-26", door: false });
    expect(dayOf(34).date).toBe("2027-01-03");
    expect(ALL_DAYS).toHaveLength(34);
  });

  it("opens only days that have come", () => {
    expect(openDays("2026-11-23")).toHaveLength(0);
    expect(openDays("2026-12-07").map((d) => d.n)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(stageOf("2026-11-23")).toBe("before");
    expect(stageOf("2026-12-25")).toBe("doors");
    expect(stageOf("2026-12-26")).toBe("after");
    expect(stageOf("2027-01-04")).toBe("over");
  });
});

describe("preferences", () => {
  it("round-trips and drops what it doesn't know", () => {
    const p = prefs({
      who: "family",
      ages: [5, 9],
      km: 15,
      budget: "free",
      setting: "outdoor",
      interests: ["lights", "crafts"],
      seed: 42,
    });
    expect(readPrefs(writePrefs(p))).toEqual(p);
    expect(
      readPrefs("who=dragon&km=999&like=lights,nonsense&ages=5,40"),
    ).toEqual(prefs({ ages: [5], interests: ["lights"] }));
    expect(readPrefs("%")).toEqual(DEFAULT_PREFS);
  });
});

describe("what is behind a door", () => {
  const days = openDays(TODAY);
  const plan = (p: AdventPrefs) =>
    planDays(days, corpus, p, {
      ...ctx,
      now: new Date("2026-12-10T20:00:00Z"),
    });
  /** The doors as they are on the morning of `today`. */
  const planOn = (today: string, p: AdventPrefs) =>
    planDays(openDays(today), corpusOn(today), p, { ...ctx, today });

  it("offers a real event only on a day it is happening, near here", () => {
    const plans = planOn("2026-12-05", prefs());
    const keys = (n: number) => plans[n - 1]!.options.map((o) => o.key);
    expect(keys(5)).toContain("e:parade");
    expect(keys(4)).not.toContain("e:parade");
    // Beyond 30 km, and with no confirmed place: never behind a door.
    for (const p of plans) {
      expect(p.options.map((o) => o.key)).not.toContain("e:far");
      expect(p.options.map((o) => o.key)).not.toContain("e:unplaced");
    }
    // The single-day parade leads its day over the three-week market.
    expect(plans[4]!.options[0]!.key).toBe("e:parade");
    // Once the day has gone, its one-day event is gone from the door; what
    // is still running today (the market) and the ideas stay.
    const later = plan(prefs());
    expect(later[4]!.options.map((o) => o.key)).not.toContain("e:parade");
    expect(
      later[4]!.options.filter((o) => o.kind === "event").map((o) => o.key),
    ).toEqual(["e:market"]);
  });

  it("is never empty: ideas fill a day nothing real is on", () => {
    const plans = plan(prefs({ km: 15 }));
    for (const p of plans) {
      expect(p.options.length).toBeGreaterThanOrEqual(3);
      expect(p.options.some((o) => o.kind === "idea")).toBe(true);
    }
  });

  it("keeps the family's limits", () => {
    const at6 = (p: AdventPrefs) =>
      planOn("2026-12-06", p)[5]!.options.map((o) => o.key);
    expect(at6(prefs({ budget: "free" }))).not.toContain("e:nutcracker");
    expect(at6(prefs({ budget: "inexpensive" }))).not.toContain("e:nutcracker");
    expect(at6(prefs())).toContain("e:nutcracker");
    const indoors = planOn("2026-12-12", prefs({ setting: "indoor" }));
    expect(
      planOn("2026-12-12", prefs())[11]!.options.map((o) => o.key),
    ).toContain("e:santa-skate");
    expect(indoors[11]!.options.map((o) => o.key)).not.toContain(
      "e:santa-skate",
    );
    for (const o of indoors
      .flatMap((p) => p.options)
      .filter((o) => o.kind === "idea"))
      expect(ADVENT_IDEAS.find((i) => `i:${i.id}` === o.key)!.setting).toBe(
        "indoor",
      );
  });

  it("does not offer children's ideas to a couple", () => {
    const plans = plan(prefs({ who: "couple" }));
    const ideas = plans
      .flatMap((p) => p.options)
      .filter((o) => o.kind === "idea");
    expect(ideas.map((o) => o.key)).not.toContain("i:letters-to-santa");
  });

  it("puts what the family loves first, and varies the doors", () => {
    const plans = plan(prefs({ interests: ["crafts"] }));
    const ideaLeads = plans
      .map((p) => p.options.find((o) => o.kind === "idea")!)
      .filter(Boolean);
    expect(
      ideaLeads.filter((o) =>
        ADVENT_IDEAS.find((i) => `i:${i.id}` === o.key)!.interests.includes(
          "crafts",
        ),
      ).length,
    ).toBeGreaterThan(ideaLeads.length / 2);
    const leads = plans.map((p) => p.options[0]!.key);
    expect(new Set(leads).size).toBeGreaterThanOrEqual(leads.length - 2);
  });

  it("swaps along the options and back round", () => {
    const p = plan(prefs())[0]!;
    expect(optionAt(p, 0)).toBe(p.options[0]);
    expect(optionAt(p, 1)).toBe(p.options[1]);
    expect(optionAt(p, p.options.length)).toBe(p.options[0]);
  });

  it("has a day's own ideas for Christmas Eve and New Year's Eve", () => {
    const eve = planDays([dayOf(24), dayOf(31)], [], prefs({ who: "family" }), {
      ...ctx,
      today: "2026-12-31",
    });
    expect(eve[0]!.name).toBe("Christmas Eve");
    expect(eve[0]!.options[0]!.key).toMatch(/christmas-eve-box|track-santa/);
    expect(eve[1]!.options[0]!.key).toMatch(/noon-countdown|nye-at-home/);
  });

  it("says an idea is an idea and a listing is a listing", () => {
    const plans = plan(prefs());
    for (const o of plans.flatMap((p) => p.options)) {
      if (o.kind === "idea") {
        expect(o.because).toMatch(/^An idea, not a listing/);
        expect(o.details).toBeUndefined();
      } else expect(o.details).toMatch(/^\/passport\//);
    }
  });
});

describe("ideas belong to their days", () => {
  it("keeps day ideas on their day", () => {
    const box = ADVENT_IDEAS.find((i) => i.id === "christmas-eve-box")!;
    expect(ideaOnDay(box, "2026-12-24")).toBe(true);
    expect(ideaOnDay(box, "2026-12-23")).toBe(false);
    const wishes = ADVENT_IDEAS.find((i) => i.id === "wishes-jar")!;
    expect(ideaOnDay(wishes, "2027-01-01")).toBe(true);
    expect(ideaOnDay(wishes, "2026-12-29")).toBe(false);
    const santa = ADVENT_IDEAS.find((i) => i.id === "letters-to-santa")!;
    expect(ideaOnDay(santa, "2026-12-26")).toBe(false);
  });

  it("names no venue, time or price", () => {
    for (const i of ADVENT_IDEAS)
      expect(`${i.title} ${i.line}`).not.toMatch(
        /\$\d|\b\d{1,2}(:\d\d)? ?(am|pm)\b/i,
      );
  });
});

describe("progress on this browser", () => {
  it("counts, swaps and survives bad storage", () => {
    let p = toggleDone(EMPTY_PROGRESS, 3, {
      key: "i:cookies",
      title: "Bake Christmas cookies",
      emoji: "🍪",
    });
    p = swap(p, 4);
    p = swap(p, 3); // done stays done
    expect(completedCount(p)).toBe(1);
    expect(p.swaps).toEqual({ 4: 1 });
    expect(readProgress(JSON.stringify(p))).toEqual(p);
    expect(readProgress("nope")).toEqual(EMPTY_PROGRESS);
    expect(
      readProgress('{"done":{"99":{"key":"x","title":"y","emoji":"z"}}}'),
    ).toEqual(EMPTY_PROGRESS);
    expect(progressLine(7)).toBe("You've completed 7 adventures!");
    expect(toggleDone(p, 3, undefined).done).toEqual({});
  });

  it("says a town once", () => {
    expect(oncePerPart("3975 June Springs Rd., Kelowna · Kelowna")).toBe(
      "3975 June Springs Rd., Kelowna",
    );
    expect(oncePerPart("Polson Park · Vernon")).toBe("Polson Park · Vernon");
    expect(oncePerPart("Vernon · Vernon")).toBe("Vernon");
  });

  it("reads the lowest stated price", () => {
    expect(lowestPrice("Tickets: $45 adults, $20 kids")).toBe(20);
    expect(lowestPrice("By donation")).toBeUndefined();
  });
});

describe("Advent Preview Mode (M1074)", () => {
  it("is on now, and ends at midnight Pacific on December 1", () => {
    expect(previewActive(new Date("2026-11-24T12:00:00Z"), undefined)).toBe(
      true,
    );
    // 11:59 pm PST, November 30
    expect(previewActive(new Date("2026-12-01T07:59:59Z"), undefined)).toBe(
      true,
    );
    // 12:00 am PST, December 1
    expect(previewActive(new Date("2026-12-01T08:00:00Z"), undefined)).toBe(
      false,
    );
    expect(previewActive(new Date("2026-12-10T08:00:00Z"), undefined)).toBe(
      false,
    );
  });

  it("can be switched off sooner, never on after the end", () => {
    expect(previewActive(new Date("2026-11-24T12:00:00Z"), "off")).toBe(false);
    expect(previewActive(new Date("2026-12-02T12:00:00Z"), "on")).toBe(false);
  });

  it("opens all 25 doors, each with something behind it, on any day", () => {
    const days = previewDays();
    expect(days).toHaveLength(25);
    const plans = planDays(days, [], DEFAULT_PREFS, {
      at: "kelowna",
      townName: "Kelowna",
      today: "2026-11-24",
    });
    expect(plans).toHaveLength(25);
    for (const p of plans) {
      expect(p.options.length, `door ${p.n}`).toBeGreaterThan(0);
      for (let swaps = 0; swaps < p.options.length; swaps++) {
        const o = optionAt(p, swaps);
        expect(o?.title, `door ${p.n} option ${swaps}`).toBeTruthy();
      }
    }
  });
});
