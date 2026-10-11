import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { defaultFeed } from "@/domain/discovery/defaultFeed";
import { townById } from "@/domain/discovery/towns";
import { readBrief, reviseBrief, heardIn, type DayBrief } from "./brief";
import { buildDay } from "./build";
import { needsStart } from "./start";
import { travelIn, withoutAvailability, ageIn } from "./intent";

/**
 * **The eight sentences M200's independent audit broke GO HAVE A DAY with.**
 *
 * Run against `docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz`:
 * a body real Atlas served on 2026-10-11, saved. It is a **fixture** — it
 * proves the code against fixed real data, not against today's Atlas, and
 * the release notes say so. Nothing here is mocked data: no place is
 * invented, and the pool goes through the same mapper and feed policy the
 * `/go` page applies.
 *
 * `BEFORE` is what the same sentence did at c1751e9 (integration), captured
 * by running that code over this fixture.
 */
const raw = JSON.parse(
  gunzipSync(
    readFileSync(
      resolve(
        __dirname,
        "../../../docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz",
      ),
    ),
  ).toString("utf8"),
) as { candidates?: DiscoveryCandidate[] } | DiscoveryCandidate[];
const candidates = Array.isArray(raw) ? raw : (raw.candidates ?? []);
const pool = defaultFeed(candidates.map(candidateToExperience));
const NOW = { nowMinutes: 15 * 60 + 26 };

const town = (id: string) => townById(id)!;
const build = (
  brief: DayBrief,
  extra: Partial<Parameters<typeof buildDay>[0]> = {},
) => buildDay({ pool, brief, ...extra });

describe("the eight sentences", () => {
  it("“Scuba diving with sharks tonight” is a request nothing may replace", () => {
    const brief = readBrief(
      "Scuba diving with sharks tonight",
      { town: town("kelowna") },
      NOW,
    );
    expect(brief.interests).toEqual(
      expect.arrayContaining(["scuba diving", "sharks"]),
    );
    expect(brief.when).toBe("evening");
    const day = build(brief);
    expect(day.unmet?.map((u) => u.activity)).toContain("sharks");
    expect(day.stops).toHaveLength(0);
    expect(day.opening).toMatch(/sharks/);
    expect(day.opening).not.toMatch(/Otter Lake|Queen Elizabeth/);
  });

  it("“I have two hours free” is two hours, and not a budget", () => {
    const brief = readBrief("I have two hours free", {}, NOW);
    expect(brief.hours).toBe(2);
    expect(brief.budget).toBeUndefined();
    expect(brief.withinMinutes).toBeUndefined();
  });

  it("“free activities” is a price preference, and not time", () => {
    const brief = readBrief("Find me free activities", {}, NOW);
    expect(brief.budget).toBe(0);
    expect(brief.hours).toBeUndefined();
    expect(
      readBrief("I'm free this afternoon, something free", {}).budget,
    ).toBe(0);
    expect(readBrief("I'm free this afternoon", {}).budget).toBeUndefined();
  });

  it("“I'll drive two hours for something special” is how far, not how long", () => {
    const brief = readBrief(
      "I'll drive two hours for something special",
      { town: town("kelowna") },
      NOW,
    );
    expect(brief.hours).toBeUndefined();
    expect(brief.withinMinutes).toBe(120);
    expect(brief.withinKm).toBe(96);
    expect(brief.budget).toBeUndefined();
  });

  it("“Within 30 minutes of Kelowna” is minutes of travel, from Kelowna", () => {
    const brief = readBrief("Within 30 minutes of Kelowna", {}, NOW);
    expect(brief.town?.id).toBe("kelowna");
    expect(brief.withinMinutes).toBe(30);
    expect(brief.withinKm).toBe(24);
    expect(brief.hours).toBeUndefined();
    const day = build(brief);
    expect(day.radiusKm).toBe(24);
    expect(day.radiusAssumed).toBe(false);
    expect(day.stops.length).toBeGreaterThan(0);
  });

  it("“Taking my family out this afternoon” asks where, and does not guess", () => {
    const brief = readBrief("Taking my family out this afternoon", {}, NOW);
    expect(brief.party).toBe("family");
    expect(brief.when).toBe("afternoon");
    expect(brief.town).toBeUndefined();
    expect(needsStart(brief)).toBe(true);
    // Once somebody says where, the day is local — never province-wide.
    const here = readBrief(
      "Taking my family out this afternoon",
      { town: town("vernon") },
      NOW,
    );
    expect(needsStart(here)).toBe(false);
    const day = build(here);
    expect(day.stops.length).toBeGreaterThan(0);
    for (const stop of day.stops) {
      const km = stop.km;
      if (km !== undefined) expect(km).toBeLessThan(40);
    }
  });

  it("“No museums” leaves museums out and says so", () => {
    const brief = readBrief("No museums", { town: town("vancouver") }, NOW);
    expect(brief.avoid).toContain("museums");
    const day = build({ ...brief, hours: 6 });
    expect(day.stops.length).toBeGreaterThan(0);
    for (const stop of day.stops)
      expect(
        `${stop.experience.subtype} ${stop.experience.title}`.toLowerCase(),
      ).not.toMatch(/museum/);
  });

  it("“Keep us indoors” is kept: nothing Atlas says is outdoors, and what it cannot vouch for is said", () => {
    const base = readBrief("Half a day near Kelowna", {}, NOW);
    const next = reviseBrief(base, "Keep us indoors", NOW);
    expect(next.shelter).toBe("indoor");
    expect(heardIn(base, next).join(" ")).toMatch(/under cover/i);
    const day = build(next);
    for (const stop of day.stops) expect(stop.rain).not.toBe("exposed");
    expect(day.unknowns.join(" ")).toMatch(/Under cover/);
  });

  it("“Let's do Kelowna instead” moves the start and keeps what was kept", () => {
    const base = readBrief("Half a day near Vernon", {}, NOW);
    const first = build(base);
    const keptId = first.stops[0]!.experience.id;
    const next = reviseBrief(base, "Let's do Kelowna instead", NOW);
    expect(next.town?.id).toBe("kelowna");
    expect(next.hours).toBe(4);
    expect(heardIn(base, next).join(" ")).toMatch(/Kelowna/);
    const day = build(next, { keep: [keptId] });
    expect(day.stops.some((s) => s.experience.id === keptId && s.kept)).toBe(
      true,
    );
    const others = day.stops.filter((s) => !s.kept);
    expect(others.length).toBeGreaterThan(0);
  });
});

