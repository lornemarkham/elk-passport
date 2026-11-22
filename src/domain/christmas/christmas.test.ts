import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { readChristmas, evidenceLine } from "./themes";
import { readWhen, fitsDates, season } from "./when";
import { answer, findsIn, readAsk, writeAsk } from "./discover";
import { place, sayFor, shapeById, daysOf } from "./plans";
import { recapOf, recapLine, type Moment } from "./recap";
import { parseMoment, parseNotice } from "./together";
import { satisfies, challengeById } from "./challenges";
import { christmasPictures } from "./pictures";

const TODAY = "2026-11-01";

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

const market = exp({
  id: "vcm",
  kind: "Event",
  title: "Vancouver Christmas Market 2026",
  subtype: "Christmas Market",
  startTime: "2026-11-16T00:00:00Z",
  endTime: "2026-12-24T00:00:00Z",
  timePrecision: "day",
  occurrence: { reading: "unexplained-span", actionable: false },
});
const lights = exp({
  id: "canyon",
  kind: "Event",
  title: "Canyon Lights",
  subtype: "holiday lights event",
  startTime: "2026-11-20T00:00:00Z",
  endTime: "2027-01-10T00:00:00Z",
  timePrecision: "day",
  occurrence: { reading: "run", actionable: true },
  geography: {
    state: "derived",
    coordinates: [-123.1149, 49.3429],
    area: { id: "metro-vancouver", name: "Metro Vancouver" },
  },
});
const oldMarket = exp({
  id: "old",
  kind: "Event",
  title: "Farmstrong Christmas Market",
  startTime: "2023-11-22T00:00:00Z",
  endTime: "2023-11-29T00:00:00Z",
  timePrecision: "day",
  occurrence: { reading: "occurrence", actionable: true },
});

describe("what counts as a Christmas find", () => {
  it("reads the subject's own words and says which", () => {
    const r = readChristmas(market)!;
    expect(r.themes).toContain("markets");
    expect(r.christmas).toBe(true);
    expect(evidenceLine(r.evidence[0]!)).toBe(
      "It's in the name: “Christmas Market”",
    );
  });

  it("does not count Christmas the date — holiday hours are not a thing to do", () => {
    const diner = exp({
      title: "Diner On Six",
      knowledge: {
        practical: [
          {
            label: "Holiday hours exception",
            value: "Closed on Christmas Day",
          },
          { label: "Opening hours", value: "7am-2pm" },
        ],
      },
    });
    expect(readChristmas(diner)).toBeNull();
    expect(readChristmas(exp({ title: "Holiday Inn Express" }))).toBeNull();
  });

  it("does not take a picture's caption as evidence", () => {
    const cafe = exp({
      title: "Corner Café",
      presentationImage: {
        url: "https://x/y.jpg",
        relationship: "category",
        depictsEntity: false,
        confidence: "low",
        attribution: "Illustrative photo of a Christmas market",
        caption: "Christmas market",
      },
    });
    expect(readChristmas(cafe)).toBeNull();
  });

  it("keeps a real Christmas Eve dinner the organiser describes", () => {
    const arc = exp({
      title: "Arc",
      // Atlas's own listing: Arc is a restaurant, and a menu is what one offers.
      subtype: "restaurant",
      knowledge: {
        practical: [
          {
            label: "Christmas Eve Dinner",
            value: "A four-course feast. DEC 24 | 5:30 PM. $169 PER ADULT",
          },
        ],
      },
    });
    expect(readChristmas(arc)?.themes).toEqual(["food"]);
  });

  it("calls a rink winter fun, not Christmas, and only from what it is", () => {
    const rink = exp({ title: "Robson Square Ice Rink" });
    expect(readChristmas(rink)).toMatchObject({
      themes: ["winter"],
      christmas: false,
    });
    const park = exp({
      title: "John Hendry Park",
      knowledge: {
        practical: [
          { label: "Note", value: "The ice rink cost $15.9 million." },
        ],
      },
    });
    expect(readChristmas(park)).toBeNull();
  });

  it("ignores an award, a camp and another season's menu", () => {
    expect(
      readChristmas(
        exp({
          title: "Station BBQ",
          knowledge: {
            practical: [
              { label: "Awards", value: "Won the Winter Carnival cookoff" },
            ],
          },
        }),
      ),
    ).toBeNull();
    expect(
      readChristmas(
        exp({
          title: "Halloweenie at Grizzli",
          kind: "Event",
          knowledge: {
            practical: [{ label: "Included", value: "a glass of mulled wine" }],
          },
        }),
      ),
    ).toBeNull();
  });
});

