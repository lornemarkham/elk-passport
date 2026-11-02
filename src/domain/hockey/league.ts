import { NHL_TEAMS, teamByAbbr, type NhlTeam } from "./fans";

/**
 * **The league, as a public hockey site reads it.**
 *
 * `nhl.ts` reads one game for one night. This file reads the rest of the
 * league for the public pages at `/hockey`: a day's scoreboard, the
 * standings, a club's season schedule, its statistics, and the league's
 * scoring leaders — all from the NHL's public web API (`api-web.nhle.com`),
 * fetched and cached in `app/hockey/_server/league.ts`.
 *
 * The same rules as `nhl.ts`:
 *
 * - **Read, never guessed.** Every number on a public page is one of these
 *   readers' outputs. A field the league didn't send is absent, not zero; a
 *   body that isn't what we expect reads as nothing, and the page says the
 *   league can't be reached rather than inventing a table.
 * - **No marks.** Teams are named in words and dressed in two colours and a
 *   three-letter code (`teams.ts`). The league's logo URLs and player
 *   headshots are in these bodies; nothing here passes them on.
 *
 * Pure: no fetching, no clock except the one passed in. Pinned on real
 * league bodies from 1–2 November 2026 in `league.test.ts`.
 */

export type LeagueState =
  "scheduled" | "live" | "intermission" | "final" | "postponed";

export interface LeagueSide {
  readonly abbr: string;
  /** "Flames" */
  readonly name: string;
  /** "Calgary" */
  readonly place: string;
  /** Present once the game has started. */
  readonly score?: number;
  /** Shots on goal, when the league sends them. */
  readonly sog?: number;
}

export interface LeagueGoal {
  readonly side: "home" | "away";
  readonly scorer: string;
  readonly period: string;
  readonly time: string;
}

export interface LeagueGame {
  readonly id: number;
  readonly startsAt: string;
  readonly state: LeagueState;
  /** "1st", "OT", "SO"… once the game has started. */
  readonly period?: string;
  /** Time left in the period while it is being played. */
  readonly clock?: string;
  /** Finals only. */
  readonly ending?: "REG" | "OT" | "SO";
  readonly home: LeagueSide;
  readonly away: LeagueSide;
  readonly venue: string;
  readonly timeZone: string;
  /** 1 preseason, 2 regular season, 3 playoffs. */
  readonly gameType: number;
  /** National networks the league lists (Canada first). */
  readonly broadcasts: readonly string[];
  /** Goals in order, when the body carries them (the scoreboard does). */
  readonly goals: readonly LeagueGoal[];
}

export interface Scoreboard {
  /** The league's own idea of "today" (it runs on Eastern time). */
  readonly date: string;
  readonly prevDate?: string;
  readonly nextDate?: string;
  /** The week around `date`, for a date strip. */
  readonly week: readonly { date: string; games: number }[];
  readonly games: readonly LeagueGame[];
}

interface Name {
  readonly default?: string;
}
interface RawSide {
  readonly abbrev?: string;
  readonly name?: Name;
  readonly commonName?: Name;
  readonly placeName?: Name;
  readonly score?: number;
  readonly sog?: number;
}
interface RawPeriod {
  readonly number?: number;
  readonly periodType?: string;
}
interface RawGame {
  readonly id?: number;
  readonly startTimeUTC?: string;
  readonly gameState?: string;
  readonly gameScheduleState?: string;
  readonly gameType?: number;
  readonly venue?: Name;
  readonly venueTimezone?: string;
  readonly homeTeam?: RawSide;
  readonly awayTeam?: RawSide;
  readonly periodDescriptor?: RawPeriod;
  readonly gameOutcome?: { lastPeriodType?: string };
  readonly clock?: { timeRemaining?: string; inIntermission?: boolean };
  readonly tvBroadcasts?: {
    market?: string;
    countryCode?: string;
    network?: string;
  }[];
  readonly goals?: {
    periodDescriptor?: RawPeriod;
    timeInPeriod?: string;
    name?: Name;
    teamAbbrev?: string | Name;
  }[];
}

const ordinal = (n: number) =>
  n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

