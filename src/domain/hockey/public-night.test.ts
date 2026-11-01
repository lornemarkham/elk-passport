import { describe, expect, it } from "vitest";
import { engravingOf } from "@/components/hockey/CupName";
import { cupNameOf, detailsOf, venuePoint, SYCLE_HOCKEY_NIGHT } from "./night";
import {
  findScheduled,
  nextWeekOf,
  readScheduled,
  readUpcoming,
  type ScheduledGame,
} from "./nhl";
import { chooseScheduledGame, wallClock, zoneOr } from "./schedule";

/**
 * **Any NHL game, any arena — without inventing a thing about the arena.**
 *
 * A night picked from the league's schedule carries the league's own id,
 * both sides by name and code, the arena by name and zone. What Passport has
 * not measured stays unmeasured: only Rogers Arena has coordinates, so a
 * night in Toronto has none and measures nothing from the wrong building.
 */

const NOW = new Date("2026-11-01T20:00:00Z");

const entry = (over: Record<string, unknown> = {}) => ({
  id: 2026020300,
  startTimeUTC: "2026-11-08T00:00:00Z",
  gameType: 2,
  gameState: "FUT",
  venue: { default: "Scotiabank Arena" },
  venueTimezone: "America/Toronto",
  homeTeam: {
    abbrev: "TOR",
    commonName: { default: "Maple Leafs" },
    placeName: { default: "Toronto" },
  },
  awayTeam: {
    abbrev: "BOS",
    commonName: { default: "Bruins" },
    placeName: { default: "Boston" },
  },
  ...over,
});

describe("the league's schedule", () => {
  it("reads an entry as a game a night can be built on", () => {
    const g = readScheduled(entry());
    expect(g).toEqual({
      id: 2026020300,
      startsAt: "2026-11-08T00:00:00.000Z",
      home: { abbr: "TOR", name: "Maple Leafs", place: "Toronto" },
      away: { abbr: "BOS", name: "Bruins", place: "Boston" },
      venue: "Scotiabank Arena",
      timeZone: "America/Toronto",
      state: "FUT",
      gameType: 2,
    });
    expect(readScheduled({})).toBeNull();
    expect(readScheduled(null)).toBeNull();
  });

  it("lists only what is ahead, in season, soonest first", () => {
    const week = {
      nextStartDate: "2026-11-08",
      gameWeek: [
        {
          games: [
            entry({ id: 1, startTimeUTC: "2026-11-03T00:00:00Z" }),
            entry({ id: 2, startTimeUTC: "2026-11-02T00:00:00Z" }),
            entry({
              id: 3,
              gameState: "OFF",
              startTimeUTC: "2026-11-01T00:00:00Z",
            }),
            entry({ id: 4, gameType: 1, startTimeUTC: "2026-11-04T00:00:00Z" }),
            entry({
              id: 5,
              gameState: "LIVE",
              startTimeUTC: "2026-11-01T19:00:00Z",
            }),
          ],
        },
      ],
    };
    expect(readUpcoming(week, NOW).map((g) => g.id)).toEqual([2, 1]);
    expect(nextWeekOf(week)).toBe("2026-11-08");
    expect(nextWeekOf({})).toBeNull();
  });

  it("finds a night's game by the league's id first, by name and time otherwise", () => {
    const week = {
      gameWeek: [
        {
          games: [
            entry({ id: 7 }),
            entry({
              id: 8,
              homeTeam: { abbrev: "VAN", commonName: { default: "Canucks" } },
              awayTeam: { abbrev: "MIN", commonName: { default: "Wild" } },
              startTimeUTC: "2026-11-08T03:00:00Z",
            }),
          ],
        },
      ],
    };
    expect(
      (
        findScheduled(week, "2026-11-08T00:00:00Z", "Bruins", 7) as {
          id: number;
        }
      ).id,
    ).toBe(7);
    expect(
      findScheduled(week, "2026-11-08T00:00:00Z", "Bruins", 99),
    ).toBeNull();
    // Without an id: a Canucks home game by opponent and time — never a Leafs game.
    expect(
      (findScheduled(week, "2026-11-08T03:00:00Z", "Wild") as { id: number })
        .id,
    ).toBe(8);
    expect(findScheduled(week, "2026-11-08T00:00:00Z", "Bruins")).toBeNull();
  });
});