describe("when, and how sure", () => {
  it("dated, check, unconfirmed and past are four different answers", () => {
    expect(readWhen(lights, TODAY).confidence).toBe("dated");
    expect(readWhen(market, TODAY).confidence).toBe("check");
    expect(readWhen(oldMarket, TODAY)).toMatchObject({
      confidence: "past",
      because: expect.stringContaining("2023"),
    });
    expect(
      readWhen(exp({ title: "Shipyards Christmas Market" }), TODAY),
    ).toMatchObject({ confidence: "unconfirmed" });
  });

  it("keeps a stated day as that day — no timezone shift", () => {
    expect(readWhen(market, TODAY)).toMatchObject({
      from: "2026-11-16",
      to: "2026-12-24",
    });
  });

  it("quotes the organiser's season words rather than parsing them", () => {
    const rink = exp({
      title: "Centennial Outdoor Rink",
      knowledge: {
        practical: [
          { label: "Season", value: "Open during the winter months" },
        ],
      },
    });
    expect(readWhen(rink, TODAY)).toMatchObject({
      confidence: "check",
      line: "Season: Open during the winter months",
    });
  });

  it("only a stated range can rule a find out of somebody's dates", () => {
    const w = readWhen(lights, TODAY);
    expect(fitsDates(w, "2026-12-12", "2026-12-12")).toBe(true);
    expect(fitsDates(w, "2026-11-05", "2026-11-06")).toBe(false);
    expect(
      fitsDates(readWhen(exp({ title: "x" }), TODAY), "2026-11-05", undefined),
    ).toBe(true);
  });

  it("counts down to the right Christmas", () => {
    expect(season("2026-11-01")).toMatchObject({
      daysToGo: 54,
      stage: "coming",
    });
    expect(season("2026-12-20").stage).toBe("christmas-week");
    expect(season("2027-01-03")).toMatchObject({
      stage: "after",
      christmas: "2026-12-25",
    });
  });
});

describe("Christmas Discovery", () => {
  const finds = findsIn(
    [market, lights, oldMarket, exp({ title: "Plain Park" })],
    TODAY,
  );

  it("keeps the URL as the state", () => {
    const ask = readAsk({
      at: "vancouver",
      km: "50",
      theme: "lights,nope",
      ages: "4,9,99",
      budget: "free",
    });
    expect(ask).toMatchObject({
      km: 50,
      themes: ["lights"],
      ages: [4, 9],
      budget: "free",
    });
    expect(readAsk({ at: "atlantis" }).at).toBeUndefined();
    // The radius is one of six, and thirty when nothing is said; an old
    // link's distance opens on the nearest choice.
    expect(readAsk({}).km).toBe(30);
    expect(readAsk({ km: "250" }).km).toBe(50);
    expect(readAsk({ km: "15" }).km).toBe(20);
    expect(readAsk({ km: "100" }).km).toBe(50);
    expect(writeAsk(ask)).toContain("theme=lights");
  });

  it("finds only Christmas things, and shelves last year's apart", () => {
    expect(finds.map((f) => f.experience.id).sort()).toEqual([
      "canyon",
      "old",
      "vcm",
    ]);
    const a = answer(finds, readAsk({}));
    expect(a.shelves.at(-1)).toMatchObject({ id: "past" });
    expect(a.total).toBe(2);
  });

  it("a town measures what Atlas placed and holds the unplaced apart", () => {
    const a = answer(finds, readAsk({ at: "north-vancouver", km: "10" }));
    const near = a.shelves.find((s) => s.id === "near");
    expect(near?.finds.map((f) => f.experience.id)).toEqual(["canyon"]);
    // Not on the page, but counted, and there when asked for.
    expect(a.shelves.map((s) => s.id)).not.toContain("unplaced");
    expect(a.unplaced).toBe(1);
    const all = answer(
      finds,
      readAsk({ at: "north-vancouver", km: "10", place: "all" }),
    );
    expect(
      all.shelves
        .find((s) => s.id === "unplaced")
        ?.finds.map((f) => f.experience.id),
    ).toEqual(["vcm"]);
  });

  it("dates rule out only what Atlas dates elsewhere; free keeps only stated free", () => {
    const early = answer(
      finds,
      readAsk({ from: "2026-11-17", to: "2026-11-18" }),
    );
    // Canyon Lights is dated in December and last year's market is over;
    // the market's window covers the days without confirming them, so it
    // is offered only as "might be on".
    expect(early.removed.dates).toBe(2);
    expect(early.shelves.map((s) => s.id)).toEqual(["maybe"]);
    expect(answer(finds, readAsk({ budget: "free" })).removed.budget).toBe(2);
  });
});

