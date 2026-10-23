import { describe, expect, it } from "vitest";
import { findGameId, readGame, suggestedCalls } from "./nhl";

const schedule = (games: unknown[]) => ({ gameWeek: [{ date: "x", games }] });
const game = (id: number, start: string, away: string, home = "VAN") => ({
  id,
  startTimeUTC: start,
  homeTeam: { abbrev: home },
  awayTeam: { abbrev: "XXX", commonName: { default: away } },
});

describe("findGameId", () => {
  const s = schedule([
    game(1, "2026-10-26T02:00:00Z", "Wild"),
    game(2, "2026-10-26T02:00:00Z", "Oilers", "EDM"),
    game(3, "2026-10-27T02:00:00Z", "Wild"),
  ]);
  it("matches a Canucks home game by time and opponent", () => {
    expect(findGameId(s, "2026-10-26T02:00:00Z", "Wild")).toBe(1);
    expect(findGameId(s, "2026-10-26T01:00:00.000Z", " wild ")).toBe(1);
  });
  it("finds nothing for the wrong opponent, time or venue", () => {
    expect(findGameId(s, "2026-10-26T02:00:00Z", "Oilers")).toBeNull();
    expect(findGameId(s, "2026-10-26T12:00:00Z", "Wild")).toBeNull();
    expect(findGameId({}, "2026-10-26T02:00:00Z", "Wild")).toBeNull();
  });
});

const landing = (over: Record<string, unknown>) => ({
  id: 9,
  gameState: "FUT",
  homeTeam: { abbrev: "VAN", score: 0 },
  awayTeam: { abbrev: "MIN", score: 0 },
  ...over,
});

describe("readGame", () => {
  it("is scheduled before puck drop, with no period", () => {
    const g = readGame(landing({}))!;
    expect(g.state).toBe("scheduled");
    expect(g.period).toBeUndefined();
  });
  it("is live with a period and clock", () => {
    const g = readGame(
      landing({
        gameState: "LIVE",
        periodDescriptor: { number: 2, periodType: "REG" },
        clock: { timeRemaining: "12:34", inIntermission: false },
        homeTeam: { abbrev: "VAN", score: 2 },
        awayTeam: { abbrev: "MIN", score: 1 },
      }),
    )!;
    expect(g).toMatchObject({ state: "live", period: "2nd", clock: "12:34" });
    expect(g.home.score).toBe(2);
  });
  it("is in intermission between periods, with no clock", () => {
    const g = readGame(
      landing({
        gameState: "LIVE",
        periodDescriptor: { number: 1, periodType: "REG" },
        clock: { timeRemaining: "00:00", inIntermission: true },
      }),
    )!;
    expect(g.state).toBe("intermission");
    expect(g.clock).toBeUndefined();
  });
  it("reads a shootout ending and goals in order", () => {
    const g = readGame(
      landing({
        gameState: "OFF",
        periodDescriptor: { number: 5, periodType: "SO" },
        homeTeam: { abbrev: "VAN", score: 4 },
        awayTeam: { abbrev: "MIN", score: 3 },
        summary: {
          scoring: [
            {
              periodDescriptor: { number: 1, periodType: "REG" },
              goals: [
                {
                  isHome: false,
                  name: { default: "K. Kaprizov" },
                  timeInPeriod: "02:13",
                },
              ],
            },
            {
              periodDescriptor: { number: 2, periodType: "REG" },
              goals: [
                {
                  isHome: true,
                  name: { default: "E. Pettersson" },
                  timeInPeriod: "05:00",
                },
              ],
            },
          ],
        },
      }),
    )!;
    expect(g).toMatchObject({ state: "final", ending: "SO" });
    expect(g.goals.map((x) => x.side)).toEqual(["away", "home"]);
    expect(readGame(null)).toBeNull();
    expect(readGame({ id: "x" })).toBeNull();
  });
});

describe("suggestedCalls", () => {
  it("suggests nothing until the game is final", () => {
    expect(suggestedCalls(readGame(landing({ gameState: "LIVE" })))).toEqual(
      {},
    );
    expect(suggestedCalls(null)).toEqual({});
  });
  it("fills in only what the record settles", () => {
    const g = readGame(
      landing({
        gameState: "FINAL",
        periodDescriptor: { number: 3, periodType: "REG" },
        homeTeam: { abbrev: "VAN", score: 1 },
        awayTeam: { abbrev: "MIN", score: 0 },
        summary: {
          scoring: [
            {
              periodDescriptor: { number: 3, periodType: "REG" },
              goals: [
                {
                  isHome: true,
                  name: { default: "B. Boeser" },
                  timeInPeriod: "10:00",
                },
              ],
            },
          ],
        },
      }),
    );
    const s = suggestedCalls(g);
    expect(s["final-score"].value).toEqual([1, 0]);
    expect(s.overtime.value).toBe(false);
    expect(s["first-team"].value).toBe("canucks");
    expect(s["total-goals"].value).toBe(1);
    expect(s.refs).toBeUndefined();
  });
});
