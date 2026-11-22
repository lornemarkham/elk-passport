import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import { readChristmas } from "./themes";
import { presetDates, whenLabel } from "./when";
import { answer, findsIn, oneEach, readAsk, writeAsk } from "./discover";

/**
 * **Christmas discovery UX repair** (owner brief, 2026-11-22): WHERE, WHEN
 * and HOW FAR, one category at a time, "tonight" that means tonight, and
 * nothing called near that Atlas has not placed near. Each block is one of
 * the owner's observations from live testing.
 */

const TODAY = "2026-11-22"; // a Sunday
const NOON = new Date("2026-11-22T20:00:00Z"); // 12:00 in Vancouver

function exp(over: Partial<Experience>): Experience {
  return {
    id: over.id ?? over.title ?? "x",
    kind: "Place",
    slug: "x",
    title: "Somewhere",
    shortDescription: "",
    detailReady: false,
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
    isActive: true,
    ...over,
  };
}

/** Placed by Atlas at a point, `km` east of a town centre (roughly). */
function near(
  town: string,
  kmEast: number,
  over: Partial<Experience>,
): Experience {
  const t = townById(town)!;
  const dLng = kmEast / (111.32 * Math.cos((t.latitude * Math.PI) / 180));
  return exp({
    geography: {
      state: "observed",
      coordinates: [t.longitude + dLng, t.latitude],
      coordinatesBasis: "observed",
      area: { id: t.area.toLowerCase(), name: t.area },
    },
    ...over,
  });
}

const event = (
  start: string,
  end: string,
  precision: "day" | "minute" = "minute",
): Partial<Experience> => ({
  kind: "Event",
  startTime: start,
  endTime: end,
  timePrecision: precision,
  occurrence: { reading: "occurrence", actionable: true },
});

describe("categories: what a thing is, not what it mentions", () => {
  it("does not call a performing-arts academy holiday lights for a class named Twinkle Stars", () => {
    const academy = exp({
      title: "Center Stage Performing Arts Academy",
      subtype: "theaters_and_performance_venues",
      description:
        "An academy offering musical theatre, dance, voice, piano, and acting.",
      knowledge: {
        practical: [
          {
            label:
              "Costume fee for Mini Stars, Shining Stars, Teen Stars and Twinkle Stars",
            value: "$75 non-refundable",
          },
        ],
      },
    });
    expect(readChristmas(academy)).toBeNull();
  });

  it("keeps a garage sale that sells lights a Christmas find, but not a lights display", () => {
    const sale = exp({
      kind: "Event",
      title: "Christmas Garage Sale Fundraiser",
      description:
        "We have plenty of Christmas lights, Christmas decorations, extension cords and so much more to be sold!",
    });
    const r = readChristmas(sale)!;
    expect(r.christmas).toBe(true);
    expect(r.themes).not.toContain("lights");
  });

  it("does not file a hockey game or a ride under lights or markets for a word in its description", () => {
    const game = exp({
      kind: "Event",
      title: "Penticton Vees vs Victoria Royals",
      description: "Come light up the arena for the holiday game!",
    });
    expect(readChristmas(game)?.themes ?? []).not.toContain("lights");
    const sleigh = exp({
      kind: "Event",
      title: "Sleigh All Day",
      description: "A sleigh ride that ends at our holiday market.",
    });
    expect(readChristmas(sleigh)?.themes ?? []).not.toContain("markets");
  });

  it("still files what is called a market, or a lighting, from its own description", () => {
    expect(
      readChristmas(
        exp({
          title: "Holiday Magic Market at RCA 2026",
          description: "The holiday market returns.",
        }),
      )?.themes,
    ).toContain("markets");
    expect(
      readChristmas(
        exp({
          title: "2026 Christmas Lighting Ceremony",
          description: "Watch the Christmas light display switch on.",
        }),
      )?.themes,
    ).toContain("lights");
  });

  it("selecting one category shows that category only", () => {
    const finds = findsIn(
      [
        near("vernon", 2, { id: "m", title: "German Christmas Market" }),
        near("vernon", 3, { id: "l", title: "Polson Park Christmas Lights" }),
        near("vernon", 4, { id: "s", title: "Breakfast with Santa" }),
      ],
      TODAY,
    );
    const ids = (theme: string) =>
      answer(finds, readAsk({ at: "vernon", theme }))
        .shelves.flatMap((s) => s.finds)
        .map((f) => f.experience.id);
    expect(ids("markets")).toEqual(["m"]);
    expect(ids("lights")).toEqual(["l"]);
    expect(writeAsk(readAsk({ theme: "markets" }))).toBe("theme=markets");
  });
});

