import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { dayPool } from "@/lib/go/pool";
import { forDiscoveryPool } from "@/domain/discovery/hygiene";
import { dream, NOT_A_PHOTOGRAPH, lowestDollars } from "./compose";
import { figureRounds, sentenceFrom } from "./figure";
import { ingredientsIn } from "./ingredients";
import { reelFor } from "./reel";

/**
 * **The owner's five intentions (M1130), against Atlas's real corpus.**
 *
 * The committed fixture is Atlas's `/discovery/candidates` of 2026-11-14
 * (docs/product/christmas/verification). These pin the *shape* of an honest
 * answer — real places, the gaps said, nothing swapped in — not its exact
 * places: Atlas will change.
 */
const corpus = path.resolve(
  __dirname,
  "../../../docs/product/christmas/verification/atlas-candidates-2026-11-14.json.gz",
);
const parsed = JSON.parse(gunzipSync(readFileSync(corpus)).toString("utf8"));
const candidates: DiscoveryCandidate[] = Array.isArray(parsed)
  ? parsed
  : parsed.candidates;
const TODAY = "2026-11-26";
const pool = forDiscoveryPool(
  dayPool(candidates, []),
  new Date(`${TODAY}T20:00:00Z`),
);
const ask = (
  turns: string[],
  extra: Partial<Parameters<typeof dream>[0]> = {},
) => dream({ pool, turns, townId: "vernon", today: TODAY, ...extra });
const ids = new Set(pool.map((e) => e.id));

const BORED = "I'm bored. Surprise me.";
const KIDS =
  "I have two kids tomorrow, $40 and four hours. Find skating, Christmas lights and hot chocolate within 10 km.";
const IMPRESS =
  "I want to impress someone. Money isn't an issue. Find an incredible restaurant, Christmas lights and a beautiful hotel.";
const BROKE =
  "We're broke. We love the woods, stars, campfires and free hot springs. Find us an adventure.";
const UNSURE = "I don't know what I want. Help me figure it out.";

describe("reading what was named", () => {
  it("finds each thing, once, in the order it was said", () => {
    expect(ingredientsIn(KIDS).map((i) => i.id)).toEqual([
      "skating",
      "lights",
      "warm-drink",
    ]);
    expect(ingredientsIn(IMPRESS).map((i) => i.id)).toEqual([
      "dinner",
      "lights",
      "stay",
    ]);
    expect(ingredientsIn(BROKE).map((i) => i.id)).toEqual([
      "woods",
      "stars",
      "campfire",
      "hot-springs",
    ]);
  });
  it("reads hot chocolate as a drink, never as a hot spring", () => {
    expect(ingredientsIn("hot chocolate").map((i) => i.id)).toEqual([
      "warm-drink",
    ]);
  });
});

describe("1 — I'm bored. Surprise me.", () => {
  const a = ask([BORED]);
  it("surprises, with pictured real places near the town, and a day", () => {
    expect(a.mode).toBe("surprise");
    expect(a.scenes.length).toBe(3);
    for (const s of a.scenes)
      for (const c of s.near) {
        expect(ids.has(c.id)).toBe(true);
        expect(c.photo).toBeDefined();
        expect(c.km!).toBeLessThanOrEqual(a.radiusKm);
      }
    expect(a.day?.stops.length).toBeGreaterThanOrEqual(2);
  });
  it("is a different surprise on another throw", () => {
    const again = ask([BORED], { seed: 1 });
    expect(again.scenes.map((s) => s.near[0]?.id)).not.toEqual(
      a.scenes.map((s) => s.near[0]?.id),
    );
  });
});

describe("2 — two kids, tomorrow, $40, four hours, within 10 km", () => {
  const a = ask([KIDS]);
  it("hears every constraint", () => {
    const heard = a.heard.map((h) => h.label);
    expect(heard).toEqual(
      expect.arrayContaining(["kids", "4 hours", "$40", "tomorrow"]),
    );
    expect(a.on).toBe("2026-11-27");
    expect(a.radiusKm).toBe(10);
  });
  it("answers skating with rinks that say so, inside 10 km", () => {
    const rinks = a.scenes.find((s) => s.id === "skating")!;
    expect(rinks.near.length).toBeGreaterThan(0);
    for (const c of rinks.near) {
      expect(c.km!).toBeLessThanOrEqual(10);
      expect(c.listed.join(" ")).toMatch(/skat|rink|shinny/i);
    }
  });
  it("calls a café a café, and nothing over the budget is offered", () => {
    const drink = a.scenes.find((s) => s.id === "warm-drink")!;
    expect(drink.near.length).toBeGreaterThan(0);
    for (const s of a.scenes)
      for (const c of [...s.near, ...s.further]) {
        const dollars = c.facts.map(lowestDollars).find((d) => d !== undefined);
        if (dollars !== undefined) expect(dollars).toBeLessThanOrEqual(40);
      }
  });
  it("never puts lights on the day that aren't on that day", () => {
    const day = a.day!;
    const lights = a.scenes.find((s) => s.id === "lights")!;
    const elsewhere = [...lights.near, ...lights.further].filter(
      (c) => c.notOnDay,
    );
    for (const c of elsewhere)
      expect(day.stops.map((s) => s.id)).not.toContain(c.id);
  });
  it("hands the same day to Go Have a Day", () => {
    expect(a.day!.goHref).toMatch(/^\/go\?say=/);
    expect(a.day!.goHref).toContain("at=vernon");
    expect(a.day!.goHref).toContain("on=2026-11-27");
  });
  it("leaves the rest alone when one thing is taken away", () => {
    const b = ask([KIDS, "skip the lights"]);
    expect(b.scenes.map((s) => s.id)).toEqual(["skating", "warm-drink"]);
    expect(b.radiusKm).toBe(10);
    expect(b.on).toBe("2026-11-27");
  });
});

