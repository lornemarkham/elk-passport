import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import {
  comingUp,
  composeDiscovery,
  dayOf,
  isOver,
  onNow,
  onToday,
  pictureFirst,
} from "./compose";

/**
 * **The page has to decide what to show.**
 *
 * Measured on 2026-10-10, generic Discovery rendered 2,248 rows in one list,
 * 251,104 pixels tall — 615 screens — opening with ten parks in a row and no
 * sense of what day it was. These pin the decisions that replaced it: what is
 * on today leads, what is over is gone, nothing appears twice, and a section
 * that cannot be filled is not promised.
 */

const make = (over: Partial<Experience> = {}): Experience =>
  ({
    id: Math.random().toString(36).slice(2),
    kind: "Place",
    slug: "s",
    title: "A thing",
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
    ...over,
  }) as Experience;

const dated = (from: string, to?: string, over: Partial<Experience> = {}) =>
  make({
    kind: "Event",
    startTime: `${from}T00:00:00.000Z`,
    endTime: `${to ?? from}T00:00:00.000Z`,
    timePrecision: "day",
    ...over,
  });

const NOW = new Date("2026-10-10T18:00:00.000Z");
const TODAY = "2026-10-10";

describe("what day it is", () => {
  it("reads the local calendar day, not the UTC one", () => {
    // 2026-10-10 19:00 Pacific is already the 11th in UTC. A feed that called
    // that tomorrow would hide tonight's events from somebody at dinner.
    const evening = new Date("2026-10-11T02:00:00.000Z");
    const local = `${evening.getFullYear()}-${`${evening.getMonth() + 1}`.padStart(2, "0")}-${`${evening.getDate()}`.padStart(2, "0")}`;
    expect(dayOf(evening)).toBe(local);
  });
});

describe("what is on today", () => {
  it("includes something that starts and ends today", () => {
    expect(onToday([dated(TODAY)], TODAY)).toHaveLength(1);
  });

  it("includes a run that started earlier and has not finished", () => {
    expect(onToday([dated("2026-10-01", "2026-10-31")], TODAY)).toHaveLength(1);
  });

  it("refuses a run far too long to be today's news", () => {
    // From the live corpus: a Halloween trail stated as running from 2023 to
    // 2026, and a museum exhibition open for ten months. Both cover today.
    // Neither is a reason to look at the page today, and both were at the top
    // of it, above the three things that were.
    expect(onToday([dated("2023-10-31", "2026-10-31")], TODAY)).toHaveLength(0);
    expect(onToday([dated("2026-03-19", "2027-01-03")], TODAY)).toHaveLength(0);
  });

  it("excludes one that starts tomorrow", () => {
    expect(onToday([dated("2026-10-11")], TODAY)).toHaveLength(0);
  });

  it("excludes a timeless place, which is not 'happening'", () => {
    // The distinction the brief is explicit about: a Place is not an Event.
    expect(onToday([make({ kind: "Place" })], TODAY)).toHaveLength(0);
  });

  it("orders by when it starts", () => {
    const [a, b] = onToday(
      [dated("2026-10-05", "2026-10-20"), dated(TODAY)],
      TODAY,
    );
    expect(a!.startTime! < b!.startTime!).toBe(true);
  });
});

describe("what is on for a while", () => {
  it("takes the long runs today refused", () => {
    expect(onNow([dated("2026-03-19", "2027-01-03")], TODAY)).toHaveLength(1);
  });

  it("leaves a short run to today", () => {
    expect(onNow([dated("2026-10-09", "2026-10-12")], TODAY)).toHaveLength(0);
  });

  it("does not claim something that has not started", () => {
    expect(onNow([dated("2026-11-01", "2027-06-01")], TODAY)).toHaveLength(0);
  });

  it("orders by what finishes soonest, the only urgency a long run has", () => {
    const [first] = onNow(
      [dated("2026-01-01", "2027-06-01"), dated("2026-01-01", "2026-11-01")],
      TODAY,
    );
    expect(first!.endTime!.slice(0, 10)).toBe("2026-11-01");
  });
});

describe("what is coming up", () => {
  it("takes the next fortnight, soonest first", () => {
    const up = comingUp(
      [dated("2026-10-20"), dated("2026-10-12"), dated("2026-10-15")],
      TODAY,
    );
    expect(up.map((e) => e.startTime!.slice(0, 10))).toEqual([
      "2026-10-12",
      "2026-10-15",
      "2026-10-20",
    ]);
  });

  it("does not reach past the window", () => {
    expect(comingUp([dated("2026-12-01")], TODAY)).toHaveLength(0);
  });

  it("does not claim something already running — that is today's", () => {
    expect(comingUp([dated("2026-10-01", "2026-10-31")], TODAY)).toHaveLength(
      0,
    );
  });
});

