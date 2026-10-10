import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import type { CandidateEnvironment } from "@/lib/data/types";
import {
  arguesAgainst,
  mayNotRun,
  placedByWeather,
  rainBecause,
  rainEvidence,
  rainLine,
  splitByRain,
  standsUpToRain,
} from "./environment";

/**
 * **The heuristic this replaced called a picnic shelter outdoor.**
 *
 * Passport decided whether rain mattered by matching activity names against a
 * set of words it considered plainly outdoor. `picnic shelter` was in the set.
 * So Coldstream Park, Kin Beach, Polson Park and Paddlewheel Park — every one
 * of which Atlas now says is **partly sheltered, because it has a picnic
 * shelter** — were reported as ruled out by the rain, on the evidence of the
 * shelter. Allan Brooks Nature Centre, which Atlas says is **indoor**, was
 * called outdoors because it offers birdwatching.
 *
 * Seven candidates were wrong that way, and all seven were wrong in the
 * direction that matters: they hid somewhere dry on a wet day.
 *
 * Every fixture below is a real candidate's real `candidate-environment/1`
 * block, copied from production on 2026-10-10.
 */

const subject = (
  title: string,
  environment?: CandidateEnvironment,
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
    ...(environment ? { environment } : {}),
  }) as Experience;

/** Indoor, and Atlas says so. Passport used to have no idea. */
const MEMORIAL_ARENA = subject("Memorial Arena", {
  setting: "indoor",
  rain: { reading: "sheltered", basis: "derived" },
});

/** The outdoor rink in the square. A different record from the one above. */
const STUART_PARK = subject("Stuart Park", {
  setting: "outdoor",
  rain: { reading: "exposed", basis: "derived" },
  statements: [
    {
      says: "outdoor",
      scope: "activity",
      text: "Family skate",
      basis: "stated-activity",
    },
  ],
});

/** Same rink, the record that carries the warning. */
const STUART_PARK_ICE_RINK = subject("Stuart Park Ice Rink", {
  setting: "unknown",
  rain: { reading: "weather-dependent", basis: "stated" },
  statements: [
    {
      says: "weather-dependent",
      text: "Opening hours: Open daily from dusk to dawn March-November (weather dependent).",
      basis: "key-fact",
    },
  ],
});

/** The case that proves the point: a shelter, called exposed by a word list. */
const COLDSTREAM_PARK = subject("Coldstream Park", {
  setting: "unknown",
  rain: { reading: "partly-sheltered", basis: "derived" },
  statements: [
    {
      says: "covered",
      scope: "activity",
      text: "Picnic shelter",
      basis: "stated-activity",
    },
    {
      says: "covered",
      scope: "part",
      text: "Picnic shelter",
      basis: "feature",
    },
  ],
});

const RUTLAND_LIONS_PARK = subject("Rutland Lions Park", {
  setting: "unknown",
  rain: { reading: "runs-in-rain", basis: "stated" },
});

/** Atlas does not know. 2,561 of 2,683 look like this. */
const DEER_PARK = subject("Deer Park", {
  setting: "unknown",
  rain: { reading: "unknown", basis: "none" },
});

/** An older Atlas, or a candidate served without the block at all. */
const NO_CONTRACT = subject("Somewhere");

const CONFLICTED = subject("A disputed place", {
  setting: "unknown",
  rain: { reading: "conflicting", basis: "derived" },
});

describe("reading what Atlas states", () => {
  it("keeps the reading and the basis apart", () => {
    expect(rainEvidence(COLDSTREAM_PARK)).toMatchObject({
      reading: "partly-sheltered",
      basis: "derived",
    });
    expect(rainEvidence(STUART_PARK_ICE_RINK).basis).toBe("stated");
  });

  it("answers nothing for a candidate served without the contract", () => {
    expect(rainEvidence(NO_CONTRACT)).toEqual({
      reading: "unknown",
      basis: "none",
      statements: [],
    });
  });

  it("keeps the sentences it was read from", () => {
    expect(rainEvidence(COLDSTREAM_PARK).statements).toHaveLength(2);
    expect(rainBecause(COLDSTREAM_PARK)).toBe("Picnic shelter");
    expect(rainBecause(DEER_PARK)).toBeUndefined();
  });
});

describe("what the rain argues against", () => {
  it("is only what Atlas calls exposed", () => {
    expect(arguesAgainst(STUART_PARK)).toBe(true);
    expect(arguesAgainst(COLDSTREAM_PARK)).toBe(false);
    expect(arguesAgainst(MEMORIAL_ARENA)).toBe(false);
  });

  it("is never something Atlas said nothing about", () => {
    // The single rule that stops this becoming the heuristic it replaced.
    expect(arguesAgainst(DEER_PARK)).toBe(false);
    expect(arguesAgainst(NO_CONTRACT)).toBe(false);
    expect(arguesAgainst(CONFLICTED)).toBe(false);
  });

  it("is not a thing that might simply not be running", () => {
    // "Weather dependent" is a warning about whether it is on, not about
    // getting wet. Filed under either neighbour it stops being useful.
    expect(arguesAgainst(STUART_PARK_ICE_RINK)).toBe(false);
    expect(mayNotRun(STUART_PARK_ICE_RINK)).toBe(true);
    expect(mayNotRun(STUART_PARK)).toBe(false);
  });
});

