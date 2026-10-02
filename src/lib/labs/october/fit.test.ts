import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/movies/catalogue";
import { MAKING } from "@/lib/making/catalogue";
import {
  byFit,
  closingSoon,
  eveningLine,
  fitFor,
  mixSources,
  sayOnce,
  weatherFrom,
  type Context,
} from "./fit";
import {
  possibilityFromDoing,
  possibilityFromFilm,
  type Possibility,
} from "./possibility";

/**
 * **What is being tested is the promise that weather changes discovery.**
 *
 * The failure this guards against is the one the brief names: weather that is
 * printed beside a result rather than deciding which result it is. So the
 * tests compare two orderings of the same pool under two skies and require
 * them to differ — and separately require that nothing was removed to achieve
 * it, because a forecast is a probability and cancelling somebody's plans is
 * not Passport's job.
 */

const TODAY = "2026-10-08";

const thing = (over: Partial<Possibility>): Possibility => ({
  id: over.id ?? "x",
  source: "atlas",
  title: over.title ?? "A thing",
  availability: {
    shape: "fixed",
    label: "THU",
    days: [TODAY],
    tonight: true,
  },
  setting: "unknown",
  href: "/",
  text: "",
  tags: [],
  ...over,
});

const ctx = (over: Partial<Context> = {}): Context => ({
  today: TODAY,
  weather: {},
  ...over,
});

const WET = ctx({
  weather: { sky: "precipitating", wet: 0.9, light: "night" },
});
const CLEAR = ctx({ weather: { sky: "clear", lowC: 4, light: "night" } });

describe("the sky moves things, and says why", () => {
  const stars = thing({ id: "a", title: "Draconids", setting: "astronomy" });
  const haunt = thing({ id: "b", title: "A haunt", setting: "outdoor-night" });
  const indoors = thing({ id: "c", title: "A film", setting: "indoor" });

  it("puts a clear sky at the top of the one thing that needs it", () => {
    const order = [indoors, haunt, stars].sort(byFit(CLEAR));
    expect(order[0].id).toBe("a");
    expect(fitFor(stars, CLEAR).because).toMatch(/clear/i);
  });

  it("puts the dry things first when it is raining", () => {
    const order = [stars, haunt, indoors].sort(byFit(WET));
    expect(order[0].id).toBe("c");
    expect(fitFor(indoors, WET).because).toMatch(/rain/i);
  });

  it("is a different page under a different sky", () => {
    const pool = [stars, haunt, indoors];
    expect([...pool].sort(byFit(WET)).map((p) => p.id)).not.toEqual(
      [...pool].sort(byFit(CLEAR)).map((p) => p.id),
    );
  });

  it("never removes anything for weather", () => {
    const pool = [stars, haunt, indoors];
    expect([...pool].sort(byFit(WET))).toHaveLength(3);
    // The haunt is still in there on a wet night, lower down.
    expect([...pool].sort(byFit(WET)).map((p) => p.id)).toContain("b");
  });

  it("says nothing about the evening when nobody asked the sky", () => {
    expect(eveningLine({})).toBeUndefined();
    expect(weatherFrom(undefined, TODAY, undefined).sky).toBeUndefined();
  });

  it("demotes a morning event at night, but only when a clock was stated", () => {
    const morning = thing({
      id: "m",
      availability: {
        shape: "fixed",
        label: "SUN · 9 AM",
        days: [TODAY],
        tonight: true,
        hour: 9,
      },
    });
    const unknownHour = thing({ id: "u" });
    expect(fitFor(morning, CLEAR).score).toBeLessThan(
      fitFor(unknownHour, CLEAR).score,
    );
  });
});

