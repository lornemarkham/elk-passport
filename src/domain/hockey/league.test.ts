import { describe, expect, it } from "vitest";
import { NHL_TEAMS } from "./fans";
import {
  featuredGame,
  groupStandings,
  nightable,
  pickHero,
  stillOn,
  readClubSeason,
  readClubStats,
  readLeaders,
  readLeagueGame,
  readScoreboard,
  readStandings,
  recordOf,
  resultFor,
  scoreboardOrder,
  splitSeason,
  teamBySlug,
  teamSlug,
} from "./league";
import scoreNow from "./fixtures/league-2026-11-01/score-now.json";
import scoreTomorrow from "./fixtures/league-2026-11-01/score-2026-11-02.json";
import standingsNow from "./fixtures/league-2026-11-01/standings-now.json";
import flamesSeason from "./fixtures/league-2026-11-01/club-schedule-season-CGY.json";
import flamesStats from "./fixtures/league-2026-11-01/club-stats-CGY.json";
import leaders from "./fixtures/league-2026-11-01/skater-leaders.json";

/*
 * Every body here is the league's own, read from api-web.nhle.com on
 * 1–2 November 2026 and trimmed of logo and headshot URLs. The numbers in
 * these expectations are the league's numbers, not ours.
 */

describe("the scoreboard", () => {
  const board = readScoreboard(scoreNow)!;

  it("reads the league's day and its neighbours", () => {
    expect(board.date).toBe("2026-11-01");
    expect(board.prevDate).toBe("2026-10-31");
    expect(board.nextDate).toBe("2026-11-02");
    expect(board.week.length).toBeGreaterThan(0);
  });

  it("reads 1 November's five finals, home and away the right way round", () => {
    expect(board.games).toHaveLength(5);
    const car = board.games.find((g) => g.home.abbr === "CAR")!;
    expect(car.state).toBe("final");
    expect(car.ending).toBe("REG");
    expect(car.home).toMatchObject({
      name: "Hurricanes",
      place: "Carolina",
      score: 7,
      sog: 32,
    });
    expect(car.away).toMatchObject({ abbr: "WPG", name: "Jets", score: 0 });
    expect(car.venue).toBe("Lenovo Center");
    // The first goal was Carolina's: S. Walker, 5:16 of the 1st.
    expect(car.goals[0]).toEqual({
      side: "home",
      scorer: "S. Walker",
      period: "1st",
      time: "05:16",
    });
    expect(car.goals.filter((g) => g.side === "home")).toHaveLength(7);
  });

  it("gives a game that hasn't started no score at all", () => {
    const next = readScoreboard(scoreTomorrow)!;
    const flames = next.games.find((g) => g.away.abbr === "CGY")!;
    expect(flames.state).toBe("scheduled");
    expect(flames.home.abbr).toBe("SJS");
    expect(flames.home.score).toBeUndefined();
    expect(flames.away.score).toBeUndefined();
    expect(flames.period).toBeUndefined();
    expect(flames.startsAt).toBe("2026-11-03T02:00:00.000Z");
  });

  it("reads a live game's period and clock, and an intermission as one", () => {
    // The real record of WPG @ CAR, with the state a live one would have.
    const real = (scoreNow as { games: Record<string, unknown>[] }).games[0];
    const live = readLeagueGame({
      ...real,
      gameState: "LIVE",
      periodDescriptor: { number: 2, periodType: "REG" },
      clock: { timeRemaining: "12:34", inIntermission: false },
    })!;
    expect(live).toMatchObject({
      state: "live",
      period: "2nd",
      clock: "12:34",
    });
    expect(live.ending).toBeUndefined();
    const break2 = readLeagueGame({
      ...real,
      gameState: "LIVE",
      clock: { timeRemaining: "00:00", inIntermission: true },
    })!;
    expect(break2.state).toBe("intermission");
    expect(break2.clock).toBeUndefined();
    expect(readLeagueGame({ ...real, gameScheduleState: "PPD" })!.state).toBe(
      "postponed",
    );
  });

  it("reads nothing from something that isn't a scoreboard", () => {
    expect(readScoreboard(null)).toBeNull();
    expect(readScoreboard({ games: [] })).toBeNull();
    expect(readScoreboard("<html>")).toBeNull();
    expect(readLeagueGame({ id: 1 })).toBeNull();
  });

  it("orders live, then upcoming, then final", () => {
    const real = (scoreNow as { games: Record<string, unknown>[] }).games;
    const games = [
      readLeagueGame(real[0])!,
      readLeagueGame({ ...real[1], gameState: "FUT" })!,
      readLeagueGame({ ...real[2], gameState: "LIVE" })!,
    ];
    expect(scoreboardOrder(games).map((g) => g.state)).toEqual([
      "live",
      "scheduled",
      "final",
    ]);
  });
});

