import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import type { Environment, SkyCondition } from "@/domain/environment/types";
import { OCTOBER_PLACES } from "@/domain/environment/places";
import {
  hypeFor,
  savedContextFor,
  strongestHype,
  type HypeContext,
} from "./hype";

/**
 * **Hype speaks first, so it is the signal most able to become noise.**
 *
 * These are weighted toward refusal. The corpus fact that shaped the rule:
 * the most-photographed subject in it is a year-long 2027 tour of Japan with
 * 75 media, and the Draconids have seven. Nothing about popularity, media or
 * editorial enthusiasm may reach this function.
 */
const vernon = OCTOBER_PLACES.find((p) => p.id === "vernon")!;
const NOW = new Date("2026-10-07T20:00:00Z");
const TODAY = "2026-10-07";

const subject = (
  days: readonly string[],
  over: Partial<Experience> = {},
): Experience =>
  ({
    id: "e1",
    kind: "Event",
    slug: "s",
    title: "A thing",
    shortDescription: "",
    detailReady: true,
    energyLevel: 2,
    priceLevel: 1,
    duration: { minMinutes: 60, maxMinutes: 120 },
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    regionIds: [],
    familyFriendly: true,
    petFriendly: false,
    requiresReservation: false,
    isActive: true,
    availability: { basis: "stated", days: [...days] },
    ...over,
  }) as unknown as Experience;

function sky(condition: SkyCondition, pop = 0): Environment {
  const nights = [];
  for (let d = 5; d <= 12; d++) {
    nights.push({
      day: `2026-10-${String(d).padStart(2, "0")}`,
      sky: condition,
      lowC: 4,
      precipitationChance: pop,
    });
  }
  return {
    area: vernon,
    hourly: [],
    nights,
    provenance: {
      source: "Environment Canada",
      issuedAt: NOW.toISOString(),
      fetchedAt: NOW.toISOString(),
    },
  };
}

const ctx = (over: Partial<HypeContext> = {}): HypeContext => ({
  today: TODAY,
  now: NOW,
  kind: "astronomy",
  environment: sky("clear"),
  saved: new Set<string>(),
  ...over,
});

/** The Draconids' real window. */
const DRACONIDS = [
  "2026-10-06",
  "2026-10-07",
  "2026-10-08",
  "2026-10-09",
  "2026-10-10",
];