describe("a run that is nearly over", () => {
  const run = (from: number, to: number) =>
    Array.from(
      { length: to - from + 1 },
      (_, i) => `2026-10-${String(from + i).padStart(2, "0")}`,
    );

  it("knows the final night", () => {
    expect(closingSoon(run(1, 8), TODAY)).toEqual({
      lastDay: TODAY,
      daysLeft: 1,
    });
  });

  it("is not interested in a one-off or in something with a week to run", () => {
    expect(closingSoon([TODAY], TODAY)).toBeUndefined();
    expect(closingSoon(run(1, 31), TODAY)).toBeUndefined();
  });

  it("answers no for a film and for a Doing, rather than throwing", () => {
    expect(
      closingSoon(possibilityFromFilm(CATALOGUE[0]).availability.days, TODAY),
    ).toBeUndefined();
    expect(
      closingSoon(possibilityFromDoing(MAKING[0]).availability.days, TODAY),
    ).toBeUndefined();
  });
});

describe("no catalogue gets to speak four times in a row", () => {
  const run = (sources: string) =>
    [...sources].map((s, i) => ({ source: s, i }));

  it("breaks up a run by pulling the next different source forward", () => {
    const mixed = mixSources(run("mmmmmaa"));
    const sources = mixed.map((x) => x.source).join("");
    expect(longestRun(sources)).toBeLessThanOrEqual(3);
  });

  it("keeps every item — it reorders, it never drops", () => {
    const input = run("mmmmmaadd");
    const mixed = mixSources(input);
    expect(mixed).toHaveLength(input.length);
    expect([...mixed].sort((a, b) => a.i - b.i)).toEqual(input);
  });

  it("lets a run continue when there is genuinely nothing else left", () => {
    const only = run("mmmmm");
    expect(mixSources(only)).toHaveLength(5);
  });

  it("leaves the best thing at the top", () => {
    const input = run("mmaa");
    expect(mixSources(input)[0]).toEqual(input[0]);
  });
});

function longestRun(s: string): number {
  let best = 0;
  let run = 0;
  let last = "";
  for (const c of s) {
    run = c === last ? run + 1 : 1;
    last = c;
    best = Math.max(best, run);
  }
  return best;
}

describe("a reason said once", () => {
  it("lets the first card carry it and silences the repeats", () => {
    const once = sayOnce();
    expect(once("Rain tonight. This one is dry.")).toBe(
      "Rain tonight. This one is dry.",
    );
    expect(once("Rain tonight. This one is dry.")).toBeUndefined();
    expect(once("Rain tonight. This one is dry.")).toBeUndefined();
  });

  it("still says a different reason", () => {
    const once = sayOnce();
    once("Rain tonight. This one is dry.");
    expect(once("Clear sky tonight — the one thing this needs.")).toBe(
      "Clear sky tonight — the one thing this needs.",
    );
  });

  it("passes nothing through as nothing", () => {
    expect(sayOnce()(undefined)).toBeUndefined();
  });

  it("is per page, not global", () => {
    const a = sayOnce();
    const b = sayOnce();
    a("Rain tonight. This one is dry.");
    expect(b("Rain tonight. This one is dry.")).toBe(
      "Rain tonight. This one is dry.",
    );
  });
});

describe("ties do not look like a database", () => {
  it("breaks equal scores on something that is not the name", () => {
    const same = ["Arachnophobia", "Beetlejuice", "Casper", "Coraline"].map(
      (title) =>
        thing({
          id: title,
          title,
          setting: "indoor",
          availability: {
            shape: "anytime",
            label: "ANY NIGHT",
            days: [],
            tonight: true,
          },
        }),
    );
    const order = [...same].sort(byFit(ctx())).map((p) => p.title);
    expect(order).not.toEqual([...order].sort());
  });

  it("gives the same order twice, so the server and browser agree", () => {
    const pool = ["a", "b", "c", "d", "e"].map((id) =>
      thing({ id, title: id }),
    );
    expect([...pool].sort(byFit(ctx())).map((p) => p.id)).toEqual(
      [...pool].sort(byFit(ctx())).map((p) => p.id),
    );
  });
});