describe("WHEN: tonight means tonight", () => {
  const finds = findsIn(
    [
      near("vernon", 1, {
        id: "carols",
        title: "Christmas Carols in the Park",
        // 6–9 pm in Vancouver, today.
        ...event("2026-11-23T02:00:00Z", "2026-11-23T05:00:00Z"),
      }),
      near("vernon", 1, {
        id: "brunch",
        title: "Santa Pancake Brunch",
        // 9–10 am today: over by noon.
        ...event("2026-11-22T17:00:00Z", "2026-11-22T18:00:00Z"),
      }),
      near("vernon", 2, { id: "rink", title: "Outdoor skating rink" }),
      near("vernon", 2, {
        id: "window",
        title: "Winter Christmas Market",
        ...event("2026-11-16T00:00:00Z", "2026-12-24T00:00:00Z", "day"),
        occurrence: { reading: "unexplained-span", actionable: false },
      }),
      near("vernon", 3, {
        id: "open",
        title: "Christmas lights at the Gardens",
        schedule: {
          stated: "stated",
          onDate: { date: TODAY, reading: "on", basis: "hours" },
        },
      }),
      near("vernon", 3, {
        id: "shut",
        title: "Santa's Workshop",
        schedule: {
          stated: "stated",
          onDate: { date: TODAY, reading: "not-on", basis: "hours" },
        },
      }),
      near("vernon", 3, {
        id: "later",
        title: "Christmas Craft Fair",
        ...event("2026-12-05T18:00:00Z", "2026-12-06T01:00:00Z"),
      }),
    ],
    TODAY,
  );

  it("offers only what is confirmed for tonight and not yet over", () => {
    const ask = readAsk({ at: "vernon", when: "tonight" }, { today: TODAY });
    expect(ask).toMatchObject({ when: "tonight", from: TODAY, to: TODAY });
    const a = answer(finds, ask, { today: TODAY, now: NOON });
    expect(a.shelves.map((s) => s.id)).toEqual(["near"]);
    expect(a.shelves[0]!.finds.map((f) => f.experience.id).sort()).toEqual([
      "carols",
      "open",
    ]);
    expect(a.removed).toMatchObject({ finished: 1, unconfirmed: 2, dates: 2 });
  });

  it("widens again on Any date", () => {
    const a = answer(finds, readAsk({ at: "vernon" }), {
      today: TODAY,
      now: NOON,
    });
    expect(a.total).toBe(7);
  });

  it("keeps a preset as the word, so the link means tonight on any night", () => {
    expect(
      writeAsk({ at: "vernon", when: "tonight", from: TODAY, to: TODAY }),
    ).toBe("at=vernon&when=tonight");
    expect(readAsk({ when: "tonight" }, { today: "2026-12-01" })).toMatchObject(
      { from: "2026-12-01", to: "2026-12-01" },
    );
  });

  it("names the days it is using", () => {
    expect(whenLabel({ when: "tonight" }, TODAY)).toBe("Tonight");
    expect(whenLabel({ from: TODAY, to: TODAY }, TODAY)).toBe("Tonight");
    expect(whenLabel({}, TODAY)).toBe("Any date");
    expect(whenLabel({ from: "2026-12-05", to: "2026-12-06" }, TODAY)).toBe(
      "Sat, Dec 5 – Sun, Dec 6",
    );
    // This weekend, from a Sunday, is the rest of Sunday; from a Wednesday,
    // Saturday and Sunday.
    expect(presetDates("weekend", TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(presetDates("weekend", "2026-11-25")).toEqual({
      from: "2026-11-28",
      to: "2026-11-29",
    });
    expect(presetDates("tomorrow", TODAY)).toEqual({
      from: "2026-11-23",
      to: "2026-11-23",
    });
  });

  it("offers a window that only might be on, apart, for days that aren't tonight", () => {
    const a = answer(
      finds,
      readAsk({ at: "vernon", when: "tomorrow" }, { today: TODAY }),
      { today: TODAY, now: NOON },
    );
    expect(
      a.shelves
        .find((s) => s.id === "maybe")
        ?.finds.map((f) => f.experience.id)
        .sort(),
      // "shut" is closed today by Atlas's reading; tomorrow it says nothing.
    ).toEqual(["open", "rink", "shut", "window"]);
  });
});

describe("WHERE and HOW FAR", () => {
  it("measures from a destination, not from home: Downtown Vancouver within 5 km", () => {
    expect(townById("port-moody")).toMatchObject({ area: "Metro Vancouver" });
    const finds = findsIn(
      [
        near("downtown-vancouver", 1, {
          id: "dt",
          title: "Christmas Market at Jack Poole Plaza",
        }),
        near("downtown-vancouver", 4, {
          id: "east",
          title: "Christmas Lights on Commercial Drive",
        }),
        near("port-moody", 0, {
          id: "pm",
          title: "Port Moody Christmas Market",
        }),
      ],
      TODAY,
    );
    const a = answer(finds, readAsk({ at: "downtown-vancouver", km: "5" }));
    expect(a.town?.id).toBe("downtown-vancouver");
    expect(a.shelves[0]!.finds.map((f) => f.experience.id)).toEqual([
      "dt",
      "east",
    ]);
    expect(a.removed.distance).toBe(1);
  });

  it("changes the count with the radius, nearest first among equals", () => {
    const finds = findsIn(
      [3, 8, 18, 28].map((k) =>
        near("vernon", k, { id: `k${k}`, title: `Christmas Market ${k}` }),
      ),
      TODAY,
    );
    const count = (km: string) =>
      answer(finds, readAsk({ at: "vernon", km })).total;
    expect([2, 5, 10, 20, 30].map((k) => count(String(k)))).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(
      answer(finds, readAsk({ at: "vernon", km: "30" })).shelves[0]!.finds.map(
        (f) => f.experience.id,
      ),
    ).toEqual(["k3", "k8", "k18", "k28"]);
  });

  it("offers a big dated Christmas event further out as worth the drive, apart and labelled", () => {
    const finds = findsIn(
      [
        near("vernon", 45, {
          id: "canyon",
          title: "Canyon Lights",
          ...event("2026-11-28T01:00:00Z", "2026-12-31T06:00:00Z"),
        }),
        near("vernon", 45, { id: "rink", title: "Skating rink" }),
      ],
      TODAY,
    );
    const a = answer(finds, readAsk({ at: "vernon", km: "30" }));
    expect(a.total).toBe(0);
    const drive = a.shelves.find((s) => s.id === "drive");
    expect(drive?.finds.map((f) => f.experience.id)).toEqual(["canyon"]);
    expect(drive?.line).toMatch(/further than 30 km/i);
    expect(a.removed.distance).toBe(1);
    // Inside a 50 km radius it is simply near.
    const wide = answer(finds, readAsk({ at: "vernon", km: "50" }));
    expect(wide.shelves.map((s) => s.id)).toEqual(["near"]);
  });
});

describe("one card for one thing", () => {
  it("folds a venue's records and an event's nights into one card, keeping distant namesakes apart", () => {
    const finds = findsIn(
      [
        near("armstrong", 0, {
          id: "a",
          title: "Caravan Farm Theatre Christmas Show",
        }),
        near("armstrong", 4, {
          id: "b",
          title: "Caravan Farm Theatre Christmas Show",
        }),
        near("vancouver", 0, {
          id: "c",
          title: "Caravan Farm Theatre Christmas Show",
        }),
      ],
      TODAY,
    );
    const one = oneEach(finds);
    expect(one.map((f) => [f.experience.id, f.others ?? 0])).toEqual([
      ["a", 1],
      ["c", 0],
    ]);
  });
});

describe("no nearer than the evidence", () => {
  it("does not count a listing Atlas knows only as 'in Vancouver' as within 5 km of Downtown", () => {
    const ubc = exp({
      id: "ubc",
      kind: "Event",
      title: "Wesbrook Village Holiday Market",
      ...event("2026-12-05T18:00:00Z", "2026-12-06T01:00:00Z"),
      geography: {
        state: "observed",
        locality: "Vancouver",
        area: { id: "metro-vancouver", name: "Metro Vancouver" },
      },
      distance: {
        state: "measured",
        km: 0.2,
        basis: "town",
        town: "Vancouver",
      },
    });
    const finds = findsIn([ubc], TODAY);
    const five = answer(finds, readAsk({ at: "downtown-vancouver", km: "5" }));
    expect(five.total).toBe(0);
    expect(five.shelves.map((s) => s.id)).toEqual(["town"]);
    // At 10 km and beyond, the town is a fair answer to "how far".
    const ten = answer(finds, readAsk({ at: "downtown-vancouver", km: "10" }));
    expect(ten.total).toBe(1);
  });

  it("keeps a party, a story time or a fundraiser off 'worth the drive'", () => {
    const dated = event("2026-12-05T18:00:00Z", "2026-12-06T01:00:00Z");
    const finds = findsIn(
      [
        near("vernon", 45, {
          id: "bws",
          title: "Breakfast with Santa",
          ...dated,
        }),
        near("vernon", 45, {
          id: "party",
          title: "Fundraiser Christmas Party",
          ...dated,
        }),
        near("vernon", 45, {
          id: "market",
          title: "OGC Holiday Market",
          ...dated,
        }),
      ],
      TODAY,
    );
    const a = answer(finds, readAsk({ at: "vernon", km: "30" }));
    expect(
      a.shelves
        .find((s) => s.id === "drive")
        ?.finds.map((f) => f.experience.id),
    ).toEqual(["market"]);
  });
});
