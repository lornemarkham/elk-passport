import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import type { CandidateSuitability } from "@/lib/data/types";
import {
  ageBecause,
  ageEvidence,
  ageLine,
  excludesAge,
  needsAdult,
  speaksToAge,
  splitByAge,
} from "./suitability";

/**
 * **The last place Passport was guessing about people.**
 *
 * `CHILD_DOABLE` is a hardcoded list of fourteen affordance words —
 * `playground`, `swimming`, `skating` — that Passport treated as evidence a
 * child would be fine. It is the same shape as the `PLAINLY_OUTDOOR` list
 * that called a picnic shelter outdoor, and it was wrong in both directions: a
 * 19+ venue with a playground passed it, and **Jump2it Indoor Playground** —
 * which states *"Activities for children up to 9 years old"* — was invisible
 * to it.
 *
 * `candidate-suitability/1` answers `?childAge=N` with a verdict and the
 * statements behind it. Every fixture below is a real production block.
 */

const subject = (
  title: string,
  suitability?: CandidateSuitability,
): Experience =>
  ({
    id: title,
    kind: "Place",
    slug: title,
    title,
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
    ...(suitability ? { suitability } : {}),
  }) as Experience;

/** Jump2it, which states an age outright. */
const JUMP2IT = subject("Jump2it Indoor Playground", {
  stated: "stated",
  statements: [
    {
      about: "age",
      says: "admits",
      strength: "characterisation",
      ages: { max: 9 },
      text: "Age suitability: Activities for children up to 9 years old.",
      basis: "key-fact",
    },
  ],
  forAge: { age: 5, reading: "stated", because: [0] },
});

/** Gerni's Farmhouse: ALL GUESTS MUST BE 16+. */
const SIXTEEN_PLUS = subject("Gerni's Farmhouse", {
  stated: "stated",
  statements: [
    {
      about: "age",
      says: "admits",
      strength: "rule",
      ages: { min: 16 },
      text: "Age Restriction: ALL GUESTS MUST BE 16+.",
      basis: "key-fact",
    },
  ],
  forAge: { age: 5, reading: "excluded", because: [0] },
});

/** Capilano: family-friendly in its prose, with no rule behind it. */
const DESCRIBED = subject("Capilano Suspension Bridge Park", {
  stated: "stated",
  statements: [
    {
      about: "audience",
      says: "families",
      strength: "characterisation",
      scope: "subject",
      text: "a signature Vancouver attraction known for family-friendly activities.",
      basis: "description",
    },
  ],
  forAge: { age: 5, reading: "characterised", because: [0] },
});

/** Vernon Aquatic Centre: a supervision rule, not an age bar. */
const SUPERVISED = subject("Vernon Aquatic Centre", {
  stated: "stated",
  statements: [
    {
      about: "supervision",
      says: "accompanied",
      strength: "rule",
      ages: { max: 12 },
      text: "Swimmers, 12 years and under, must be accompanied by an adult.",
      basis: "key-fact",
    },
  ],
  forAge: { age: 5, reading: "unknown", because: [] },
});

/** Field of Screams: advised against, with the parent left to decide. */
const ADVISED_AGAINST = subject("Field of Screams", {
  stated: "stated",
  statements: [
    {
      about: "age",
      says: "not-recommended",
      strength: "advisory",
      ages: { max: 11 },
      text: "The event is not recommended for children under 12, but parents may decide.",
      basis: "key-fact",
    },
  ],
  forAge: { age: 5, reading: "advised-against", because: [0] },
});

/** 93% of the corpus for a five-year-old. */
const SILENT = subject("Deer Park", {
  stated: "unknown",
  forAge: { age: 5, reading: "unknown", because: [] },
});

/** Served without the contract at all. */
const NO_CONTRACT = subject("Somewhere");

