import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import type { CandidateKnowledge } from "@/lib/data/types";
import {
  WET_CHANCE,
  answerFor,
  childEvidence,
  directionsFor,
  doableEvidence,
  hasSituation,
  readWeather,
  shelterOf,
} from "./situation";

/**
 * **A situation is not a search query, and an inference is not a fact.**
 *
 * The scenario that drove this: *I've got my five-year-old niece for about
 * seven hours and it's pissing rain.* Nothing in it is searchable, and the
 * tempting shortcut — "it is a park, so a five-year-old will like it" — is the
 * fabricated affordance the doctrine forbids.
 *
 * So every assertion below is about the line between what Atlas states and
 * what Passport refuses to invent.
 */

const withKnowledge = (
  knowledge: CandidateKnowledge | undefined,
  over: Partial<Experience> = {},
): Experience =>
  ({
    id: Math.random().toString(36).slice(2),
    kind: "Place",
    slug: "s",
    title: "Somewhere",
    shortDescription: "",
    isActive: true,
    detailReady: true,
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
    ...(knowledge ? { knowledge } : {}),
    ...over,
  }) as Experience;

const offers = (...names: string[]): CandidateKnowledge => ({
  affordances: names.map((name) => ({ name, basis: "offers" })),
});

describe("evidence a child could do something here", () => {
  it("reads an affordance Atlas asserts", () => {
    expect(childEvidence(withKnowledge(offers("Playground")))).toEqual([
      "Playground",
    ]);
  });

  it("reads a feature a publisher listed", () => {
    expect(
      childEvidence(withKnowledge({ features: ["Playground", "Washrooms"] })),
    ).toEqual(["Playground"]);
  });

  it("keeps Atlas's own wording so a card can show its working", () => {
    // "Swimming · Picnic areas" is worth more to a person than a score they
    // would have to trust.
    expect(
      [
        ...childEvidence(withKnowledge(offers("Swimming", "Picnic areas"))),
      ].sort(),
    ).toEqual(["Picnic areas", "Swimming"]);
  });

  it("never guesses from a subtype", () => {
    // The whole temptation: a park *sounds* child-friendly, and a fenced
    // conservation area is a park too.
    const park = withKnowledge(undefined, { subtype: "park" } as never);
    expect(childEvidence(park)).toEqual([]);
  });

  it("never guesses from a name or a description", () => {
    const sounds = withKnowledge(undefined, {
      title: "Kids Adventure Playground World",
      shortDescription: "Perfect for toddlers and young families.",
    } as never);
    expect(childEvidence(sounds)).toEqual([]);
  });

  it("refuses an affordance that is real and not a day with a toddler", () => {
    // Atlas holds snowshoeing and mountain biking. Both are things you can do;
    // neither is an afternoon with a five-year-old.
    expect(
      childEvidence(withKnowledge(offers("mountain biking", "snowshoeing"))),
    ).toEqual([]);
  });

  it("says nothing at all for a candidate Atlas holds no knowledge for", () => {
    expect(childEvidence(withKnowledge(undefined))).toEqual([]);
    expect(doableEvidence(withKnowledge(undefined))).toEqual([]);
  });
});

describe("whether the rain rules it out", () => {
  it("calls a plainly outdoor activity outdoor", () => {
    expect(shelterOf(withKnowledge(offers("Swimming")))).toBe("outdoor");
    expect(shelterOf(withKnowledge({ features: ["Beach"] }))).toBe("outdoor");
  });

  it("never claims anything is indoor", () => {
    // Atlas states no indoor/outdoor fact. Guessing one sends somebody and
    // their niece to a locked door in a downpour.
    const museum = withKnowledge(undefined, { subtype: "museum" } as never);
    const cinema = withKnowledge(offers("Watch a film"));
    expect(shelterOf(museum)).toBe("unknown");
    expect(shelterOf(cinema)).toBe("unknown");
  });

  it("answers unknown rather than outdoor when it has nothing to go on", () => {
    expect(shelterOf(withKnowledge(undefined))).toBe("unknown");
  });
});

describe("what Passport can answer for a situation", () => {
  const pool = [
    withKnowledge(offers("Playground"), { title: "Pine Park" }),
    withKnowledge(offers("Swimming", "Picnic areas"), { title: "Otter Lake" }),
    withKnowledge(offers("Skating"), { title: "Stuart Park Ice Rink" }),
    withKnowledge(offers("mountain biking"), { title: "A bike trail" }),
    withKnowledge(undefined, { title: "An unclassified place" }),
  ];

  it("offers only what has evidence behind it", () => {
    const answer = answerFor(pool, { company: "child" });
    expect(answer.matches.map((e) => e.title).sort()).toEqual([
      "Otter Lake",
      "Pine Park",
      "Stuart Park Ice Rink",
    ]);
  });

  it("counts what the rain argues against", () => {
    const answer = answerFor(pool, { company: "child" }, { wet: true });
    // The playground and the lake; skating is unknown, not outdoor.
    expect(answer.weatherAgainst).toBe(2);
  });

  it("counts nothing against a dry day", () => {
    expect(answerFor(pool, { company: "child" }).weatherAgainst).toBe(0);
  });

  it("admits it cannot narrow a situation it has no evidence for", () => {
    // "Just me" and "with friends" have no Atlas signal at all.
    expect(answerFor(pool, { company: "alone" }).grounded).toBe(false);
    expect(answerFor(pool, { company: "group" }).matches).toEqual([]);
  });

  it("is ungrounded over a pool Atlas knows nothing about", () => {
    const blank = [withKnowledge(undefined), withKnowledge(undefined)];
    expect(answerFor(blank, { company: "child" }).grounded).toBe(false);
  });

  it("knows when nothing has been said yet", () => {
    expect(hasSituation({})).toBe(false);
    expect(hasSituation({ company: "child" })).toBe(true);
  });
});

