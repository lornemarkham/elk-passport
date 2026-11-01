/**
 * **Mini fantasy: a small roster, real events, one leaderboard — read, never
 * guessed.** (Assessment and reader only, 2026-11-01; no roster is stored
 * and no screen uses this yet — see `docs/product/hockey/FINISH-THE-EXPERIENCE.md`.)
 *
 * The league's boxscore (`/v1/gamecenter/{id}/boxscore`, the same public,
 * key-less feed the live score already comes from) lists every skater's
 * goals, assists, shots and hits and every goalie's saves and decision. This
 * file turns that record into points by one fixed, published rule, so two
 * phones always agree and nothing is ever invented: a player the record
 * does not list scores nothing, and a game the league has not finished
 * scores nothing final.
 *
 * Points are bragging rights. Nothing here involves money.
 */

export interface SkaterLine {
  readonly playerId: number;
  readonly name: string;
  readonly team: string;
  readonly position: string;
  readonly goals: number;
  readonly assists: number;
  readonly shots: number;
  readonly hits: number;
  readonly blocks: number;
}

export interface GoalieLine {
  readonly playerId: number;
  readonly name: string;
  readonly team: string;
  readonly saves: number;
  readonly goalsAgainst: number;
  readonly win: boolean;
  readonly shutout: boolean;
}

export interface BoxscoreRead {
  readonly gameId: number;
  readonly final: boolean;
  readonly skaters: readonly SkaterLine[];
  readonly goalies: readonly GoalieLine[];
}

/** The rule, published on the page. Whole and half points only. */
export const FANTASY_POINTS = {
  goal: 3,
  assist: 2,
  shot: 0.5,
  hit: 0.5,
  block: 0.5,
  save: 0.2,
  goalieWin: 3,
  shutout: 4,
} as const;

/** How many a roster holds: two skaters and one goalie keeps it a minute's work. */
export const ROSTER = { skaters: 2, goalies: 1 } as const;

interface Name {
  readonly default?: string;
}
interface Skater {
  readonly playerId?: number;
  readonly name?: Name;
  readonly position?: string;
  readonly goals?: number;
  readonly assists?: number;
  readonly sog?: number;
  readonly hits?: number;
  readonly blockedShots?: number;
}
interface Goalie {
  readonly playerId?: number;
  readonly name?: Name;
  readonly saves?: number;
  readonly goalsAgainst?: number;
  readonly decision?: string;
  readonly toi?: string;
}
interface Side {
  readonly forwards?: Skater[];
  readonly defense?: Skater[];
  readonly goalies?: Goalie[];
}
interface Boxscore {
  readonly id?: number;
  readonly gameState?: string;
  readonly homeTeam?: { abbrev?: string };
  readonly awayTeam?: { abbrev?: string };
  readonly playerByGameStats?: { homeTeam?: Side; awayTeam?: Side };
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** The league's boxscore as lines; null when it is not a boxscore. */
export function readBoxscore(body: unknown): BoxscoreRead | null {
  const b = body as Boxscore | null;
  if (!b || typeof b.id !== "number" || !b.playerByGameStats) return null;
  const final = b.gameState === "OFF" || b.gameState === "FINAL";
  const skaters: SkaterLine[] = [];
  const goalies: GoalieLine[] = [];
  for (const [key, team] of [
    ["homeTeam", b.homeTeam?.abbrev ?? ""],
    ["awayTeam", b.awayTeam?.abbrev ?? ""],
  ] as const) {
    const side = b.playerByGameStats[key];
    for (const p of [...(side?.forwards ?? []), ...(side?.defense ?? [])]) {
      if (typeof p.playerId !== "number") continue;
      skaters.push({
        playerId: p.playerId,
        name: p.name?.default ?? String(p.playerId),
        team,
        position: p.position ?? "",
        goals: n(p.goals),
        assists: n(p.assists),
        shots: n(p.sog),
        hits: n(p.hits),
        blocks: n(p.blockedShots),
      });
    }
    for (const g of side?.goalies ?? []) {
      if (typeof g.playerId !== "number") continue;
      // A goalie who never played has no decision and no time; the record
      // lists them anyway. They score nothing, and a shutout needs a game.
      const played = Boolean(g.toi && g.toi !== "00:00");
      goalies.push({
        playerId: g.playerId,
        name: g.name?.default ?? String(g.playerId),
        team,
        saves: n(g.saves),
        goalsAgainst: n(g.goalsAgainst),
        win: g.decision === "W",
        shutout:
          played && final && n(g.goalsAgainst) === 0 && g.decision === "W",
      });
    }
  }
  return { gameId: b.id, final, skaters, goalies };
}

export function skaterPoints(s: SkaterLine): number {
  return (
    s.goals * FANTASY_POINTS.goal +
    s.assists * FANTASY_POINTS.assist +
    s.shots * FANTASY_POINTS.shot +
    s.hits * FANTASY_POINTS.hit +
    s.blocks * FANTASY_POINTS.block
  );
}

export function goaliePoints(g: GoalieLine): number {
  return (
    g.saves * FANTASY_POINTS.save +
    (g.win ? FANTASY_POINTS.goalieWin : 0) +
    (g.shutout ? FANTASY_POINTS.shutout : 0)
  );
}

export interface RosterScore {
  readonly total: number;
  /** One line per player on the roster, listed or not. */
  readonly lines: readonly {
    readonly playerId: number;
    readonly name: string;
    readonly points: number;
    /** False when the record does not list them: nothing was invented. */
    readonly listed: boolean;
  }[];
}

/** A roster's points from the record, to one decimal; an unlisted player is 0 and says so. */
export function scoreRoster(
  roster: readonly number[],
  box: BoxscoreRead,
): RosterScore {
  const lines = roster.map((id) => {
    const s = box.skaters.find((x) => x.playerId === id);
    if (s)
      return {
        playerId: id,
        name: s.name,
        points: round1(skaterPoints(s)),
        listed: true,
      };
    const g = box.goalies.find((x) => x.playerId === id);
    if (g)
      return {
        playerId: id,
        name: g.name,
        points: round1(goaliePoints(g)),
        listed: true,
      };
    return { playerId: id, name: String(id), points: 0, listed: false };
  });
  return { total: round1(lines.reduce((t, l) => t + l.points, 0)), lines };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Highest first; ties share a rank; a deterministic order so every phone agrees. */
export function fantasyTable<T extends { readonly id: string }>(
  entries: readonly { readonly who: T; readonly score: RosterScore }[],
): { readonly who: T; readonly points: number; readonly rank: number }[] {
  const sorted = [...entries].sort(
    (a, b) => b.score.total - a.score.total || a.who.id.localeCompare(b.who.id),
  );
  let rank = 0;
  let last = Number.NaN;
  return sorted.map((e, i) => {
    if (e.score.total !== last) {
      rank = i + 1;
      last = e.score.total;
    }
    return { who: e.who, points: e.score.total, rank };
  });
}
