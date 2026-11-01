import { describe, expect, it } from "vitest";
import box from "./fixtures/nhl-boxscore-2026020184.json";
import { fantasyTable, readBoxscore, scoreRoster } from "./fantasy";

/**
 * The league's boxscore of the real night (Canucks 2, Wild 4, 25 October
 * 2026; `api-web.nhle.com/v1/gamecenter/2026020184/boxscore`, read
 * 2026-11-01, trimmed to the fields the reader uses). Every number below
 * is the league's, not ours.
 */
describe("mini fantasy, from the league's record", () => {
  const read = readBoxscore(box)!;

  it("reads every skater and goalie the league lists, and knows the game is over", () => {
    expect(read.gameId).toBe(2026020184);
    expect(read.final).toBe(true);
    expect(read.skaters.length + read.goalies.length).toBe(40);
    const boeser = read.skaters.find((s) => s.name === "B. Boeser")!;
    expect(boeser).toMatchObject({
      team: "VAN",
      goals: 1,
      assists: 0,
      shots: 1,
      hits: 3,
      blocks: 1,
    });
    const hughes = read.skaters.find((s) => s.name === "Q. Hughes")!;
    expect(hughes).toMatchObject({ team: "MIN", goals: 1, assists: 1 });
  });

  it("scores a roster by the published rule, to one decimal, and says who was not listed", () => {
    const boeser = read.skaters.find((s) => s.name === "B. Boeser")!;
    const score = scoreRoster([boeser.playerId, 1], read);
    // 1 goal (3) + 1 shot (0.5) + 3 hits (1.5) + 1 block (0.5) = 5.5
    expect(score.lines[0]).toMatchObject({
      name: "B. Boeser",
      points: 5.5,
      listed: true,
    });
    expect(score.lines[1]).toMatchObject({
      playerId: 1,
      points: 0,
      listed: false,
    });
    expect(score.total).toBe(5.5);
  });

  it("gives the winning goalie the win, and no shutout for a game with goals against", () => {
    const winner = read.goalies.find((g) => g.win)!;
    expect(winner.team).toBe("MIN");
    expect(winner.shutout).toBe(false);
    const score = scoreRoster([winner.playerId], read);
    expect(score.total).toBe(Math.round((winner.saves * 0.2 + 3) * 10) / 10);
  });

  it("ranks a table with shared ranks and a fixed order", () => {
    const table = fantasyTable([
      { who: { id: "b" }, score: { total: 4, lines: [] } },
      { who: { id: "a" }, score: { total: 4, lines: [] } },
      { who: { id: "c" }, score: { total: 9.5, lines: [] } },
    ]);
    expect(table.map((t) => [t.who.id, t.rank])).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 2],
    ]);
  });

  it("is null for anything that is not a boxscore", () => {
    expect(readBoxscore({})).toBeNull();
    expect(readBoxscore(null)).toBeNull();
  });
});