describe("reading Atlas's verdict", () => {
  it("separates a stated rule from a turn of phrase", () => {
    // Ten subjects carry a rule admitting a five-year-old; 137 merely read as
    // family-ish. Rendering those as the same claim is how somebody ends up
    // at a 19+ venue because the copy mentioned families.
    expect(ageEvidence(JUMP2IT, 5).verdict).toBe("welcome");
    expect(ageEvidence(DESCRIBED, 5).verdict).toBe("described");
  });

  it("treats advice against as exclusion, not as silence", () => {
    expect(excludesAge(ADVISED_AGAINST, 5)).toBe(true);
    expect(excludesAge(SIXTEEN_PLUS, 5)).toBe(true);
  });

  it("never answers about an age nobody asked about", () => {
    // The quiet failure: answering a question about a five-year-old with a
    // verdict computed for a twelve-year-old.
    expect(ageEvidence(JUMP2IT, 12).verdict).toBe("unknown");
    expect(ageEvidence(JUMP2IT, undefined).verdict).toBe("unknown");
  });

  it("says nothing where Atlas says nothing", () => {
    expect(ageEvidence(SILENT, 5).verdict).toBe("unknown");
    expect(ageEvidence(NO_CONTRACT, 5).verdict).toBe("unknown");
    expect(speaksToAge(SILENT, 5)).toBe(false);
    // Silence is not exclusion, which is the rule that keeps 93% of the
    // corpus from being quietly condemned.
    expect(excludesAge(SILENT, 5)).toBe(false);
    expect(excludesAge(NO_CONTRACT, 5)).toBe(false);
  });

  it("carries the sentence the verdict was read from", () => {
    expect(ageBecause(JUMP2IT, 5)).toContain("up to 9 years old");
    expect(ageBecause(SILENT, 5)).toBeUndefined();
  });
});

describe("what a person is told", () => {
  it("never says a bare 'suitable'", () => {
    expect(ageLine(JUMP2IT, 5)).toBe("Admits 5-year-olds");
    expect(ageLine(DESCRIBED, 5)).toBe(
      "Described for families — no stated age rule",
    );
    expect(ageLine(SIXTEEN_PLUS, 5)).toBe("Not for a 5-year-old");
  });

  it("says nothing at all where Atlas said nothing", () => {
    expect(ageLine(SILENT, 5)).toBeUndefined();
    expect(ageLine(JUMP2IT, undefined)).toBeUndefined();
  });

  it("surfaces a supervision rule that applies to this child", () => {
    expect(needsAdult(SUPERVISED, 5)).toContain("accompanied by an adult");
    // Thirteen is outside the stated band, so the rule does not apply.
    expect(needsAdult(SUPERVISED, 13)).toBeUndefined();
    expect(needsAdult(SUPERVISED, undefined)).toBeUndefined();
  });
});

describe("the six buckets", () => {
  const POOL = [
    JUMP2IT,
    DESCRIBED,
    SIXTEEN_PLUS,
    ADVISED_AGAINST,
    SUPERVISED,
    SILENT,
    NO_CONTRACT,
  ];

  it("sorts each subject into exactly one", () => {
    const split = splitByAge(POOL, 5);
    expect(split.welcome.map((e) => e.title)).toEqual([
      "Jump2it Indoor Playground",
    ]);
    expect(split.described.map((e) => e.title)).toEqual([
      "Capilano Suspension Bridge Park",
    ]);
    expect(split.excluded.map((e) => e.title)).toEqual([
      "Gerni's Farmhouse",
      "Field of Screams",
    ]);
    expect(split.unknown).toHaveLength(3);
  });

  it("loses nobody", () => {
    const s = splitByAge(POOL, 5);
    const total =
      s.welcome.length +
      s.described.length +
      s.priced.length +
      s.excluded.length +
      s.unclear.length +
      s.unknown.length;
    expect(total).toBe(POOL.length);
  });

  it("puts everything in unknown when nobody stated an age", () => {
    // No age, no verdict — and emphatically not a default of five.
    expect(splitByAge(POOL, undefined).unknown).toHaveLength(POOL.length);
  });
});
