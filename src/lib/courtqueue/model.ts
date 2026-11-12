import type { Journey } from "./journey";
import type { Cancellation } from "./schedule";

/**
 * **CourtQueue — Everybody Plays.** The shapes the badminton night is made of.
 *
 * Two kinds of stored document, both plain JSON:
 *
 *   club              everyone who has ever registered, the three courts, the
 *                     rules, and the list of sessions
 *   session:<id>      one Monday or Thursday: who signed up, who is here, the
 *                     queue, the games and the challenges
 *
 * Every change to a document goes through `engine.ts`, which works on a copy
 * and is handed the server's clock — a phone's clock never decides a start
 * or finish time. Statistics are never stored as counters; they are read back
 * out of the games (`stats.ts`), so a corrected timestamp corrects the totals.
 */

/**
 * **Playing mood.** What a player is in the mood for tonight. A choice for one
 * night, changeable any time, never a rating of the player, never shown next
 * to their name and never carried to the next night. The ids are the ones
 * stored since 2026-11-10 (`fun`, `rallies`); the words are what players read.
 */
export type Mood = "fun" | "rallies" | "challenge" | "help";

export const MOODS: readonly { id: Mood; label: string; hint: string }[] = [
  { id: "fun", label: "Just Here to Play", hint: "Any game is a good game." },
  {
    id: "rallies",
    label: "Find My Rhythm",
    hint: "Friendly, steady rallies.",
  },
  {
    id: "challenge",
    label: "Challenge Me",
    hint: "A game that stretches me.",
  },
  {
    id: "help",
    label: "Happy to Help",
    hint: "Glad to play with someone newer.",
  },
];

export const isMood = (m: unknown): m is Mood =>
  m === "fun" || m === "rallies" || m === "challenge" || m === "help";

export interface Player {
  readonly id: string;
  name: string;
  readonly createdAt: number;
  /** scrypt, `salt:hash`. Never leaves the server. */
  pinHash: string;
  /** sha256 of each live sign-in token. Never leaves the server. */
  tokenHashes: string[];
  /**
   * Given at sign-up (2026-11-12). Private: only the organizer can read it,
   * for reaching a player about the club. Not used to sign in.
   */
  email?: string;
  /** "Happy to welcome newcomers": a volunteer, not a rank. */
  mentor: boolean;
  organizer: boolean;
  photo: boolean;
  /**
   * Their own badminton journey (`journey.ts`): optional, private to them,
   * only ever a gentle input to suggestions.
   */
  journey?: Journey;
}

export interface Court {
  readonly id: 1 | 2 | 3 | 4;
  name: string;
  where: string;
}

export interface Rules {
  capacity: number;
  /** Minutes a game may run before the organizer is asked about it. */
  longGameMinutes: number;
  /**
   * Retired 2026-11-10 (a challenge no longer goes ahead of fairness after
   * waiting). Kept so stored clubs and the organizer's form still parse.
   */
  challengePatienceMinutes: number;
}

export interface SessionMeta {
  readonly id: string;
  /** YYYY-MM-DD, on the wall in Vancouver. */
  readonly date: string;
  readonly label: string;
}

export interface Club {
  players: Record<string, Player>;
  courts: Court[];
  rules: Rules;
  sessions: SessionMeta[];
  /**
   * Nights the organizer has cancelled (the crossed-out dates on the official
   * schedule, or a gym closed at short notice), by date. Added 2026-11-10;
   * older club documents have none.
   */
  cancelled?: Record<string, Cancellation>;
  /** Every change to the season's calendar, oldest first. */
  scheduleLog?: AuditEntry[];
  /** An organizer checked the calendar against the official sheet. */
  scheduleConfirmed?: { readonly by: string; readonly at: number };
}

export type RosterStatus = "confirmed" | "waitlist" | "cancelled" | "no-show";

export interface RosterEntry {
  readonly playerId: string;
  /** When they signed up, which is their place in the waitlist. */
  readonly at: number;
  status: RosterStatus;
  promotedAt?: number;
}