describe("what is over", () => {
  it("knows a finished event is not a possibility", () => {
    expect(isOver(dated("2026-09-01", "2026-09-30"), TODAY)).toBe(true);
  });

  it("does not call a timeless place over", () => {
    expect(isOver(make({ kind: "Place" }), TODAY)).toBe(false);
  });

  it("keeps a run that ends today", () => {
    expect(isOver(dated("2026-10-01", TODAY), TODAY)).toBe(false);
  });

  it("never composes one into any section", () => {
    const sections = composeDiscovery(
      [dated("2026-09-01", "2026-09-02", { title: "Finished" })],
      { now: NOW },
    );
    expect(sections).toHaveLength(0);
  });
});

describe("a picture sells the possibility", () => {
  it("leads with the subjects that have one", () => {
    const withPicture = make({
      title: "Pictured",
      heroMedia: { type: "image", src: "x.jpg" },
    });
    const order = pictureFirst([make({ title: "Bare" }), withPicture]);
    expect(order[0]!.title).toBe("Pictured");
  });

  it("never drops the ones that do not", () => {
    // 81% of the corpus has no vouched-for lead image. Ordering is not
    // exclusion.
    expect(pictureFirst([make(), make(), make()])).toHaveLength(3);
  });

  it("is stable, so the same pool composes the same way twice", () => {
    const pool = [
      make({ title: "a" }),
      make({ title: "b" }),
      make({ title: "c" }),
    ];
    expect(pictureFirst(pool).map((e) => e.title)).toEqual(
      pictureFirst(pool).map((e) => e.title),
    );
  });
});

describe("composing the page", () => {
  const pool = [
    dated(TODAY, TODAY, { title: "Tonight's concert" }),
    dated("2026-10-14", "2026-10-14", { title: "Next week's talk" }),
    dated("2026-09-01", "2026-09-02", { title: "Finished in September" }),
    make({ title: "Kalamoir Park", subtype: "park" }),
    make({ title: "A winery", subtype: "winery", kind: "Organization" }),
    make({ title: "The museum", subtype: "museum" }),
    make({ title: "An orchard", subtype: "orchard" }),
    make({ title: "A hotel", subtype: "hotel" }),
    make({ title: "Something unclassified", subtype: "unknown" }),
  ];

  it("leads with what is on today", () => {
    const [first] = composeDiscovery(pool, { now: NOW });
    expect(first!.id).toBe("today");
    expect(first!.items[0]!.title).toBe("Tonight's concert");
  });

  it("orders the dated sections today, then long runs, then upcoming", () => {
    const withLongRun = [...pool, dated("2026-01-01", "2027-01-01")];
    expect(
      composeDiscovery(withLongRun, { now: NOW })
        .filter((s) => s.shape === "when")
        .map((s) => s.id),
    ).toEqual(["today", "on-now", "coming-up"]);
  });

  it("groups the timeless majority by what a person wants, not by kind", () => {
    const ids = composeDiscovery(pool, { now: NOW }).map((s) => s.id);
    expect(ids).toContain("outside");
    expect(ids).toContain("eat");
    expect(ids).toContain("culture");
    expect(ids).toContain("local");
    expect(ids).toContain("stay");
  });

  it("sweeps the unclaimed remainder up rather than hiding it", () => {
    const rest = composeDiscovery(pool, { now: NOW }).find(
      (s) => s.id === "rest",
    );
    expect(rest!.items.map((e) => e.title)).toEqual(["Something unclassified"]);
  });

  it("shows nothing twice", () => {
    const seen = composeDiscovery(pool, { now: NOW }).flatMap((s) =>
      s.items.map((e) => e.id),
    );
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("promises no section it cannot fill", () => {
    const sections = composeDiscovery([make({ subtype: "park" })], {
      now: NOW,
    });
    expect(sections.map((s) => s.id)).toEqual(["outside"]);
  });

  it("carries a few pages, shows one, and says how many it really holds", () => {
    const many = Array.from({ length: 300 }, () => make({ subtype: "park" }));
    const [outside] = composeDiscovery(many, { now: NOW, size: 8 });
    // One page on screen, three carried so "show more" is instant — and not
    // 300, which is how the page came to serialise 2,248 rows into its HTML.
    expect(outside!.size).toBe(8);
    expect(outside!.items).toHaveLength(24);
    expect(outside!.total).toBe(300);
  });

  it("carries only what it has, when it has little", () => {
    const [outside] = composeDiscovery(
      [make({ subtype: "park" }), make({ subtype: "trail" })],
      { now: NOW, size: 8 },
    );
    expect(outside!.items).toHaveLength(2);
    expect(outside!.total).toBe(2);
  });

  it("names the remainder after where Passport is looking, when it knows", () => {
    const sections = composeDiscovery([make({ subtype: "unknown" })], {
      now: NOW,
      where: "the Okanagan",
    });
    expect(sections[0]!.title).toBe("More in the Okanagan");
  });

  it("keeps dated and timeless sections distinguishable", () => {
    const sections = composeDiscovery(pool, { now: NOW });
    expect(sections.find((s) => s.id === "today")!.shape).toBe("when");
    expect(sections.find((s) => s.id === "eat")!.shape).toBe("intent");
  });
});
