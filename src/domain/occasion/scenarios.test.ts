import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { dayPool } from "@/lib/go/pool";
import { readBrief } from "@/domain/day/brief";
import { buildDay } from "@/domain/day/build";
import { townById } from "@/domain/discovery/towns";
import { sayFor, shapeById } from "@/domain/christmas/plans";
import { pickChallenges } from "@/domain/christmas/challengePicks";
import { findPlacesFor } from "./ideas";

/**
 * **The mission's real requests, against Atlas's real corpus.**
 *
 * The committed fixture is Atlas's `/discovery/candidates` of 2026-10-24
 * (4,022 candidates; docs/product/christmas/verification). Before this
 * change, request A in Vernon built *Polson Park 6:00 → McDonald's 7:15 →
 * The Perch Winery 8:30* — every stop real, none of them the evening that
 * was asked for. These tests pin the shape of a good answer, not its exact
 * places: Atlas will change.
 */
const corpus = path.resolve(
  __dirname,
  "../../../docs/product/christmas/verification/atlas-candidates-2026-10-24.json.gz",
);
const parsed = JSON.parse(gunzipSync(readFileSync(corpus)).toString("utf8"));
const candidates: DiscoveryCandidate[] = Array.isArray(parsed)
  ? parsed
  : parsed.candidates;
const pool = dayPool(candidates, []);
const vernon = townById("vernon")!;
const origin = { latitude: vernon.latitude, longitude: vernon.longitude };

const TEST_A =
  "I want a fun romantic Christmas date night with mulled wine or hot apple cider, Christmas lights, maybe snow, something cute, cozy, and memorable.";

const plan = (say: string, on: string) =>
  buildDay({ pool, brief: readBrief(say, { town: vernon, on }) });

describe("A — a romantic Christmas date in Vernon, Sat Nov 7", () => {
  const day = plan(
    sayFor({ shape: shapeById("evening"), party: "couple", extra: TEST_A }),
    "2026-11-07",
  );
  const subtypes = day.stops.map((s) =>
    (s.experience.subtype ?? "").toLowerCase(),
  );

  it("is an evening for two, not a list of nearby places", () => {
    expect(day.stops.length).toBeGreaterThanOrEqual(2);
    expect(subtypes.join(" ")).not.toMatch(/fast.food/);
    // Nothing out in the dark, nothing that usually shuts by evening.
    expect(subtypes.join(" ")).not.toMatch(/\bpark\b|winery|cafe|coffee/);
    // One dinner, and it comes first.
    const meals = day.stops.filter((s) =>
      /restaurant|bistro|grill|kitchen|diner/.test(s.experience.subtype ?? ""),
    );
    expect(meals.length).toBe(1);
    expect(day.stops[0]).toBe(meals[0]);
  });

  it("says what it heard, and what it could not find", () => {
    expect(day.occasion?.heard).toMatch(/romantic/);
    expect(day.occasion?.heard).toMatch(/something warm to drink/);
    const missing = day.occasion?.missing.join(" ") ?? "";
    expect(missing).toMatch(/Christmas lights — Atlas has no light display/);
    expect(missing).toMatch(/Snow — that's usually before the snow season/);
  });

  it("reads mulled wine as a warm drink, not a winery", () => {
    expect(day.brief.interests).not.toContain("winery");
  });

  it("leads with dares for two, with real places", () => {
    const picks = pickChallenges({
      said: day.brief.said,
      origin,
      town: "Vernon",
      from: "2026-11-07",
      to: "2026-11-07",
      pool,
      held: new Set(day.stops.map((s) => s.experience.id)),
    });
    const ids = picks.map((p) => p.challenge.id);
    expect(ids.length).toBeLessThanOrEqual(3);
    expect(ids).not.toContain("santa-question");
    expect(ids).toContain("hot-chocolate");
    const lights = picks.find((p) => p.challenge.id === "best-lights");
    expect(lights?.gap).toMatch(/won't point at anyone's house/);
  });
});

describe("B — go ice skating", () => {
  const found = findPlacesFor("Go ice skating", pool, {
    origin,
    town: "Vernon",
    on: "2026-11-07",
  });
  it("names real rinks near Vernon, nearest first, with Atlas's own words", () => {
    expect(found.activity?.key).toBe("skating");
    const titles = found.options.map((o) => o.experience.title);
    expect(titles).toContain("Priest Valley Arena");
    expect(titles).toContain("Kal Tire Place");
    expect(found.options[0]!.km!).toBeLessThan(2);
    for (const o of found.options) expect(o.listed.length).toBeGreaterThan(0);
  });
  it("quotes a rink's own hours on the day, and a season closure", () => {
    const kal = found.options.find(
      (o) => o.experience.title === "Kal Tire Place",
    );
    expect(kal?.onTheDay).toBe("Open till 4 pm that day, by its own hours.");
    const centennial = found.options.find((o) =>
      o.experience.title.startsWith("Centennial"),
    );
    expect(centennial?.onTheDay).toMatch(/closed for the season/);
  });
  it("leaves an idea it cannot read as the person's own", () => {
    expect(findPlacesFor("dinner at mom's", pool, { origin }).activity).toBe(
      undefined,
    );
  });
});

describe("C — a family Christmas day, youngest six", () => {
  const day = plan(
    sayFor({
      shape: shapeById("family-day"),
      party: "family",
      youngest: 6,
      extra: "something festive the kids will love",
    }),
    "2026-12-12",
  );
  it("has nothing for grown-ups only", () => {
    expect(
      day.stops.map((s) => s.experience.subtype ?? "").join(" "),
    ).not.toMatch(/winery|distillery|lounge|\bbar\b|pub/);
  });
  it("changes the dares for the children", () => {
    const picks = pickChallenges({
      said: day.brief.said,
      origin,
      town: "Vernon",
      from: "2026-12-12",
      to: "2026-12-12",
      pool,
      held: new Set(),
    });
    expect(picks.filter((p) => p.challenge.kids).length).toBeGreaterThanOrEqual(
      2,
    );
    expect(picks.map((p) => p.why).join(" ")).not.toMatch(/holding hands/i);
  });
});

describe("D — friends, a snow day", () => {
  const day = plan(
    "a great day out with friends, skiing or snowboarding, good food and drink after",
    "2026-12-12",
  );
  it("is one mountain first, then somewhere after", () => {
    const snow = day.stops.filter((s) =>
      /silver ?star|sovereign|big white/i.test(s.experience.title),
    );
    expect(snow.length).toBe(1);
    expect(day.stops[0]).toBe(snow[0]);
    expect(day.stops.length).toBeLessThanOrEqual(3);
  });
});

describe("a plain day is built as it was", () => {
  it("names no occasion where nothing was said", () => {
    const day = plan("four hours near Vernon", "2026-11-07");
    expect(day.brief.occasion).toBeUndefined();
    expect(day.occasion).toBeUndefined();
  });
});
