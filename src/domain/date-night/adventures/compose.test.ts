import { describe, expect, it } from "vitest";
import { readDayQuery } from "@/lib/domains/integration/dayQuery";
import { readBrief } from "@/domain/day/brief";
import { townById } from "@/domain/discovery/towns";
import {
  composeDay,
  DEFAULT_ANSWERS,
  sunsetOf,
  type DayAnswers,
} from "./compose";
import { TOMORROW } from "./tomorrow";

const titles = (a: DayAnswers, swap = {}) =>
  composeDay(TOMORROW, a, swap).stops.map((s) => s.option.title);

describe("composeDay — Lorne & Jess, 2 November 2026", () => {
  it("knows when it gets dark (BC keeps UTC−7 from November 2026)", () => {
    const sunset = sunsetOf(TOMORROW)!;
    // About 4:40 pm standard time, so about 5:40 pm on the clock BC now keeps.
    expect(sunset).toBeGreaterThan(17 * 60 + 20);
    expect(sunset).toBeLessThan(17 * 60 + 55);
  });

  it("makes a whole day in an order that makes sense", () => {
    const day = composeDay(TOMORROW, DEFAULT_ANSWERS);
    expect(day.stops.map((s) => s.option.phase)).toEqual([
      "start",
      "explore",
      "experience",
      "unwind",
    ]);
    const [, explore, , unwind] = day.stops;
    // The lake is done before dark; dinner is not at lunchtime.
    expect(explore!.leave).toBeLessThanOrEqual(day.sunset!);
    expect(unwind!.arrive).toBeGreaterThanOrEqual(16 * 60);
    for (const s of day.stops) {
      if (s.option.opens !== undefined)
        expect(s.arrive).toBeGreaterThanOrEqual(s.option.opens);
      if (s.option.closes !== undefined)
        expect(s.leave).toBeLessThanOrEqual(s.option.closes);
    }
  });

  it("is romantic when asked, playful when asked", () => {
    expect(titles({ ...DEFAULT_ANSWERS, moods: ["romantic"] })).toContain(
      "The Edge Restaurant",
    );
    expect(titles({ ...DEFAULT_ANSWERS, moods: ["playful"] })).toContain(
      "BNA Brewing",
    );
  });

  it("pairs an unknown-hours finish with one that is sure to be open", () => {
    const day = composeDay(TOMORROW, {
      ...DEFAULT_ANSWERS,
      moods: ["romantic"],
    });
    expect(day.alternatives.unwind?.[0]?.title).toBe("BNA Brewing");
    expect(day.notes.join(" ")).toMatch(/hasn't published its hours/);
  });

  it("respects no cold water, no drinks and a small budget", () => {
    const day = titles({
      ...DEFAULT_ANSWERS,
      plunge: false,
      drinks: false,
      budget: 1,
    });
    expect(day).not.toContain("Kal Beach");
    expect(day).not.toContain("Kalamalka Lake Park");
    expect(day).not.toContain("BNA Brewing");
    expect(day).not.toContain("The Edge Restaurant");
    expect(day).not.toContain("Planet Bee Honey Farm");
  });

  it("skips the outdoors in the evening and says why", () => {
    const day = composeDay(TOMORROW, { ...DEFAULT_ANSWERS, when: "evening" });
    expect(day.stops.some((s) => s.option.phase === "explore")).toBe(false);
    for (const s of day.stops)
      if (s.option.daylight) expect(s.leave).toBeLessThanOrEqual(day.sunset!);
    expect(day.notes.join(" ")).toMatch(/dark by 5:\d\dpm/);
  });

  it("swaps one beat and leaves the rest alone", () => {
    const before = titles(DEFAULT_ANSWERS);
    const after = titles(DEFAULT_ANSWERS, {
      explore: "6931f16a-d8d9-4707-8780-86ba87ed5941",
    });
    expect(after[1]).toBe("Kal Beach");
    expect(after[0]).toBe(before[0]);
  });

  it("writes a day query the shared core and the Day Builder read back", () => {
    const day = composeDay(TOMORROW, DEFAULT_ANSWERS);
    const q = readDayQuery(Object.fromEntries(new URLSearchParams(day.query)));
    expect(q.stops).toEqual(day.stops.map((s) => s.option.atlasRef));
    expect(q.on).toBe("2026-11-02");
    expect(q.at).toBe("coldstream");
    expect(Object.keys(q.mins)).toHaveLength(day.stops.length);
    const brief = readBrief(q.say, {
      town: townById("coldstream")!,
      on: "2026-11-02",
    });
    expect(brief.party).toBe("couple");
    expect(brief.startAt).toBe(11 * 60 + 30);
  });
});

describe("the answers ride with the day", () => {
  it("round-trips through the ask the core keeps", async () => {
    const { askFrom } = await import("@/lib/adventures/days");
    const { readAnswers, swapsOf } = await import("./compose");
    const a = { ...DEFAULT_ANSWERS, moods: ["playful" as const], short: true };
    const day = composeDay(TOMORROW, a);
    const ask = askFrom(day.query);
    expect(readAnswers(ask)).toEqual(a);
    const stops = day.stops.map((s) => s.option.atlasRef);
    expect(composeDay(TOMORROW, a, swapsOf(TOMORROW, stops)).query).toBe(
      day.query,
    );
    // Shorter: no middle stop.
    expect(day.stops.some((s) => s.option.phase === "experience")).toBe(false);
  });
  it("ignores a day it didn't make", async () => {
    const { readAnswers } = await import("./compose");
    expect(readAnswers("say=a+good+day&at=vernon")).toBeNull();
    expect(readAnswers("night=week.30.3.romantic.1.1.0")).toBeNull();
  });
});