describe("Christmas plans", () => {
  it("says the sentence the Day Builder reads", () => {
    expect(sayFor({ shape: shapeById("family-day"), youngest: 4 })).toBe(
      "a Christmas day, take it easy, good food and drink, with the kids, youngest is 4",
    );
    expect(
      sayFor({
        shape: shapeById("evening"),
        party: "friends",
        extra: "home by 9",
      }),
    ).toBe("a Christmas evening, good food and drink, with friends, home by 9");
  });

  it("puts a dated find on its day and reports one dated outside the plan", () => {
    const days = daysOf("2026-12-12", 2);
    const twinkle = readWhen(
      exp({
        kind: "Event",
        title: "Twinkling Trail",
        startTime: "2026-12-13T01:00:00Z",
        endTime: "2026-12-13T02:45:00Z",
        timePrecision: "minute",
      }),
      TODAY,
    );
    const p = place(
      [
        { id: "trail", when: twinkle },
        { id: "canyon", when: readWhen(lights, TODAY) },
        {
          id: "workshop",
          when: readWhen(
            exp({
              kind: "Event",
              title: "Santa",
              startTime: "2026-12-18T19:00:00Z",
              endTime: "2026-12-24T21:00:00Z",
              timePrecision: "minute",
            }),
            TODAY,
          ),
        },
      ],
      days,
    );
    expect(p.pinned).toEqual({ trail: "2026-12-12" });
    expect(p.offDates).toEqual(["workshop"]);
  });
});

describe("challenges, moments and the recap", () => {
  it("a challenge is finished only with its proof", () => {
    const lightsDare = challengeById("best-lights")!;
    expect(
      satisfies(lightsDare, { text: "the one on 4th", hasPhoto: false }),
    ).toBe(false);
    expect(
      parseMoment({ kind: "challenge", challengeId: "best-lights", text: "x" }),
    ).toMatchObject({ ok: false });
    expect(
      parseMoment({
        kind: "challenge",
        challengeId: "carol",
        text: "Silent Night in the car",
      }),
    ).toMatchObject({ ok: true });
    expect(parseMoment({ kind: "moment", photo: "not base64!" })).toMatchObject(
      { ok: false },
    );
    expect(
      parseMoment({ kind: "moment", photo: "PGh0bWw+PHNjcmlwdD4=" }),
    ).toMatchObject({ ok: false, error: expect.stringContaining("photo") });
    expect(
      parseMoment({ kind: "moment", photo: "/9j/4AAQSkZJRg==" }),
    ).toMatchObject({ ok: true });
  });

  it("an announcement needs a headline and defaults to asking for Got it", () => {
    expect(parseNotice({ kind: "venue", headline: "  " })).toMatchObject({
      ok: false,
    });
    expect(
      parseNotice({
        kind: "venue",
        headline: "Shark Club is packed — Boston Pizza instead",
      }),
    ).toMatchObject({
      ok: true,
      value: { askAck: true, atlasRef: null },
    });
  });

  it("recaps only what people shared", () => {
    const m = (o: Partial<Moment>): Moment => ({
      id: Math.random().toString(),
      kind: "moment",
      text: null,
      hasPhoto: false,
      challengeId: null,
      atlasRef: null,
      by: "Sam",
      mine: false,
      createdAt: "2026-12-12T20:00:00Z",
      ...o,
    });
    expect(recapOf([]).empty).toBe(true);
    const r = recapOf([
      m({
        kind: "challenge",
        challengeId: "best-lights",
        hasPhoto: true,
        by: "Sam",
      }),
      m({
        kind: "challenge",
        challengeId: "best-lights",
        hasPhoto: true,
        by: "Alex",
        createdAt: "2026-12-12T21:00:00Z",
      }),
      m({
        kind: "challenge",
        challengeId: "carol",
        text: "Jingle Bells",
        by: "Alex",
        createdAt: "2026-12-12T22:00:00Z",
      }),
      m({ kind: "tradition", text: "Pyjamas on Christmas Eve", by: "Sam" }),
      m({ kind: "moment", text: "Gran on the ice", by: "Alex" }),
    ]);
    expect(r.challenges.map((c) => [c.id, c.by])).toEqual([
      ["best-lights", ["Sam", "Alex"]],
      ["carol", ["Alex"]],
    ]);
    expect(r.tally).toEqual([
      { name: "Alex", count: 2 },
      { name: "Sam", count: 1 },
    ]);
    expect(recapLine(r)).toBe(
      "2 photos · 2 challenges done · 1 tradition — shared by 2 of you.",
    );
  });
});