/** "1st", "2nd", "3rd", "OT", "2OT", "SO". */
export function periodName(d: RawPeriod | undefined): string | undefined {
  if (!d?.number) return undefined;
  if (d.periodType === "SO") return "SO";
  if (d.periodType === "OT") return d.number > 4 ? `${d.number - 3}OT` : "OT";
  return ordinal(d.number);
}

function side(raw: RawSide, started: boolean): LeagueSide {
  const abbr = raw.abbrev ?? "";
  const known = teamByAbbr(abbr);
  return {
    abbr,
    name: raw.commonName?.default ?? raw.name?.default ?? known?.name ?? abbr,
    place: raw.placeName?.default ?? known?.city ?? "",
    ...(started && typeof raw.score === "number" ? { score: raw.score } : {}),
    ...(started && typeof raw.sog === "number" ? { sog: raw.sog } : {}),
  };
}

/** One game from any league body that lists games; null when it is not one. */
export function readLeagueGame(entry: unknown): LeagueGame | null {
  const g = entry as RawGame | null;
  if (
    !g ||
    typeof g.id !== "number" ||
    typeof g.startTimeUTC !== "string" ||
    !g.homeTeam?.abbrev ||
    !g.awayTeam?.abbrev ||
    Number.isNaN(Date.parse(g.startTimeUTC))
  )
    return null;
  const raw = g.gameState ?? "";
  const postponed =
    g.gameScheduleState === "PPD" || g.gameScheduleState === "CNCL";
  const final = raw === "FINAL" || raw === "OFF";
  const live = raw === "LIVE" || raw === "CRIT";
  const state: LeagueState = postponed
    ? "postponed"
    : final
      ? "final"
      : live
        ? g.clock?.inIntermission
          ? "intermission"
          : "live"
        : "scheduled";
  const started = final || live;
  const last = g.gameOutcome?.lastPeriodType ?? g.periodDescriptor?.periodType;
  const homeAbbr = g.homeTeam.abbrev;
  const broadcasts = [
    ...new Set(
      (g.tvBroadcasts ?? [])
        .filter((b) => b.market === "N" && b.network)
        .sort((a, b) =>
          a.countryCode === b.countryCode ? 0 : a.countryCode === "CA" ? -1 : 1,
        )
        .map((b) => b.network as string),
    ),
  ];
  return {
    id: g.id,
    startsAt: new Date(g.startTimeUTC).toISOString(),
    state,
    ...(started ? { period: periodName(g.periodDescriptor) } : {}),
    ...(state === "live" && g.clock?.timeRemaining
      ? { clock: g.clock.timeRemaining }
      : {}),
    ...(final
      ? { ending: last === "SO" ? "SO" : last === "OT" ? "OT" : "REG" }
      : {}),
    home: side(g.homeTeam, started),
    away: side(g.awayTeam, started),
    venue: g.venue?.default ?? "",
    timeZone: g.venueTimezone ?? "",
    gameType: g.gameType ?? 0,
    broadcasts,
    goals: (g.goals ?? []).map((goal) => {
      const team =
        typeof goal.teamAbbrev === "string"
          ? goal.teamAbbrev
          : goal.teamAbbrev?.default;
      return {
        side: team === homeAbbr ? "home" : "away",
        scorer: goal.name?.default ?? team ?? "",
        period: periodName(goal.periodDescriptor) ?? "",
        time: goal.timeInPeriod ?? "",
      } as const;
    }),
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown) =>
  typeof v === "string" && DAY.test(v) ? v : undefined;

/** `/v1/score/{date|now}`: one day's games, earliest first. Null when the body isn't a scoreboard. */
export function readScoreboard(body: unknown): Scoreboard | null {
  const b = body as {
    currentDate?: unknown;
    prevDate?: unknown;
    nextDate?: unknown;
    gameWeek?: { date?: unknown; numberOfGames?: unknown }[];
    games?: unknown[];
  } | null;
  const date = day(b?.currentDate);
  if (!b || !date || !Array.isArray(b.games)) return null;
  const prevDate = day(b.prevDate);
  const nextDate = day(b.nextDate);
  return {
    date,
    ...(prevDate ? { prevDate } : {}),
    ...(nextDate ? { nextDate } : {}),
    week: (b.gameWeek ?? []).flatMap((d) => {
      const at = day(d.date);
      return at
        ? [
            {
              date: at,
              games: typeof d.numberOfGames === "number" ? d.numberOfGames : 0,
            },
          ]
        : [];
    }),
    games: b.games
      .map(readLeagueGame)
      .filter((g): g is LeagueGame => g !== null)
      .sort((a, c) => a.startsAt.localeCompare(c.startsAt) || a.id - c.id),
  };
}

/** `/v1/club-schedule-season/{abbr}/now`: a club's season, regular season and playoffs, in order. */
export function readClubSeason(body: unknown): LeagueGame[] {
  const games = (body as { games?: unknown[] } | null)?.games;
  if (!Array.isArray(games)) return [];
  return games
    .map(readLeagueGame)
    .filter(
      (g): g is LeagueGame =>
        g !== null && (g.gameType === 2 || g.gameType === 3),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** A club's season split: what's been played (latest first) and what's ahead (soonest first). */
export function splitSeason(games: readonly LeagueGame[]): {
  played: LeagueGame[];
  ahead: LeagueGame[];
  now: LeagueGame | null;
} {
  const now =
    games.find((g) => g.state === "live" || g.state === "intermission") ?? null;
  return {
    now,
    played: games.filter((g) => g.state === "final").reverse(),
    ahead: games.filter((g) => g.state === "scheduled"),
  };
}

/** "W", "L" or "OTL" for `abbr` in a finished game; null otherwise. */
export function resultFor(game: LeagueGame, abbr: string): string | null {
  if (game.state !== "final") return null;
  const mine = game.home.abbr === abbr ? game.home : game.away;
  const theirs = game.home.abbr === abbr ? game.away : game.home;
  if (mine.score === undefined || theirs.score === undefined) return null;
  if (mine.score > theirs.score) return "W";
  return game.ending === "REG" ? "L" : "OTL";
}

export interface StandingRow {
  readonly abbr: string;
  readonly name: string;
  readonly place: string;
  readonly conference: string;
  readonly division: string;
  readonly leagueRank: number;
  readonly conferenceRank: number;
  readonly divisionRank: number;
  /** 0 for the division's top three; 1, 2… for the wild-card race. */
  readonly wildcardRank: number;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly otLosses: number;
  readonly points: number;
  readonly pointPct: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDiff: number;
  /** "8-1-1" */
  readonly lastTen: string;
  /** "W4" */
  readonly streak: string;
  /** "x", "y", "z", "p", "e" — the league's clinch marks, when it gives one. */
  readonly clinch?: string;
}

export interface Standings {
  /** The league's own date for the table. */
  readonly date: string;
  readonly rows: readonly StandingRow[];
}

const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/** `/v1/standings/now`. Null when the body isn't a standings table. */
export function readStandings(body: unknown): Standings | null {
  const list = (body as { standings?: unknown[] } | null)?.standings;
  if (!Array.isArray(list) || list.length === 0) return null;
  const rows = list.flatMap((r): StandingRow[] => {
    const s = r as Record<string, unknown> & {
      teamAbbrev?: Name;
      teamCommonName?: Name;
      placeName?: Name;
    };
    const abbr = s.teamAbbrev?.default;
    if (!abbr) return [];
    return [
      {
        abbr,
        name: s.teamCommonName?.default ?? abbr,
        place: s.placeName?.default ?? "",
        conference: String(s.conferenceName ?? ""),
        division: String(s.divisionName ?? ""),
        leagueRank: num(s.leagueSequence),
        conferenceRank: num(s.conferenceSequence),
        divisionRank: num(s.divisionSequence),
        wildcardRank: num(s.wildcardSequence),
        gamesPlayed: num(s.gamesPlayed),
        wins: num(s.wins),
        losses: num(s.losses),
        otLosses: num(s.otLosses),
        points: num(s.points),
        pointPct: num(s.pointPctg),
        goalsFor: num(s.goalFor),
        goalsAgainst: num(s.goalAgainst),
        goalDiff: num(s.goalDifferential),
        lastTen: `${num(s.l10Wins)}-${num(s.l10Losses)}-${num(s.l10OtLosses)}`,
        streak:
          typeof s.streakCode === "string"
            ? `${s.streakCode}${num(s.streakCount)}`
            : "",
        ...(typeof s.clinchIndicator === "string"
          ? { clinch: s.clinchIndicator }
          : {}),
      },
    ];
  });
  if (rows.length === 0) return null;
  const first = list[0] as { date?: unknown };
  return {
    date: day(first.date) ?? "",
    rows: rows.sort((a, b) => a.leagueRank - b.leagueRank),
  };
}

/** Rows grouped by `key`, each group in its own rank order, groups in first-seen order. */
export function groupStandings(
  rows: readonly StandingRow[],
  by: "division" | "conference",
): { name: string; rows: StandingRow[] }[] {
  const rank = by === "division" ? "divisionRank" : "conferenceRank";
  const groups = new Map<string, StandingRow[]>();
  const order = [...rows].sort((a, b) =>
    by === "division"
      ? a.conference.localeCompare(b.conference) ||
        a.division.localeCompare(b.division)
      : a.conference.localeCompare(b.conference),
  );
  for (const r of order) {
    const k = r[by];
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups].map(([name, list]) => ({
    name,
    rows: list.sort((a, b) => a[rank] - b[rank]),
  }));
}

/** "12–2–2" */
export const recordOf = (r: StandingRow) =>
  `${r.wins}–${r.losses}–${r.otLosses}`;

export interface SkaterLine {
  readonly name: string;
  readonly position: string;
  readonly gamesPlayed: number;
  readonly goals: number;
  readonly assists: number;
  readonly points: number;
  readonly plusMinus: number;
}

export interface GoalieLine {
  readonly name: string;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly otLosses: number;
  /** Goals-against average, as the league computes it. */
  readonly gaa: number;
  /** Save percentage, 0–1. */
  readonly savePct: number;
}

const fullName = (p: { firstName?: Name; lastName?: Name }) =>
  [p.firstName?.default, p.lastName?.default].filter(Boolean).join(" ");

/** `/v1/club-stats/{abbr}/now`: skaters by points (then goals), goalies by games played. */
export function readClubStats(body: unknown): {
  skaters: SkaterLine[];
  goalies: GoalieLine[];
} {
  const b = body as { skaters?: unknown[]; goalies?: unknown[] } | null;
  const skaters = (Array.isArray(b?.skaters) ? b.skaters : [])
    .map((raw) => {
      const p = raw as Record<string, unknown> & {
        firstName?: Name;
        lastName?: Name;
      };
      return {
        name: fullName(p),
        position: String(p.positionCode ?? ""),
        gamesPlayed: num(p.gamesPlayed),
        goals: num(p.goals),
        assists: num(p.assists),
        points: num(p.points),
        plusMinus: num(p.plusMinus),
      };
    })
    .filter((p) => p.name && p.gamesPlayed > 0)
    .sort(
      (a, c) =>
        c.points - a.points ||
        c.goals - a.goals ||
        a.name.localeCompare(c.name),
    );
  const goalies = (Array.isArray(b?.goalies) ? b.goalies : [])
    .map((raw) => {
      const p = raw as Record<string, unknown> & {
        firstName?: Name;
        lastName?: Name;
      };
      return {
        name: fullName(p),
        gamesPlayed: num(p.gamesPlayed),
        wins: num(p.wins),
        losses: num(p.losses),
        otLosses: num(p.overtimeLosses),
        gaa: num(p.goalsAgainstAverage),
        savePct: num(p.savePercentage),
      };
    })
    .filter((p) => p.name && p.gamesPlayed > 0)
    .sort((a, c) => c.gamesPlayed - a.gamesPlayed);
  return { skaters, goalies };
}

export interface Leader {
  readonly name: string;
  readonly team: string;
  readonly value: number;
}

/** `/v1/skater-stats-leaders/current?categories=…`: each category's leaders, in the league's order. */
export function readLeaders(body: unknown): Record<string, Leader[]> {
  if (!body || typeof body !== "object") return {};
  const out: Record<string, Leader[]> = {};
  for (const [category, list] of Object.entries(body)) {
    if (!Array.isArray(list)) continue;
    const leaders = list.flatMap((raw): Leader[] => {
      const p = raw as {
        firstName?: Name;
        lastName?: Name;
        teamAbbrev?: string;
        value?: number;
      };
      const name = fullName(p);
      return name && typeof p.value === "number"
        ? [{ name, team: p.teamAbbrev ?? "", value: p.value }]
        : [];
    });
    if (leaders.length) out[category] = leaders;
  }
  return out;
}

// ---------------------------------------------------------------- teams

/** "calgary-flames", "montreal-canadiens", "st-louis-blues". */
export function teamSlug(team: Pick<NhlTeam, "city" | "name">): string {
  return `${team.city} ${team.name}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const BY_SLUG = new Map(NHL_TEAMS.map((t) => [teamSlug(t), t]));

export function teamBySlug(slug: string): NhlTeam | null {
  return BY_SLUG.get(slug) ?? null;
}

/** "Calgary Flames" */
export const teamFullName = (t: Pick<NhlTeam, "city" | "name">) =>
  `${t.city} ${t.name}`;

// ---------------------------------------------------------------- featured

/** Live first, then the rest in schedule order, so a scoreboard opens on what's happening. */
export function scoreboardOrder(games: readonly LeagueGame[]): LeagueGame[] {
  const weight = (g: LeagueGame) =>
    g.state === "live" || g.state === "intermission"
      ? 0
      : g.state === "scheduled"
        ? 1
        : g.state === "final"
          ? 2
          : 3;
  return [...games].sort(
    (a, b) => weight(a) - weight(b) || a.startsAt.localeCompare(b.startsAt),
  );
}

export const plays = (g: LeagueGame, abbr: string) =>
  g.home.abbr === abbr || g.away.abbr === abbr;

/**
 * **The featured matchup.** An editorial preference, said out loud: the
 * featured team's game when it plays today; otherwise what's live, then
 * what's next, then the day's last final. Every other game is still on the
 * same scoreboard, in the same type — this picks the big card, not the news.
 */
export function featuredGame(
  games: readonly LeagueGame[],
  featured: string,
): LeagueGame | null {
  const mine = games.find((g) => plays(g, featured) && g.state !== "postponed");
  if (mine) return mine;
  const ordered = scoreboardOrder(games).filter((g) => g.state !== "postponed");
  return ordered[0] ?? null;
}

/** A night can be built on a game that hasn't started: regular season or playoffs, still ahead. */
export function nightable(g: LeagueGame, now: Date): boolean {
  return (
    g.state === "scheduled" &&
    (g.gameType === 2 || g.gameType === 3) &&
    Date.parse(g.startsAt) > now.getTime()
  );
}

/**
 * **The home page's big card**, given today's board and the next day's.
 * The featured club's game today, in any state; otherwise what's live or
 * still to come today; and once today is over (or there was nothing), the
 * next day — the featured club first again — so at 11pm the page is
 * already pointing at tomorrow. A final from today only when there is no
 * next day to show.
 */
export function pickHero(
  today: readonly LeagueGame[],
  next: readonly LeagueGame[],
  featured: string,
): LeagueGame | null {
  const real = (g: LeagueGame) => g.state !== "postponed";
  const mine = today.find((g) => real(g) && plays(g, featured));
  if (mine) return mine;
  const active = scoreboardOrder(today).filter(
    (g) => g.state !== "final" && real(g),
  );
  if (active.length) return active[0];
  const tomorrow = featuredGame(next, featured);
  if (tomorrow) return tomorrow;
  return [...today].reverse().find(real) ?? null;
}

/** Whether a board still has anything to watch: a game live or not yet started. */
export const stillOn = (games: readonly LeagueGame[]) =>
  games.some(
    (g) =>
      g.state === "scheduled" ||
      g.state === "live" ||
      g.state === "intermission",
  );

/** Each club's "W–L–OT" from the table, for cards that want it beside a name. */
export function recordsOf(table: Standings | null): Record<string, string> {
  return Object.fromEntries(
    (table?.rows ?? []).map((r) => [r.abbr, recordOf(r)]),
  );
}

/** "6th in the Pacific" */
export function placeIn(row: StandingRow): string {
  const n = row.divisionRank;
  const suffix =
    n % 10 === 1 && n !== 11
      ? "st"
      : n % 10 === 2 && n !== 12
        ? "nd"
        : n % 10 === 3 && n !== 13
          ? "rd"
          : "th";
  return `${n}${suffix} in the ${row.division}`;
}
