import "server-only";
import {
  readClubSeason,
  readClubStats,
  readLeaders,
  readScoreboard,
  readStandings,
  type GoalieLine,
  type Leader,
  type LeagueGame,
  type Scoreboard,
  type SkaterLine,
  type Standings,
} from "@/domain/hockey/league";

/**
 * **The league, fetched for the public pages.**
 *
 * One request per body per cache window, however many people are reading:
 * Next's data cache holds each body for as long as it can change slowly —
 * the scoreboard thirty seconds (the league's own CDN holds it about twenty),
 * the table and schedules minutes, statistics half an hour. That keeps the
 * load on the league's servers at a handful of requests a minute, which is
 * the least a site reading somebody else's public data owes them.
 *
 * Every reader returns null (or an empty list) on any failure — the league
 * down, a timeout, a body we don't understand — and the page says so in
 * words. Nothing is ever filled in.
 *
 * The provider is one base URL (`NHL_API_BASE`, shared with `game.ts`). A
 * licensed feed would replace this file and keep the shapes in
 * `domain/hockey/league.ts`.
 */

const BASE = process.env.NHL_API_BASE ?? "https://api-web.nhle.com";

async function read<T>(
  path: string,
  revalidate: number,
  reader: (body: unknown) => T,
  fallback: T,
): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      next: { revalidate, tags: ["nhl"] },
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`NHL ${res.status} ${path}`);
    return reader(await res.json());
  } catch (error) {
    console.error(
      "[hockey] league",
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A day's scoreboard; today's (the league's today) without a date. */
export function scoreboard(date?: string): Promise<Scoreboard | null> {
  const which = date && DATE.test(date) ? date : "now";
  return read(`/v1/score/${which}`, 30, readScoreboard, null);
}

export function standings(): Promise<Standings | null> {
  return read("/v1/standings/now", 300, readStandings, null);
}

/** A club's regular season and playoffs; empty when the league can't be reached. */
export function clubSeason(abbr: string): Promise<LeagueGame[]> {
  return read(
    `/v1/club-schedule-season/${encodeURIComponent(abbr)}/now`,
    300,
    readClubSeason,
    [],
  );
}

export function clubStats(
  abbr: string,
): Promise<{ skaters: SkaterLine[]; goalies: GoalieLine[] }> {
  return read(
    `/v1/club-stats/${encodeURIComponent(abbr)}/now`,
    1800,
    readClubStats,
    { skaters: [], goalies: [] },
  );
}

export function leaders(): Promise<Record<string, Leader[]>> {
  return read(
    "/v1/skater-stats-leaders/current?categories=points,goals,assists&limit=5",
    1800,
    readLeaders,
    {},
  );
}