describe("reading a real forecast", () => {
  const hour = (
    sky: string,
    precipitationChance?: number,
    description?: string,
  ) => ({
    at: "2026-10-11T18:00:00.000Z",
    sky,
    ...(precipitationChance !== undefined ? { precipitationChance } : {}),
    ...(description ? { description } : {}),
  });

  it("calls it wet when something is falling", () => {
    const read = readWeather([hour("precipitating", 90, "Rain")], "MSC")!;
    expect(read.wet).toBe(true);
    expect(read.source).toBe("MSC");
  });

  it("keeps the source's own words rather than rewriting them", () => {
    expect(
      readWeather([hour("overcast", 70, "Chance of showers")], "MSC")!
        .description,
    ).toBe("Chance of showers");
  });

  it("hedges below the threshold the source itself hedges at", () => {
    expect(readWeather([hour("overcast", WET_CHANCE - 1)], "MSC")!.wet).toBe(
      false,
    );
    expect(readWeather([hour("overcast", WET_CHANCE)], "MSC")!.wet).toBe(true);
  });

  it("reports the worst hour of the window, not the first", () => {
    const read = readWeather(
      [hour("clear", 0), hour("precipitating", 95, "Rain"), hour("clear", 5)],
      "MSC",
    )!;
    expect(read.wet).toBe(true);
    expect(read.chance).toBe(95);
  });

  it("says nothing at all when there is no forecast", () => {
    // Not "dry". A product that reads silence as sunshine sends people out
    // in it.
    expect(readWeather([], "MSC")).toBeUndefined();
  });
});

/**
 * **The answer shape, decided by investigation and not yet shipped.**
 *
 * *"What should we do with our day?"* is a question about verbs. The shipped
 * panel answers with nouns — Stuart Park Ice Rink, Deer Park, Marshall Field —
 * which is a list of records that satisfy a query, and is the wrong
 * abstraction however well it is ranked.
 *
 * Measured over the live feed, the verbs Atlas states cluster into genuinely
 * distinct days rather than synonyms: swimming 33 · playground 28 · picnic 13
 * · wildlife 11 · walking 10 · beach 9 · tennis 8 · basketball 7 · skating 7.
 *
 * These pin the shape so the next slice inherits a decision rather than
 * re-deriving it. `directionsFor` is deliberately **not wired to any surface
 * yet** — see the mission report: on a wet day it returns five greyed-out
 * ideas, because every affordance Atlas holds is fair-weather outdoor.
 */
describe("directions — the answer shape", () => {
  const pool = [
    withKnowledge(offers("Swimming"), { title: "Otter Lake" }),
    withKnowledge(offers("Swimming"), { title: "Kekuli Bay" }),
    withKnowledge(offers("Playground"), { title: "Pine Park" }),
    withKnowledge(offers("Skating"), { title: "Stuart Park Ice Rink" }),
    withKnowledge(undefined, { title: "Something unclassified" }),
  ];

  it("answers in verbs rather than in records", () => {
    const directions = directionsFor(pool, { company: "child" });
    expect(directions.map((d) => d.doing)).toEqual([
      "Swimming",
      "Playground",
      "Skating",
    ]);
  });

  it("carries the places behind each, as evidence rather than a ranking", () => {
    const [first] = directionsFor(pool, { company: "child" });
    expect(first!.places.map((p) => p.title)).toEqual([
      "Otter Lake",
      "Kekuli Bay",
    ]);
  });

  it("leads with the direction most places stand behind", () => {
    expect(directionsFor(pool, { company: "child" })[0]!.doing).toBe(
      "Swimming",
    );
  });

  it("marks a direction the rain has already ruled out", () => {
    const wet = directionsFor(pool, { company: "child" }, { wet: true });
    expect(wet.find((d) => d.doing === "Swimming")!.ruledOutByRain).toBe(true);
    // Skating is not *claimed* dry — only not provably outdoor.
    expect(wet.find((d) => d.doing === "Skating")!.ruledOutByRain).toBe(false);
  });

  it("offers nothing for a situation Atlas has no evidence about", () => {
    // Measured: "just me + an hour" and "with friends" both return zero over
    // the live corpus. The shape generalises; the evidence does not.
    expect(directionsFor(pool, { company: "alone" })).toEqual([]);
    expect(directionsFor(pool, { company: "group" })).toEqual([]);
  });

  it("never invents a direction for a place Atlas says nothing about", () => {
    const blank = [withKnowledge(undefined, { title: "A place" })];
    expect(directionsFor(blank, { company: "child" })).toEqual([]);
  });
});