describe("free means free for everybody", () => {
  const priced = (value: string) =>
    findsIn(
      [
        exp({
          kind: "Event",
          title: "Christmas Market",
          knowledge: { practical: [{ label: "Admission", value }] },
        }),
      ],
      TODAY,
    )[0]!;

  it("counts a free or by-donation price, and not a discount", () => {
    expect(priced("FREE").free).toBe(true);
    expect(priced("by donation").free).toBe(true);
    expect(priced("$8 per person, ages 15 and under are free").free).toBe(
      false,
    );
    expect(priced("$37 Adult, Infant Free on Lap").free).toBe(false);
    expect(priced("$8 per person").price).toBe("Admission: $8 per person");
  });

  it("reads a complimentary event from what Atlas says about it", () => {
    const sledding = exp({
      kind: "Event",
      title: "Sledding with Santa",
      suitability: {
        stated: "stated",
        statements: [
          {
            about: "audience",
            says: "families",
            strength: "characterisation",
            text: "A complimentary, festive, family-friendly event.",
            basis: "description",
          },
        ],
      },
    });
    expect(findsIn([sledding], TODAY)[0]!.free).toBe(true);
  });
});

describe("a window of months is not a confirmed date", () => {
  const event = (startTime: string, endTime: string) =>
    exp({
      kind: "Event",
      title: "Xmas DJ Night",
      startTime,
      endTime,
      timePrecision: "day",
    });
  it("reads a year-long listing as 'check the days', never 'dated'", () => {
    const r = readWhen(
      event("2025-12-25T00:00:00Z", "2026-12-25T00:00:00Z"),
      "2026-11-19",
    );
    expect(r.confidence).toBe("check");
  });
  it("still trusts a market's six-week run", () => {
    const r = readWhen(
      event("2026-11-13T00:00:00Z", "2027-01-03T00:00:00Z"),
      "2026-11-19",
    );
    expect(r.confidence).toBe("dated");
  });
});

