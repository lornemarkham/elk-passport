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
  it("“Scuba diving with sharks tonight” says what Atlas cannot do, and substitutes nothing", () => {
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
    // Nothing Atlas holds mentions sharks: said first, in the opening.
    expect(day.unmet?.map((u) => u.activity)).toEqual(["sharks"]);
    expect(day.opening).toMatch(/^Nothing Atlas holds says it offers sharks/);
    // What is left is what offers the other thing they asked for.
    expect(day.stops.length).toBeGreaterThan(0);
    for (const stop of day.stops.filter((s) => !s.kept))
      expect(stop.experience.title).not.toMatch(/Queen Elizabeth|Otter Lake/);
  });

  it("a request nothing offers at all builds no day, and no other kind of day", () => {
    const brief = readBrief(
      "Shark diving tonight",
      { town: town("kelowna") },
      NOW,
    );
    const day = build(brief);
    expect(day.stops).toHaveLength(0);
    expect(day.opening).toMatch(/sharks/);
    // Elsewhere, even scuba is out of range: said with the nearest.
    const far = build(
      readBrief("Scuba diving", { town: town("vancouver") }, NOW),
    );
    expect(far.stops).toHaveLength(0);
    expect(far.unmet?.[0]?.nearest?.km).toBeGreaterThan(100);
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
    expect(heardIn(base, next).join(" ")).toMatch(/indoors/i);
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

/**
 * **What the release candidate's independent review found** (M207), against
 * the same fixture. The paper and Go Offline replay the chosen stops; they
 * must say what the screen said about what is missing.
 */
describe("the paper says what the screen said", () => {
  const replay = (brief: DayBrief, ids: readonly string[]) =>
    buildDay({
      pool: pool.filter((e) => ids.includes(e.id)),
      brief,
      keep: ids,
      order: ids,
      count: ids.length,
      catalogue: pool,
    });

  it("a one-stop day does not claim Atlas has nothing for what the stop doesn't cover", () => {
    const brief = readBrief(
      "hiking, a museum and swimming",
      { town: town("kelowna") },
      NOW,
    );
    const screen = build(brief, { count: 1 });
    const ids = screen.stops.map((s) => s.experience.id);
    expect(ids).toHaveLength(1);
    const paper = replay(brief, ids);
    expect(paper.unmet ?? []).toEqual(screen.unmet ?? []);
    expect(paper.opening).not.toMatch(/Nothing Atlas holds/);
    expect(paper.unknowns.join(" ")).toMatch(/Not in this day/);
    // Without the catalogue it would have said so — the defect, kept visible.
    const blind = buildDay({
      pool: pool.filter((e) => ids.includes(e.id)),
      brief,
      keep: ids,
      order: ids,
      count: ids.length,
    });
    expect(blind.opening).toMatch(/Nothing Atlas holds/);
  });

  it("a partial request prints the missing part, and the stops", () => {
    const brief = readBrief(
      "Scuba diving with sharks tonight",
      { town: town("kelowna") },
      NOW,
    );
    const screen = build(brief);
    const paper = replay(
      brief,
      screen.stops.map((s) => s.experience.id),
    );
    expect(paper.stops.map((s) => s.experience.id)).toEqual(
      screen.stops.map((s) => s.experience.id),
    );
    expect(paper.unmet?.map((u) => u.activity)).toEqual(["sharks"]);
    expect(paper.opening).toMatch(/sharks/);
  });

  it("an activity set aside is said on the paper, not dropped quietly", () => {
    const asked = readBrief(
      "Shark diving tonight",
      { town: town("kelowna") },
      NOW,
    );
    const brief: DayBrief = {
      ...asked,
      interests: asked.interests.filter((i) => i !== "sharks"),
      setAside: ["sharks"],
    };
    const screen = build(brief);
    expect(screen.stops.length).toBeGreaterThan(0);
    const paper = replay(
      brief,
      screen.stops.map((s) => s.experience.id),
    );
    expect(paper.unknowns.join(" ")).toMatch(/plan without it/);
  });
});

/**
 * **Indoors means indoors** (M211). Two hours, a five-year-old, "something
 * indoors": the builder answered with Polson Park and Rutland Lions Park,
 * because a picnic shelter "stands up to rain", and then told the family every
 * stop was under cover. Atlas's `exposure` reading says which places are
 * spent indoors; the builder now asks it.
 */
describe("a two-hour indoor day with a five-year-old", () => {
  const outside = (stop: { experience: { environment?: unknown } }) => {
    const env = stop.experience.environment as
      | {
          setting?: string;
          rain?: { reading?: string };
          exposure?: { value?: string };
        }
      | undefined;
    return (
      env?.setting === "outdoor" ||
      env?.rain?.reading === "exposed" ||
      env?.exposure?.value === "outdoor" ||
      env?.exposure?.value === "sheltered-outdoor"
    );
  };

  for (const [townId, sentence] of [
    ["vernon", "We have two hours with our five-year-old. Something indoors."],
    ["kelowna", "We have two hours with a 5 year old, indoors please"],
  ] as const) {
    it(`${townId}: no stop Atlas says is spent outside, and the count is honest`, () => {
      const brief = readBrief(sentence, { town: town(townId) }, NOW);
      expect(brief.shelter).toBe("indoor");
      expect(brief.hours).toBe(2);
      expect(brief.childAge).toBe(5);
      const day = build(brief);
      expect(day.stops.length).toBeGreaterThan(0);
      for (const stop of day.stops) {
        expect(outside(stop), stop.experience.title).toBe(false);
        expect(stop.experience.title).not.toMatch(/Polson Park|Lions Park/);
      }
      // The count it states is the count of stops Atlas says are indoors.
      const indoorsCount = day.stops.filter((stop) => {
        const env = stop.experience.environment;
        return (
          env?.rain?.reading !== "exposed" &&
          (env?.setting === "indoor" ||
            env?.rain?.reading === "sheltered" ||
            env?.exposure?.value === "indoor")
        );
      }).length;
      const line = day.unknowns.find((u) => u.startsWith("Under cover"))!;
      if (indoorsCount === day.stops.length)
        expect(line).toBe(
          "Under cover — Atlas says every stop here is indoors.",
        );
      else expect(line).toContain(`${indoorsCount} of ${day.stops.length}`);
    });
  }
});

describe("an afternoon that is already over", () => {
  const ask = (nowMinutes: number) =>
    build(
      readBrief(
        "Taking my five year old out this afternoon",
        { town: town("kelowna") },
        { nowMinutes },
      ),
    );
  const over = (unknowns: readonly string[]) =>
    unknowns.filter((u) => /this afternoon is over/.test(u));

  it("said at 6:45 pm, it starts then and says so, instead of passing 9 pm off as an afternoon", () => {
    const day = ask(18 * 60 + 45);
    expect(day.brief.startAt).toBe(18 * 60 + 45);
    expect(over(day.unknowns)).toHaveLength(1);
    expect(over(day.unknowns)[0]).toMatch(/already 6:45 pm/);
  });

  it("said at 3:26 pm, it is still the afternoon and nothing is said", () => {
    expect(over(ask(15 * 60 + 26).unknowns)).toHaveLength(0);
  });

  it("with no clock (not today), it starts at the afternoon's own start and nothing is said", () => {
    const day = build(
      readBrief(
        "Taking my five year old out this afternoon",
        { town: town("kelowna") },
        {},
      ),
    );
    expect(day.brief.startAt).toBe(13 * 60);
    expect(over(day.unknowns)).toHaveLength(0);
  });

  it("tonight is still tonight at 10 pm", () => {
    const day = build(
      readBrief(
        "Something tonight",
        { town: town("kelowna") },
        {
          nowMinutes: 22 * 60,
        },
      ),
    );
    expect(day.unknowns.filter((u) => /is over/.test(u))).toHaveLength(0);
  });
});
