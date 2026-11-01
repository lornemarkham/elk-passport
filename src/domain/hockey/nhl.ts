/**
 * **What the NHL says about this game — read, never guessed.**
 *
 * The league publishes its schedule and live game state without a key
 * (`api-web.nhle.com`). Passport reads it so a night can show the real score
 * and period, and so the host's "Call it" can start from what the league
 * recorded instead of from memory at 11pm.
 *
 * Three rules keep that honest:
 *
 * - **Matched, not assumed.** A night started from the league's schedule
 *   carries the game's own id and is tied to exactly that game. A night set
 *   by hand is tied to an NHL game only when a Canucks home game starts
 *   within a few hours of the night's puck drop and the opponent's name
 *   agrees. Anything else is "no game found", and the page says nothing
 *   rather than something about the wrong game.
 * - **Suggestions are not results.** The league's answers fill in what the
 *   host may call; the host still taps to call it, and can change any of it.
 * - **No marks.** No logos or crests; the page names teams by words and
 *   colours as it always has.
 *
 * This file is only shapes and reading. The fetching, caching and the route
 * live in `app/hockey/_server/game.ts`.
 */

import type { ResponseValue } from "@/experience-lab/core/types";

export type GameState = "scheduled" | "live" | "intermission" | "final";

export interface NhlGame {
  readonly gameId: number;
  readonly state: GameState;
  /** "1st", "2nd", "3rd", "OT", "SO" — what the scoreboard says, or none yet. */
  readonly period?: string;
  /** Time left in the period, "12:34"; absent between games. */
  readonly clock?: string;
  readonly home: { readonly abbrev: string; readonly score: number };
  readonly away: { readonly abbrev: string; readonly score: number };
  /** Home-market TV, when the league lists one. */
  readonly broadcast?: string;
  /** Goals in the order they went in; a shootout is not in this list. */
  readonly goals: readonly {
    readonly side: "home" | "away";
    readonly scorer: string;
    readonly period: string;
    readonly time: string;
  }[];
  /** Final only: how it ended, from the league's own period record. */
  readonly ending?: "REG" | "OT" | "SO";
}

/** The Canucks' abbreviation: the home side of a night set by hand. */
export const HOME_ABBREV = "VAN";

interface Name {
  readonly default?: string;
}
interface ScheduleTeam {
  readonly abbrev?: string;
  readonly commonName?: Name;
  readonly placeName?: Name;
  readonly score?: number;
}
interface ScheduleGame {
  readonly id: number;
  readonly startTimeUTC: string;
  readonly homeTeam: ScheduleTeam;
  readonly awayTeam: ScheduleTeam;
  readonly venue?: Name;
  readonly venueTimezone?: string;
  readonly gameState?: string;
  readonly gameType?: number;
}

/**
 * One game on the league's schedule, as a night can be built on it: the
 * two sides by code, nickname and place, the arena by name, its zone, and
 * the league's id. No coordinates: the league publishes none, and Passport
 * does not invent them (`night.ts venuePoint`).
 */
export interface ScheduledGame {
  readonly id: number;
  readonly startsAt: string;
  readonly home: {
    readonly abbr: string;
    readonly name: string;
    readonly place: string;
  };
  readonly away: {
    readonly abbr: string;
    readonly name: string;
    readonly place: string;
  };
  readonly venue: string;
  readonly timeZone: string;
  /** "FUT" / "PRE" before the game, "LIVE"/"CRIT" during, "OFF"/"FINAL" after. */
  readonly state: string;
  /** 1 preseason, 2 regular season, 3 playoffs. */
  readonly gameType: number;
}

/** A schedule entry or a game landing, read as a `ScheduledGame`; null when it is not one. */
export function readScheduled(entry: unknown): ScheduledGame | null {
  const g = entry as ScheduleGame | null;
  if (
    !g ||
    typeof g.id !== "number" ||
    typeof g.startTimeUTC !== "string" ||
    !g.homeTeam?.abbrev ||
    !g.awayTeam?.abbrev
  )
    return null;
  const side = (t: ScheduleTeam) => ({
    abbr: t.abbrev ?? "",
    name: t.commonName?.default ?? t.abbrev ?? "",
    place: t.placeName?.default ?? "",
  });
  return {
    id: g.id,
    startsAt: new Date(g.startTimeUTC).toISOString(),
    home: side(g.homeTeam),
    away: side(g.awayTeam),
    venue: g.venue?.default ?? "",
    timeZone: g.venueTimezone ?? "",
    state: g.gameState ?? "",
    gameType: g.gameType ?? 0,
  };
}

/**
 * The games still ahead in a schedule week: regular season and playoffs,
 * not yet started, soonest first. Preseason is left out — rosters are not
 * the real ones, and nobody plans a night around it.
 */
