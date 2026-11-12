import { LEVELS, levelRank, type Level } from "./journey";
import type { Club, Court, PlayMode, Session } from "./model";

/**
 * **Court eligibility — optional, and the organizer's to configure.**
 *
 * Owner decision 2026-11-12 (ADR 017, amendment): CourtQueue has two modes.
 *
 *   open     the default. Every player is eligible for every court.
 *   guided   each court may name a lowest level. A player below it is never
 *            put on that court, by the fairness engine, an organizer's
 *            hand-picked four or a challenge; a player above it may play on
 *            any lower court.
 *
 * A player's level for this purpose is, in order: the level the organizer
 * placed them at, the one they chose privately for their own journey, else
 * **beginner** — a player nobody has placed is never sent to a court that
 * asks for more. Levels are used here and nowhere else in the engine's
 * choices of courts; they are never sent to a player's phone.
 */

export const modeOf = (club: Club): PlayMode =>
  club.rules.mode === "guided" ? "guided" : "open";

/** Level used for eligibility, and whether anybody actually said it. */
export function levelFor(
  club: Club,
  id: string,
): { level: Level; known: boolean } {
  const p = club.players[id];
  const set = p?.placedAt ?? p?.journey?.level;
  return set
    ? { level: set, known: true }
    : { level: "beginner", known: false };
}

const rankOf = (l: Level | undefined) => levelRank(l) ?? 0;

/** May this player be put on this court right now? */
export function mayPlay(club: Club, court: Court, id: string): boolean {
  if (modeOf(club) === "open" || !court.minLevel) return true;
  return rankOf(levelFor(club, id).level) >= rankOf(court.minLevel);
}

export const allMayPlay = (club: Club, court: Court, ids: readonly string[]) =>
  ids.every((id) => mayPlay(club, court, id));

/** The courts a player may be put on, by court id. */
export function eligibleCourts(club: Club, id: string): number[] {
  return club.courts.filter((c) => mayPlay(club, c, id)).map((c) => c.id);
}

/** Most restricted courts first, so a scarce court gets its pick of the line. */
export function byRestriction(club: Club, courts: readonly Court[]): Court[] {
  if (modeOf(club) === "open") return [...courts].sort((a, b) => a.id - b.id);
  return [...courts].sort(
    (a, b) => rankOf(b.minLevel) - rankOf(a.minLevel) || a.id - b.id,
  );
}

export const levelLabel = (l: Level | undefined) =>
  LEVELS.find((x) => x.id === l)?.label ?? "Anyone";

/** "Courts 1 and 2", "all courts" — for the organizer's plain-words lists. */
export function courtList(club: Club, ids: readonly number[]): string {
  if (ids.length === club.courts.length) return "all courts";
  if (ids.length === 0) return "no court";
  const names = ids.map(
    (i) => club.courts.find((c) => c.id === i)?.name ?? `Court ${i}`,
  );
  return names.length === 1
    ? names[0]!
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Players here tonight whom nobody has placed, in guided play. */
export function unplaced(club: Club, s: Session): string[] {
  if (modeOf(club) === "open") return [];
  return Object.entries(s.present)
    .filter(([id, p]) => p.leftAt === undefined && !levelFor(club, id).known)
    .map(([id]) => id);
}