describe("what stands up to rain", () => {
  it("is under cover, partly under cover, or running anyway", () => {
    expect(standsUpToRain(MEMORIAL_ARENA)).toBe(true);
    expect(standsUpToRain(COLDSTREAM_PARK)).toBe(true);
    expect(standsUpToRain(RUTLAND_LIONS_PARK)).toBe(true);
  });

  it("is never something Atlas has not placed", () => {
    expect(standsUpToRain(DEER_PARK)).toBe(false);
    expect(standsUpToRain(NO_CONTRACT)).toBe(false);
    expect(standsUpToRain(CONFLICTED)).toBe(false);
    expect(standsUpToRain(STUART_PARK_ICE_RINK)).toBe(false);
  });

  it("holds the picnic shelters the word list got backwards", () => {
    // Coldstream Park, Kin Beach, Polson Park, Paddlewheel Park. Each has a
    // picnic shelter; each used to be reported as ruled out by the rain.
    for (const park of ["Kin Beach", "Polson Park", "Paddlewheel Park"]) {
      expect(
        standsUpToRain(
          subject(park, {
            setting: "unknown",
            rain: { reading: "partly-sheltered", basis: "derived" },
            statements: [
              {
                says: "covered",
                scope: "part",
                text: "Picnic shelter",
                basis: "feature",
              },
            ],
          }),
        ),
      ).toBe(true);
    }
  });
});

describe("the four buckets", () => {
  const POOL = [
    MEMORIAL_ARENA,
    COLDSTREAM_PARK,
    RUTLAND_LIONS_PARK,
    STUART_PARK,
    STUART_PARK_ICE_RINK,
    DEER_PARK,
    NO_CONTRACT,
    CONFLICTED,
  ];

  it("sorts each subject into exactly one", () => {
    const { stands, against, uncertain, unknown } = splitByRain(POOL);
    expect(stands.map((e) => e.title)).toEqual([
      "Memorial Arena",
      "Coldstream Park",
      "Rutland Lions Park",
    ]);
    expect(against.map((e) => e.title)).toEqual(["Stuart Park"]);
    expect(uncertain.map((e) => e.title)).toEqual(["Stuart Park Ice Rink"]);
    expect(unknown.map((e) => e.title)).toEqual([
      "Deer Park",
      "Somewhere",
      "A disputed place",
    ]);
  });

  it("loses nobody", () => {
    const { stands, against, uncertain, unknown } = splitByRain(POOL);
    expect(
      stands.length + against.length + uncertain.length + unknown.length,
    ).toBe(POOL.length);
  });

  it("keeps a disagreement out of every answer rather than picking a side", () => {
    expect(placedByWeather(CONFLICTED)).toBe(false);
    expect(placedByWeather(COLDSTREAM_PARK)).toBe(true);
  });

  it("puts the same rink in two buckets, because Atlas holds two records", () => {
    // Not a bug here. Stuart Park is exposed and Stuart Park Ice Rink is
    // weather-dependent, and both are real. Surfaced, not smoothed over.
    const { against, uncertain } = splitByRain([
      STUART_PARK,
      STUART_PARK_ICE_RINK,
    ]);
    expect(against).toHaveLength(1);
    expect(uncertain).toHaveLength(1);
  });
});

describe("what a person is told", () => {
  it("says a derived reading is a reading", () => {
    // Atlas joined its own evidence rather than being told outright, and a
    // surface that printed it as a promise would be inventing certainty.
    expect(rainLine(COLDSTREAM_PARK)).toBe(
      "Has somewhere to shelter, going by what Atlas holds",
    );
  });

  it("says a stated one plainly", () => {
    expect(rainLine(STUART_PARK_ICE_RINK)).toBe("May not run in bad weather");
    expect(rainLine(RUTLAND_LIONS_PARK)).toBe("Runs in the rain");
  });

  it("says nothing at all where Atlas said nothing", () => {
    expect(rainLine(DEER_PARK)).toBeUndefined();
    expect(rainLine(NO_CONTRACT)).toBeUndefined();
    expect(rainLine(CONFLICTED)).toBeUndefined();
  });

  it("never promises anything Atlas did not state", () => {
    const said = [
      rainLine(MEMORIAL_ARENA),
      rainLine(COLDSTREAM_PARK),
      rainLine(STUART_PARK),
      rainLine(STUART_PARK_ICE_RINK),
    ].join(" | ");
    // Not "open" — "out in the open" is the exposed reading, and the thing
    // being guarded against is an opening time.
    for (const invented of [
      "opening",
      "hour",
      "warm",
      "kids",
      "safe",
      "free",
    ]) {
      expect(said.toLowerCase()).not.toContain(invented);
    }
  });

  it("quotes the source rather than paraphrasing it", () => {
    expect(rainBecause(STUART_PARK_ICE_RINK)).toContain("weather dependent");
  });
});