export interface Presence {
  readonly at: number;
  leftAt?: number;
  /**
   * Retired 2026-11-10: nobody goes back in the queue by themselves any more
   * — after a game a player taps BACK IN THE QUEUE when they're ready. Kept
   * because nights stored before then carry it; nothing reads it.
   */
  autoRequeue: boolean;
}

export interface QueueEntry {
  readonly playerId: string;
  /** When they started waiting. A declined game keeps it. */
  readonly since: number;
}

/** Four places: [0,1] is one team, [2,3] the other. */
export type Slots = [
  string | null,
  string | null,
  string | null,
  string | null,
];

export type GameStatus = "called" | "playing" | "finished" | "cancelled";

export interface Game {
  readonly id: string;
  court: 1 | 2 | 3 | 4;
  slots: Slots;
  readonly source: "fair" | "challenge" | "organizer";
  readonly challengeId?: string;
  /** Plain words for why these four, shown to the four. */
  why: string[];
  status: GameStatus;
  readonly calledAt: number;
  accepted: Record<string, number>;
  /** Players who said "not this one" — never offered this game again. */
  declined: string[];
  /** Where each player was waiting from, so a cancelled call costs nothing. */
  waitedSince: Record<string, number>;
  startedAt?: number;
  startedBy?: string;
  startEstimated?: boolean;
  finishedAt?: number;
  finishedBy?: string;
  endEstimated?: boolean;
  score?: [number, number];
  winner?: 0 | 1;
  scoreBy?: string;
  confirmedBy?: string;
  disputedBy?: string;
  kudos: { from: string; to: string }[];
}

export type ChallengeStatus =
  "pending" | "ready" | "on-court" | "done" | "declined" | "cancelled";

export interface Challenge {
  readonly id: string;
  readonly by: string;
  /** [0,1] versus [2,3]. */
  readonly slots: [string, string, string, string];
  readonly createdAt: number;
  accepted: Record<string, number>;
  status: ChallengeStatus;
  readyAt?: number;
  declinedBy?: string;
  /** A playful line from whoever sent it (screened like chat). */
  note?: string;
  /** Sent as "same four, again?" after a game. */
  rematch?: boolean;
  gameId?: string;
  /** Queue places held for anyone who left the queue to accept. */
  restore: Record<string, number>;
}

export interface AuditEntry {
  readonly at: number;
  readonly by: string;
  readonly what: string;
  readonly gameId?: string;
  readonly playerId?: string;
}

export interface Award {
  readonly at: number;
  readonly by: string;
  readonly to: string;
  readonly reason: string;
}

export type SessionStatus = "upcoming" | "live" | "ended";

export interface Session {
  readonly id: string;
  readonly date: string;
  readonly label: string;
  status: SessionStatus;
  registrationOpen: boolean;
  endedAt?: number;
  roster: RosterEntry[];
  present: Record<string, Presence>;
  queue: QueueEntry[];
  closedCourts: number[];
  games: Game[];
  challenges: Challenge[];
  awards: Award[];
  /** Tonight's "what sounds fun" choices, by player. Per night, optional. */
  moods?: Record<string, Mood>;
  /**
   * Players the organizer asked to play next — a new face, someone who has
   * waited, someone with a bus to catch. Cleared as they are called.
   */
  nextUp?: string[];
  audit: AuditEntry[];
  seq: number;
  /**
   * Reminders already sent, by what they were about (`slow:g12`,
   * `long:g12`, `open`), so a phone is told once — whichever server saw the
   * moment first wins the write and sends.
   */
  notified?: Record<string, number>;
}

export const DEFAULT_COURTS: Court[] = [
  { id: 1, name: "Court 1", where: "Furthest from the seats" },
  { id: 2, name: "Court 2", where: "The middle court" },
  { id: 3, name: "Court 3", where: "Closest to the seats" },
  { id: 4, name: "Court 4", where: "Next to Court 3" },
];