describe("3 — impress someone, money no object", () => {
  const a = ask([IMPRESS]);
  it("is for two, with no budget heard", () => {
    expect(a.heard.map((h) => h.label)).toEqual(
      expect.arrayContaining(["for two", "no budget"]),
    );
  });
  it("leads dinner with a real restaurant, never a café or a quick bite", () => {
    const dinner = a.scenes.find((s) => s.id === "dinner")!;
    expect(dinner.near.length).toBeGreaterThan(0);
    for (const c of dinner.near)
      expect(`${c.subtype} ${c.title}`).not.toMatch(
        /cafe|café|coffee|fast.food|bakery/i,
      );
    expect(dinner.near[0]!.title).not.toMatch(/pizz|burger/i);
  });
  it("offers somewhere to stay because it was asked, and ends the night there", () => {
    const stay = a.scenes.find((s) => s.id === "stay")!;
    expect(stay.near.length).toBeGreaterThan(0);
    const last = a.day!.stops[a.day!.stops.length - 1]!;
    expect(last.id).toBe(stay.near[0]!.id);
  });
});

describe("4 — broke: woods, stars, campfires, free hot springs", () => {
  const a = ask([BROKE]);
  it("hears free", () => {
    expect(a.heard.map((h) => h.label)).toContain("free");
  });
  it("never invents a hot spring, nor swaps a spa in for one", () => {
    const springs = a.scenes.find((s) => s.id === "hot-springs")!;
    for (const c of [...springs.near, ...springs.further])
      expect(c.listed.join(" ")).toMatch(/hot ?spring/i);
    if (springs.near.length === 0) expect(springs.gap).toBeTruthy();
  });
  it("finds campfires only where a place states them", () => {
    const fire = a.scenes.find((s) => s.id === "campfire")!;
    for (const c of fire.near)
      expect(c.listed.join(" ")).toMatch(/campfire|fire ?pit|fire ring/i);
  });
  it("offers nothing with a stated price", () => {
    for (const s of a.scenes)
      for (const c of s.near)
        expect(c.free || !c.facts.some((f) => /\$\s?\d/.test(f))).toBe(true);
  });
});

describe("5 — I don't know what I want", () => {
  it("asks with photographs instead of a form", () => {
    expect(ask([UNSURE]).mode).toBe("unsure");
    const rounds = figureRounds({ pool, townId: "vernon", today: TODAY });
    expect(rounds.length).toBeGreaterThanOrEqual(3);
    for (const r of rounds)
      for (const o of r.options) {
        expect(ids.has(o.card.id)).toBe(true);
        expect(o.card.photo).toBeDefined();
      }
  });
  it("turns the taps into a sentence the same reader answers", () => {
    const rounds = figureRounds({ pool, townId: "vernon", today: TODAY });
    const sentence = sentenceFrom(rounds.map((r) => r.options[0]));
    const a = ask([sentence]);
    expect(a.mode).toBe("ask");
    expect(a.scenes.length).toBeGreaterThan(0);
  });
});

describe("imagery", () => {
  it("opens on real, pictured places near the town", () => {
    const reel = reelFor({ pool, townId: "vernon", today: TODAY });
    expect(reel.length).toBeGreaterThanOrEqual(3);
    for (const f of reel) expect(f.photo?.label).toBeUndefined();
  });
  it("does not show a logo as a photograph", () => {
    expect(NOT_A_PHOTOGRAPH.test("https://x.com/images/logobanner.png")).toBe(
      true,
    );
    expect(
      NOT_A_PHOTOGRAPH.test("https://x.com/uploads/hillcrest_018.jpg"),
    ).toBe(false);
  });
});