describe("what it refuses", () => {
  it("refuses anything the person already saved", () => {
    // That has stopped being a recommendation and become a plan.
    const got = hypeFor(subject(DRACONIDS), ctx({ saved: new Set(["e1"]) }));
    expect(got).toBeUndefined();
  });

  it("refuses a meteor shower nobody will be able to see", () => {
    // Same subject, same night, rained out. Not excitement — disappointment.
    expect(
      hypeFor(
        subject(DRACONIDS),
        ctx({ environment: sky("precipitating", 85) }),
      ),
    ).toBeUndefined();
  });

  it("refuses an indoor subject whatever else is true", () => {
    expect(
      hypeFor(subject(DRACONIDS), ctx({ kind: "indoor" })),
    ).toBeUndefined();
    expect(
      hypeFor(subject(DRACONIDS), ctx({ kind: "unknown" })),
    ).toBeUndefined();
  });

  it("refuses something that is not in October", () => {
    // Japan Tours 2027: 75 media, the most in the corpus, and irrelevant.
    const japan = subject(["2027-01-01", "2027-06-01", "2027-12-31"], {
      title: "Japan Tours 2027",
    } as Partial<Experience>);
    expect(hypeFor(japan, ctx({ kind: "outdoor-day" }))).toBeUndefined();
  });

  it("refuses something still days away", () => {
    const later = subject(["2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(hypeFor(later, ctx())).toBeUndefined();
  });

  it("hands a closing window to Don't Miss rather than hyping it", () => {
    // Two nights left of the Draconids: that is Don't Miss's job, and two
    // signals shouting about one subject is how a product stops being
    // believed.
    const got = hypeFor(
      subject(DRACONIDS),
      ctx({ today: "2026-10-09", now: new Date("2026-10-09T20:00:00Z") }),
    );
    expect(got).toBeUndefined();
  });

  it("refuses a long run that is simply underway", () => {
    // Field of Screams mid-season: not opening, not rare, not closing.
    const days = Array.from({ length: 38 }, (_, i) =>
      new Date(Date.UTC(2026, 8, 25 + i)).toISOString().slice(0, 10),
    );
    expect(
      hypeFor(subject(days), ctx({ kind: "outdoor-night" })),
    ).toBeUndefined();
  });

  it("refuses a subject with no stated days", () => {
    expect(hypeFor(subject([]), ctx())).toBeUndefined();
  });
});

describe("what it accepts, and how loudly", () => {
  it("lets the sky onto the page when everything lines up", () => {
    const got = hypeFor(subject(DRACONIDS), ctx())!;
    expect(got.level).toBe(4);
    expect(got.kind).toBe("astronomy");
    expect(got.because).toContain("Clear sky forecast");
    expect(got.because).toContain("almost no moon");
  });

  it("only mentions it when the moon will wash it out", () => {
    // Late October 2026 is near a full moon; the window is the same shape.
    const late = ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"];
    const got = hypeFor(
      subject(late),
      ctx({ today: "2026-10-24", now: new Date("2026-10-24T20:00:00Z") }),
    )!;
    expect(got.level).toBeLessThan(4);
  });

  it("still mentions a window the forecast cannot reach yet", () => {
    const got = hypeFor(subject(DRACONIDS), ctx({ environment: undefined }))!;
    expect(got.level).toBeLessThan(4);
    // And promises nothing about a sky it cannot see.
    expect(got.because).not.toContain("Clear");
  });

  it("recognises a season opening", () => {
    const season = Array.from({ length: 29 }, (_, i) =>
      new Date(Date.UTC(2026, 9, 8 + i)).toISOString().slice(0, 10),
    );
    const got = hypeFor(
      season.length ? subject(season) : subject([]),
      ctx({ kind: "outdoor-night" }),
    )!;
    expect(got.because).toBe("An October season opening.");
    // The expression for it is not built; one line is all it may have.
    expect(got.level).toBeLessThan(4);
  });

  it("says why now, in words a person can check", () => {
    const got = hypeFor(subject(DRACONIDS), ctx())!;
    expect(got.now).toBe("4 nights of it, starting tonight.");
  });
});

describe("one at a time", () => {
  it("prefers the one October may express itself about", () => {
    const quiet = hypeFor(subject(DRACONIDS), ctx({ environment: undefined }))!;
    const loud = hypeFor(subject(DRACONIDS), ctx())!;
    expect(strongestHype([quiet, loud])).toBe(loud);
  });

  it("returns nothing from nothing", () => {
    expect(strongestHype([])).toBeUndefined();
  });
});

describe("nothing resembling popularity is an input", () => {
  it("ignores media count entirely", () => {
    // Two identical windows; one is on a subject with a huge photo library.
    const plain = hypeFor(subject(DRACONIDS), ctx());
    const photographed = hypeFor(
      subject(DRACONIDS, {
        heroMedia: { type: "image", src: "x" },
      } as Partial<Experience>),
      ctx(),
    );
    expect(plain?.level).toBe(photographed?.level);
  });
});

describe("the saved row that made Hype look broken", () => {
  const DRACO = "ddf146c6-7117-4520-a9fe-8326209fd5db";
  const draconids = subject(DRACONIDS, { id: DRACO } as Partial<Experience>);

  it("reproduces the failure: a real saved row suppresses the takeover", () => {
    // This is exactly what happened. A row written on 2026-09-30 while
    // testing the quick experience meant the signed-in page refused — and a
    // correct refusal renders nothing, which looks identical to a bug.
    const kept = new Set([DRACO]);
    expect(hypeFor(draconids, ctx({ saved: kept }))).toBeUndefined();
  });

  it("a scenario simulates a first encounter, so the takeover returns", () => {
    const kept = new Set([DRACO]);
    const got = hypeFor(
      draconids,
      ctx({ saved: savedContextFor(true, kept) }),
    )!;
    expect(got.level).toBe(4);
  });

  it("outside a scenario the real saved set is used, untouched", () => {
    const kept = new Set([DRACO]);
    expect(savedContextFor(false, kept)).toBe(kept);
    expect(
      hypeFor(draconids, ctx({ saved: savedContextFor(false, kept) })),
    ).toBeUndefined();
  });

  it("the simulated context never mutates the real one", () => {
    const kept = new Set([DRACO]);
    savedContextFor(true, kept);
    expect(kept.has(DRACO)).toBe(true);
    expect(kept.size).toBe(1);
  });
});

describe("the Hypometer", () => {
  const FIELD = "exp-field-of-screams-okeefe-ranch";
  /** Field of Screams' real shape: 25 Sep to 1 Nov, neither end in October. */
  const fieldDays = Array.from({ length: 38 }, (_, i) =>
    new Date(Date.UTC(2026, 8, 25 + i)).toISOString().slice(0, 10),
  );

  it("lets an editor make something eligible that context never would", () => {
    // A 38-night run in the middle of its season: no opening, no rare window,
    // not closing. Context alone says nothing; the editor says otherwise.
    const got = hypeFor(
      subject(fieldDays, { id: FIELD } as Partial<Experience>),
      ctx({
        kind: "outdoor-night",
        today: "2026-10-20",
        now: new Date("2026-10-20T20:00:00Z"),
      }),
    )!;
    expect(got.level).toBe(2);
  });

  it("counts a subject that spans October rather than ending in it", () => {
    // Neither 2026-09-25 nor 2026-11-01 is an October date. Checking only the
    // endpoints excluded the valley's main haunt from the month it runs through.
    const got = hypeFor(
      subject(fieldDays, { id: FIELD } as Partial<Experience>),
      ctx({
        kind: "outdoor-night",
        today: "2026-10-20",
        now: new Date("2026-10-20T20:00:00Z"),
      }),
    );
    expect(got).toBeDefined();
  });

  it("keeps the world's veto over the editor's opinion", () => {
    // The Draconids are set to 4 by an editor and still drop to nothing when
    // the forecast says rain.
    const draconids = subject(DRACONIDS, {
      id: "ddf146c6-7117-4520-a9fe-8326209fd5db",
    } as Partial<Experience>);
    expect(
      hypeFor(draconids, ctx({ environment: sky("precipitating", 85) })),
    ).toBeUndefined();
  });

  it("never exceeds the ceiling an editor set", () => {
    const got = hypeFor(
      subject(fieldDays, { id: FIELD } as Partial<Experience>),
      ctx({
        kind: "outdoor-night",
        today: "2026-10-20",
        now: new Date("2026-10-20T20:00:00Z"),
      }),
    )!;
    expect(got.level).toBeLessThanOrEqual(2);
  });

  it("picks the loudest when several qualify", () => {
    const quiet = { level: 1 } as unknown as Parameters<
      typeof strongestHype
    >[0][number];
    const loud = { level: 4 } as unknown as typeof quiet;
    expect(strongestHype([quiet, loud])).toBe(loud);
  });

  it("is a level, never a label a user could read", () => {
    const got = hypeFor(subject(DRACONIDS), ctx())!;
    expect(typeof got.level).toBe("number");
    for (const said of [got.because, got.now]) {
      expect(said).not.toMatch(/hype|level|score|%/i);
    }
  });
});