describe("a night on one of the league's games", () => {
  const leafs = readScheduled(entry()) as ScheduledGame;

  it("names both sides, the arena and its zone, and the league's id", () => {
    const chosen = chooseScheduledGame(leafs, NOW);
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    expect(chosen.startsAt).toBe("2026-11-08T00:00:00.000Z");
    expect(chosen.details).toMatchObject({
      home: "Maple Leafs",
      opponent: "Bruins",
      venue: "Scotiabank Arena",
      city: "Toronto",
      homeAbbr: "TOR",
      awayAbbr: "BOS",
      nhlGameId: 2026020300,
      timeZone: "America/Toronto",
    });
    // Passport has not measured Scotiabank Arena: no coordinates, nothing measured.
    expect(chosen.details.venueAt).toBeUndefined();
    expect(venuePoint(chosen.details)).toBeUndefined();
    expect(venuePoint(detailsOf(chosen.details))).toBeUndefined();
    expect(detailsOf(chosen.details).venueAt).toBeUndefined();
  });

  it("gives a Canucks home game Rogers Arena's point, and nothing else's", () => {
    const home = readScheduled(
      entry({
        homeTeam: {
          abbrev: "VAN",
          commonName: { default: "Canucks" },
          placeName: { default: "Vancouver" },
        },
        venue: { default: "Rogers Arena" },
        venueTimezone: "America/Vancouver",
      }),
    ) as ScheduledGame;
    const chosen = chooseScheduledGame(home, NOW);
    expect(chosen.ok && chosen.details.venueAt).toEqual(
      SYCLE_HOCKEY_NIGHT.details.venueAt,
    );
    // A night set by hand before 2026-11-01 stored no venue: still Rogers.
    expect(venuePoint({ opponent: "Wild" })).toEqual(
      SYCLE_HOCKEY_NIGHT.details.venueAt,
    );
    expect(detailsOf({ opponent: "Wild" }).venueAt).toEqual(
      SYCLE_HOCKEY_NIGHT.details.venueAt,
    );
  });

  it("refuses what is over, preseason, or unnamed", () => {
    expect(
      chooseScheduledGame({ ...leafs, startsAt: "2026-10-01T00:00:00Z" }, NOW),
    ).toMatchObject({ ok: false });
    expect(chooseScheduledGame({ ...leafs, gameType: 1 }, NOW)).toMatchObject({
      ok: false,
      problem: /Preseason/,
    });
    expect(
      chooseScheduledGame(
        { ...leafs, away: { abbr: "", name: "", place: "" } },
        NOW,
      ),
    ).toMatchObject({ ok: false });
  });

  it("says the time in the arena's zone, and falls back to Vancouver for a zone it cannot read", () => {
    // Zones without a clock change, so this machine's tz data (which keeps
    // British Columbia on UTC−7 after November 2026) cannot move the answer.
    expect(wallClock("2026-11-08T00:00:00Z", "Asia/Tokyo")).toEqual({
      date: "2026-11-08",
      time: "09:00",
    });
    expect(wallClock("2026-11-08T03:30:00Z", "UTC")).toEqual({
      date: "2026-11-08",
      time: "03:30",
    });
    expect(zoneOr("Mars/Olympus")).toBe("America/Vancouver");
    expect(zoneOr(undefined)).toBe("America/Vancouver");
    expect(zoneOr("US/Eastern")).toBe("US/Eastern");
  });
});

describe("the trophy's name", () => {
  it("is the Sycle Cup unless the night named its own", () => {
    expect(cupNameOf(undefined)).toBe("Sycle Cup");
    expect(cupNameOf({ cup: "  " })).toBe("Sycle Cup");
    expect(cupNameOf({ cup: "The Office Cup" })).toBe("The Office Cup");
    expect(cupNameOf({ cup: "x".repeat(41) })).toBe("Sycle Cup");
  });

  it("engraves one word of it", () => {
    expect(engravingOf("Sycle Cup")).toBe("SYCLE");
    expect(engravingOf("The Office Cup")).toBe("OFFICE");
    expect(engravingOf("Cup")).toBe("CUP");
    expect(engravingOf("The Lannister Memorial Trophy")).toBe("TROPHY");
  });
});