export function readUpcoming(schedule: unknown, now: Date): ScheduledGame[] {
  const week = (schedule as { gameWeek?: { games?: unknown[] }[] })?.gameWeek;
  if (!Array.isArray(week)) return [];
  return week
    .flatMap((d) => d.games ?? [])
    .map(readScheduled)
    .filter((g): g is ScheduledGame => g !== null)
    .filter(
      (g) =>
        (g.gameType === 2 || g.gameType === 3) &&
        (g.state === "FUT" || g.state === "PRE") &&
        Date.parse(g.startsAt) > now.getTime(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** The next week the league lists, to walk the schedule forward. */
export function nextWeekOf(schedule: unknown): string | null {
  const next = (schedule as { nextStartDate?: unknown })?.nextStartDate;
  return typeof next === "string" && /^\d{4}-\d{2}-\d{2}$/.test(next)
    ? next
    : null;
}

/**
 * The schedule's entry for this night's game, or null when none fits. With
 * the league's id (a night started from the schedule) it is that game and
 * no other; without one, a Canucks home game by opponent and time.
 */
export function findScheduled(
  schedule: unknown,
  startsAt: string,
  opponent: string,
  gameId?: number,
): unknown | null {
  const week = (schedule as { gameWeek?: { games?: ScheduleGame[] }[] })
    ?.gameWeek;
  if (!Array.isArray(week)) return null;
  const games = week.flatMap((d) => d.games ?? []);
  if (gameId !== undefined) return games.find((g) => g.id === gameId) ?? null;
  const at = new Date(startsAt).getTime();
  if (Number.isNaN(at)) return null;
  const wanted = opponent.trim().toLowerCase();
  const matches = games.filter(
    (g) =>
      g.homeTeam?.abbrev === HOME_ABBREV &&
      g.awayTeam?.commonName?.default?.toLowerCase() === wanted &&
      Math.abs(new Date(g.startTimeUTC).getTime() - at) <= 4 * 3600e3,
  );
  return matches.length === 1 ? matches[0] : null;
}

/** The game this night is about, or null when no single game fits. */
export function findGameId(
  schedule: unknown,
  startsAt: string,
  opponent: string,
  gameId?: number,
): number | null {
  return (
    (findScheduled(schedule, startsAt, opponent, gameId) as ScheduleGame | null)
      ?.id ?? null
  );
}

const ordinal = (n: number) =>
  n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

function periodLabel(d: { number?: number; periodType?: string } | undefined) {
  if (!d?.number) return undefined;
  if (d.periodType === "SO") return "SO";
  if (d.periodType === "OT") return d.number > 4 ? `${d.number - 3}OT` : "OT";
  return ordinal(d.number);
}

interface Landing {
  readonly id?: number;
  readonly gameState?: string;
  readonly periodDescriptor?: { number?: number; periodType?: string };
  readonly clock?: {
    timeRemaining?: string;
    inIntermission?: boolean;
  };
  readonly homeTeam?: ScheduleTeam;
  readonly awayTeam?: ScheduleTeam;
  readonly tvBroadcasts?: {
    market?: string;
    countryCode?: string;
    network?: string;
  }[];
  readonly summary?: {
    scoring?: {
      periodDescriptor?: { number?: number; periodType?: string };
      goals?: {
        isHome?: boolean;
        teamAbbrev?: Name;
        name?: Name;
        timeInPeriod?: string;
      }[];
    }[];
  };
}

/** Reads the league's game record. Null when it is not a game record at all. */
export function readGame(landing: unknown): NhlGame | null {
  const g = landing as Landing;
  if (!g || typeof g.id !== "number" || !g.homeTeam || !g.awayTeam) return null;
  const raw = g.gameState ?? "";
  const final = raw === "FINAL" || raw === "OFF";
  const live = raw === "LIVE" || raw === "CRIT";
  const state: GameState = final
    ? "final"
    : live
      ? g.clock?.inIntermission
        ? "intermission"
        : "live"
      : "scheduled";

  const goals = (g.summary?.scoring ?? []).flatMap((p) =>
    (p.goals ?? []).map((goal) => ({
      side: (goal.isHome ? "home" : "away") as "home" | "away",
      scorer: goal.name?.default ?? goal.teamAbbrev?.default ?? "",
      period: periodLabel(p.periodDescriptor) ?? "",
      time: goal.timeInPeriod ?? "",
    })),
  );

  const last = g.periodDescriptor?.periodType;
  const broadcast = g.tvBroadcasts?.find(
    (b) => b.countryCode === "CA" && b.market === "N",
  )?.network;
  return {
    gameId: g.id,
    state,
    ...(state === "scheduled"
      ? {}
      : { period: periodLabel(g.periodDescriptor) }),
    ...(state === "live" && g.clock?.timeRemaining
      ? { clock: g.clock.timeRemaining }
      : {}),
    home: { abbrev: g.homeTeam.abbrev ?? "", score: g.homeTeam.score ?? 0 },
    away: { abbrev: g.awayTeam.abbrev ?? "", score: g.awayTeam.score ?? 0 },
    ...(broadcast ? { broadcast } : {}),
    goals,
    ...(final
      ? { ending: last === "SO" ? "SO" : last === "OT" ? "OT" : "REG" }
      : {}),
  } as NhlGame;
}

/**
 * What the league's record would fill in for the host's "Call it", keyed by
 * the question's id. Only a finished game suggests anything, and only what
 * the record actually settles: it says nothing about the refs or the beer.
 */
export function suggestedCalls(
  game: NhlGame | null,
): Record<string, { value: ResponseValue; words: string }> {
  if (!game || game.state !== "final") return {};
  const out: Record<string, { value: ResponseValue; words: string }> = {
    // Home first, as the night stores every pick; both codes said, so the
    // host reads "VAN 2–4 MIN" and not a pair of numbers to guess at.
    "final-score": {
      value: [game.home.score, game.away.score],
      words: `${game.home.abbrev} ${game.home.score}–${game.away.score} ${game.away.abbrev}`,
    },
    overtime: {
      value: game.ending !== "REG",
      words:
        game.ending !== "REG" ? "went past regulation" : "ended in regulation",
    },
  };
  if (game.goals.length > 0) {
    out["first-team"] = {
      value: game.goals[0].side === "home" ? "canucks" : "opponent",
      words: `${game.goals[0].scorer} scored first`,
    };
    out["total-goals"] = {
      value: game.goals.length,
      words: `${game.goals.length} goals`,
    };
  }
  return out;
}