describe("QA repair 2026-11-21 — where, how far, and when", () => {
  const at = (id: string, lng: number, lat: number, area: string) =>
    exp({
      id,
      kind: "Event",
      title: `${id} Christmas Market`,
      startTime: "2026-12-05T00:00:00Z",
      endTime: "2026-12-06T00:00:00Z",
      timePrecision: "day",
      occurrence: { reading: "occurrence", actionable: true },
      geography: {
        state: "derived",
        coordinates: [lng, lat],
        area: { id: area, name: area },
      },
    });
  // Vancouver centre is roughly (-123.12, 49.28).
  const close = at("close", -123.1, 49.3, "Metro Vancouver");
  const middling = at("middling", -122.8, 49.25, "Metro Vancouver"); // ~23 km
  const faraway = at("faraway", -119.5, 50.7, "Thompson Okanagan");
  const finds = findsIn([close, middling, faraway], TODAY);

  it("offers 2, 5, 10, 20, 30 or 50 km — thirty by default, or the last chosen", () => {
    expect(readAsk({}).km).toBe(30);
    for (const km of [2, 5, 10, 20, 30, 50])
      expect(readAsk({ km: String(km) }).km).toBe(km);
    expect(readAsk({ km: "7" }).km).toBe(5);
    expect(readAsk({}, { km: 10 }).km).toBe(10);
    expect(readAsk({ km: "5" }, { km: 10 }).km).toBe(5);
    expect(readAsk({}, { km: 13 }).km).toBe(30);
  });

  it("keeps what is inside the radius and sets aside what is outside", () => {
    const near = (km: string) => {
      const a = answer(finds, readAsk({ at: "vancouver", km }));
      return (
        a.shelves
          .find((s) => s.id === "near")
          ?.finds.map((f) => f.experience.id) ?? []
      );
    };
    expect(near("20")).toEqual(["close"]);
    expect(near("30").sort()).toEqual(["close", "middling"]);
    // The far one is never offered, however far — and the page can say it
    // was set aside.
    const a = answer(finds, readAsk({ at: "vancouver", km: "50" }));
    expect(
      a.shelves.flatMap((s) => s.finds.map((f) => f.experience.id)),
    ).not.toContain("faraway");
    expect(a.removed.distance).toBe(1);
  });

  it("never calls a find with no place 'near' — it waits apart, labelled", () => {
    const nowhere = exp({
      id: "nowhere",
      kind: "Event",
      title: "Nowhere Christmas Market",
      startTime: "2026-12-05T00:00:00Z",
      endTime: "2026-12-06T00:00:00Z",
      timePrecision: "day",
      occurrence: { reading: "occurrence", actionable: true },
    });
    const shown = answer(
      findsIn([nowhere], TODAY),
      readAsk({ at: "vancouver" }),
    );
    expect(shown.shelves).toEqual([]);
    expect(shown.unplaced).toBe(1);
    const a = answer(
      findsIn([nowhere], TODAY),
      readAsk({ at: "vancouver", place: "all" }),
    );
    expect(a.shelves.map((s) => s.id)).toEqual(["unplaced"]);
    expect(a.shelves[0]!.title).toMatch(/not confirmed/i);
    expect(a.total).toBe(0);
  });

  it("says whether a confirmed date is on now, coming, or over", () => {
    const run = (start: string, end: string) =>
      readWhen(
        exp({
          kind: "Event",
          title: "X Christmas Market",
          startTime: `${start}T00:00:00Z`,
          endTime: `${end}T00:00:00Z`,
          timePrecision: "day",
          occurrence: { reading: "occurrence", actionable: true },
        }),
        "2026-11-21",
      );
    expect(run("2026-11-10", "2026-12-24")).toMatchObject({
      confidence: "dated",
      phase: "now",
    });
    expect(run("2026-12-05", "2026-12-06")).toMatchObject({
      confidence: "dated",
      phase: "upcoming",
    });
    expect(run("2026-11-01", "2026-11-05")).toMatchObject({
      confidence: "past",
      phase: "finished",
    });
  });

  it("does not present last year's published schedule as this year's", () => {
    const stale = exp({
      title: "Old Christmas Market",
      knowledge: {
        practical: [{ label: "Dates", value: "Nov 20 – Dec 24, 2024" }],
      },
    });
    expect(readWhen(stale, "2026-11-21").confidence).toBe("past");
    const fresh = exp({
      title: "New Christmas Market",
      knowledge: {
        practical: [{ label: "Dates", value: "Nov 20 – Dec 24, 2026" }],
      },
    });
    expect(readWhen(fresh, "2026-11-21").confidence).toBe("check");
  });
});

describe("pictures on Christmas cards", () => {
  it("shows a picture of the thing itself, never its venue's", () => {
    const own = exp({
      title: "Own",
      heroMedia: { type: "image", src: "https://x/own.jpg", alt: "the market" },
    });
    const venueOnly = exp({
      title: "Venue only",
      contextualMedia: {
        heroUrl: "https://x/ranch.jpg",
        via: { name: "O'Keefe Ranch" },
      },
    } as Partial<Experience>);
    expect(christmasPictures(own).map((p) => p.src)).toEqual([
      "https://x/own.jpg",
    ]);
    expect(christmasPictures(venueOnly)).toEqual([]);
  });
});