describe("the readings underneath", () => {
  it("separates travel from the length of the day", () => {
    expect(travelIn("an adventure within 30 minutes").minutes).toBe(30);
    expect(travelIn("a 45 minute drive").minutes).toBe(45);
    expect(travelIn("something an hour away").minutes).toBe(60);
    expect(travelIn("willing to travel up to 90 minutes").minutes).toBe(90);
    expect(travelIn("two hours of kayaking").minutes).toBeUndefined();
    expect(travelIn("home within 2 hours").minutes).toBeUndefined();
    expect(readBrief("drive an hour, home by 5, four hours", {}).hours).toBe(4);
  });

  it("keeps “home by 5” a deadline", () => {
    const brief = readBrief("Leave at 10, home by 5", {});
    expect(brief.homeBy).toBe(17 * 60);
    expect(brief.hours).toBe(7);
    expect(brief.withinMinutes).toBeUndefined();
  });

  it("strips availability but not price", () => {
    expect(withoutAvailability("two hours free")).not.toMatch(/free/);
    expect(withoutAvailability("free things to do")).toMatch(/free/);
  });

  it("reads the youngest's age in the ways people say it", () => {
    expect(ageIn("youngest is 6")).toBe(6);
    expect(ageIn("she's 6")).toBe(6);
    expect(ageIn("the kids are 9 and 6")).toBe(6);
    expect(ageIn("with a five-year-old")).toBe(5);
    expect(ageIn("a kid")).toBeUndefined();
  });

  it("changes the age in a revision and keeps the rest", () => {
    const base = readBrief("Half a day near Vernon with the kids", {}, NOW);
    const next = reviseBrief(base, "youngest is 6", NOW);
    expect(next.childAge).toBe(6);
    expect(next.town?.id).toBe("vernon");
    expect(heardIn(base, next)).toContain("Youngest is 6.");
  });
});
