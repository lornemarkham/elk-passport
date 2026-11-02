import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { readChristmas, evidenceLine } from "./themes";
import { readWhen, fitsDates, season } from "./when";
import { answer, findsIn, readAsk, writeAsk } from "./discover";
import { place, sayFor, shapeById, daysOf } from "./plans";
import { recapOf, recapLine, type Moment } from "./recap";
import { parseMoment, parseNotice } from "./together";
import { satisfies, challengeById } from "./challenges";

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
      km: "25",
      theme: "lights,nope",
      ages: "4,9,99",
      budget: "free",
    });
    expect(ask).toMatchObject({
      km: 25,
      themes: ["lights"],
      ages: [4, 9],
      budget: "free",
    });
    expect(readAsk({ at: "atlantis" }).at).toBeUndefined();
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

  it("a town measures what Atlas placed and keeps the unplaced, labelled", () => {
    const a = answer(finds, readAsk({ at: "north-vancouver", km: "10" }));
    const near = a.shelves.find((s) => s.id === "near");
    expect(near?.finds.map((f) => f.experience.id)).toEqual(["canyon"]);
    expect(
      a.shelves
        .find((s) => s.id === "unplaced")
        ?.finds.map((f) => f.experience.id),
    ).toEqual(["vcm"]);
  });

  it("dates rule out only what Atlas dates elsewhere; free keeps only stated free", () => {
    const early = answer(
      finds,
      readAsk({ from: "2026-11-17", to: "2026-11-18" }),
    );
    expect(early.removed.dates).toBe(1);
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