describe("the featured matchup", () => {
  it("is the Flames' game when they play that day", () => {
    const games = readScoreboard(scoreTomorrow)!.games;
    expect(featuredGame(games, "CGY")).toMatchObject({
      away: { abbr: "CGY" },
      home: { abbr: "SJS" },
    });
  });

  it("is otherwise the day's lead game, not invented", () => {
    const games = readScoreboard(scoreNow)!.games;
    const g = featuredGame(games, "CGY")!;
    expect(games).toContain(g);
    expect(featuredGame([], "CGY")).toBeNull();
  });

  it("can be made a night of only before it starts", () => {
    const tomorrow = readScoreboard(scoreTomorrow)!.games[0];
    const today = readScoreboard(scoreNow)!.games[0];
    const at = new Date("2026-11-02T04:30:00Z");
    expect(nightable(tomorrow, at)).toBe(true);
    expect(nightable(today, at)).toBe(false);
    expect(nightable(tomorrow, new Date("2026-11-04T00:00:00Z"))).toBe(false);
  });
});

describe("the standings", () => {
  const table = readStandings(standingsNow)!;

  it("reads all 32 clubs in the league's order", () => {
    expect(table.rows).toHaveLength(32);
    expect(table.date).toBe("2026-11-01");
    expect(table.rows[0]).toMatchObject({
      abbr: "CAR",
      points: 26,
      wins: 12,
      losses: 2,
      otLosses: 2,
      lastTen: "8-1-1",
      streak: "W4",
      division: "Metropolitan",
    });
  });

  it("puts the Flames sixth in the Pacific at 6–8–0", () => {
    const cgy = table.rows.find((r) => r.abbr === "CGY")!;
    expect(cgy).toMatchObject({
      division: "Pacific",
      divisionRank: 6,
      points: 12,
    });
    expect(recordOf(cgy)).toBe("6–8–0");
  });

  it("groups four divisions of eight and two conferences of sixteen", () => {
    const divisions = groupStandings(table.rows, "division");
    expect(divisions.map((d) => d.rows.length)).toEqual([8, 8, 8, 8]);
    const pacific = divisions.find((d) => d.name === "Pacific")!;
    expect(pacific.rows[0].abbr).toBe("EDM");
    expect(pacific.rows.map((r) => r.divisionRank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(
      groupStandings(table.rows, "conference").map((c) => c.rows.length),
    ).toEqual([16, 16]);
  });

  it("reads nothing from something that isn't a table", () => {
    expect(readStandings({})).toBeNull();
    expect(readStandings({ standings: [] })).toBeNull();
  });
});

describe("a club's season", () => {
  const season = readClubSeason(flamesSeason);

  it("leaves preseason out", () => {
    expect(season.every((g) => g.gameType === 2 || g.gameType === 3)).toBe(
      true,
    );
    expect(season).toHaveLength(26);
  });

  it("splits played from ahead, and the results agree with the table", () => {
    const { played, ahead, now } = splitSeason(season);
    expect(now).toBeNull();
    expect(played).toHaveLength(14);
    // Latest first: 31 October, 5–2 at Colorado.
    expect(played[0]).toMatchObject({
      away: { abbr: "CGY", score: 2 },
      home: { abbr: "COL", score: 5 },
    });
    expect(resultFor(played[0], "CGY")).toBe("L");
    expect(resultFor(played[1], "CGY")).toBe("W"); // SEA 2 @ CGY 6
    const results = played.map((g) => resultFor(g, "CGY"));
    expect(results.filter((r) => r === "W")).toHaveLength(6);
    expect(results.filter((r) => r === "L")).toHaveLength(8);
    // Soonest first: 2 November at San Jose.
    expect(ahead[0]).toMatchObject({
      home: { abbr: "SJS" },
      away: { abbr: "CGY" },
    });
  });

  it("calls an overtime loss an OTL, not an L", () => {
    const real = (flamesSeason as { games: Record<string, unknown>[] }).games;
    const otl = readLeagueGame({
      ...real.find((g) => g.gameType === 2 && g.gameState === "OFF"),
      gameOutcome: { lastPeriodType: "OT" },
    })!;
    expect(resultFor(otl, "CGY")).toBe("OTL");
    expect(readClubSeason(null)).toEqual([]);
  });
});

describe("statistics", () => {
  it("reads the Flames' skaters by points and goalies by games", () => {
    const { skaters, goalies } = readClubStats(flamesStats);
    expect(skaters[0]).toMatchObject({
      name: "Joel Farabee",
      points: 15,
      goals: 5,
    });
    expect(skaters[1].points).toBe(14);
    expect(goalies.slice(0, 2).map((g) => g.name)).toEqual(
      expect.arrayContaining(["Dustin Wolf"]),
    );
    const wolf = goalies.find((g) => g.name === "Dustin Wolf")!;
    expect(wolf.savePct).toBeCloseTo(0.847, 3);
    expect(readClubStats(undefined)).toEqual({ skaters: [], goalies: [] });
  });

  it("reads the league's leaders by category", () => {
    const by = readLeaders(leaders);
    expect(by.points[0]).toEqual({
      name: "Connor McDavid",
      team: "EDM",
      value: 39,
    });
    expect(by.goals[0]).toMatchObject({ name: "Kirill Kaprizov", value: 15 });
    expect(readLeaders("nope")).toEqual({});
  });
});

describe("team slugs", () => {
  it("gives all 32 clubs a distinct, readable slug that reads back", () => {
    const slugs = NHL_TEAMS.map(teamSlug);
    expect(new Set(slugs).size).toBe(32);
    for (const s of slugs) expect(s).toMatch(/^[a-z]+(-[a-z]+)+$/);
    expect(teamSlug({ city: "Montréal", name: "Canadiens" })).toBe(
      "montreal-canadiens",
    );
    expect(teamSlug({ city: "St. Louis", name: "Blues" })).toBe(
      "st-louis-blues",
    );
    expect(teamBySlug("calgary-flames")?.abbr).toBe("CGY");
    expect(teamBySlug("calgary")).toBeNull();
  });
});

describe("the home page's big card", () => {
  const today = readScoreboard(scoreNow)!.games;
  const next = readScoreboard(scoreTomorrow)!.games;
  const real = (scoreNow as { games: Record<string, unknown>[] }).games;

  it("points at tomorrow's Flames game once today is all finals", () => {
    expect(stillOn(today)).toBe(false);
    expect(pickHero(today, next, "CGY")).toMatchObject({
      away: { abbr: "CGY" },
      home: { abbr: "SJS" },
    });
  });

  it("stays on today while a game is live, even with the Flames on tomorrow", () => {
    const live = readLeagueGame({ ...real[3], gameState: "LIVE" })!;
    const board = [today[0], live];
    expect(stillOn(board)).toBe(true);
    expect(pickHero(board, next, "CGY")).toBe(live);
  });

  it("leads with the featured club's game today in any state", () => {
    expect(pickHero(today, next, "EDM")).toMatchObject({
      away: { abbr: "EDM" },
    });
  });

  it("falls back to today's last final, then to nothing", () => {
    expect(pickHero(today, [], "CGY")).toBe(today[today.length - 1]);
    expect(pickHero([], [], "CGY")).toBeNull();
  });
});