const LEGACY_COURT = /^(beginner|intermediate|expert) court$/i;
const LEGACY_PLAYER_FIELDS = ["skill", "skillHistory", "statsPublic"] as const;
const LEGACY_COURT_FIELDS = [
  "kind",
  "minSkill",
  "maxSkill",
  "idealMin",
  "idealMax",
  "stretchPartnerMin",
] as const;

/**
 * **Everyone belongs (2026-11-10).** Clubs stored before this carry skill
 * levels, level history, a skill range on each court and "Beginner / Expert"
 * court names. None of it is read any more; this drops it the next time the
 * club is read, and renames the courts. A club with none of it is returned
 * as it is.
 */
export function tidyClub(club: Club): Club {
  const legacy =
    club.courts.some(
      (c) =>
        LEGACY_COURT.test(c.name) || LEGACY_COURT_FIELDS.some((k) => k in c),
    ) ||
    Object.values(club.players).some((p) =>
      LEGACY_PLAYER_FIELDS.some((k) => k in p),
    );
  const fourCourts = club.courts.length >= DEFAULT_COURTS.length;
  if (!legacy && fourCourts) return club;
  const out = structuredClone(club);
  // The club now has four doubles courts; a club stored with three gets the fourth.
  for (const c of DEFAULT_COURTS)
    if (!out.courts.some((x) => x.id === c.id)) out.courts.push({ ...c });
  for (const c of out.courts) {
    if (LEGACY_COURT.test(c.name)) c.name = `Court ${c.id}`;
    for (const k of LEGACY_COURT_FIELDS)
      delete (c as unknown as Record<string, unknown>)[k];
  }
  for (const p of Object.values(out.players))
    for (const k of LEGACY_PLAYER_FIELDS)
      delete (p as unknown as Record<string, unknown>)[k];
  return out;
}

export const DEFAULT_RULES: Rules = {
  capacity: 25,
  longGameMinutes: 30,
  challengePatienceMinutes: 15,
};

export function emptyClub(): Club {
  return {
    players: {},
    courts: structuredClone(DEFAULT_COURTS),
    rules: { ...DEFAULT_RULES },
    sessions: [],
  };
}

export function emptySession(meta: SessionMeta): Session {
  return {
    ...meta,
    status: "upcoming",
    registrationOpen: true,
    roster: [],
    present: {},
    queue: [],
    closedCourts: [],
    games: [],
    challenges: [],
    awards: [],
    audit: [],
    seq: 0,
  };
}

export const isActiveGame = (g: Game) =>
  g.status === "called" || g.status === "playing";

export const isHeldChallenge = (c: Challenge) =>
  c.status === "pending" || c.status === "ready";

export const filled = (slots: Slots): string[] =>
  slots.filter((p): p is string => p !== null);

export const MINUTE = 60_000;

/** Whole minutes a finished game was played: start to finish, nothing else. */
export function playedMinutes(g: Game): number {
  if (g.status !== "finished" || !g.startedAt || !g.finishedAt) return 0;
  return Math.max(0, Math.round((g.finishedAt - g.startedAt) / MINUTE));
}

export const teamOf = (g: { slots: readonly (string | null)[] }, id: string) =>
  g.slots.indexOf(id) < 0 ? null : g.slots.indexOf(id) < 2 ? 0 : 1;

/** Players this player partnered in a game. */
export function partnerIn(
  g: { slots: readonly (string | null)[] },
  id: string,
): string | null {
  const i = g.slots.indexOf(id);
  if (i < 0) return null;
  return g.slots[i ^ 1] ?? null;
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

/** Lower-cased and trimmed, or null when it isn't an email address. */
export function cleanEmail(raw: unknown): string | null {
  const e = String(raw ?? "")
    .trim()
    .toLowerCase();
  return e.length <= 120 && EMAIL.test(e) ? e : null;
}
