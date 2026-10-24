/**
 * **The peanut gallery: at the arena, or watching from the couch.**
 *
 * Not everybody on a night has a ticket. A coworker at home still has a
 * team, still makes picks, still chirps and still competes for the Cup; what
 * they don't need is a meeting point, a seat, a walk or Arena Mode. One
 * answer per person per night (`passport_occasion_members.watching`, from
 * `alive-migration.sql`), set by that person only, changeable any time.
 * Nobody is asked before they can use the night: someone who hasn't said is
 * treated as going, which is what a ticket-holder's night has always been.
 */
export type Watching = "arena" | "couch";

export const WATCHING: readonly Watching[] = ["arena", "couch"];

export function isWatching(value: unknown): value is Watching {
  return value === "arena" || value === "couch";
}

export interface Crowd {
  /** alive-migration.sql is applied: where people watch can be stored. */
  readonly available: boolean;
  /** Member id → where they're watching, for everybody who has said. */
  readonly where: Readonly<Record<string, Watching>>;
}

export const NO_CROWD: Crowd = { available: false, where: {} };

/** How the roster says it. */
export const WATCHING_LABEL: Readonly<Record<Watching, string>> = {
  arena: "At the arena",
  couch: "From the couch",
};

export const WATCHING_EMOJI: Readonly<Record<Watching, string>> = {
  arena: "🏟️",
  couch: "🛋️",
};

/** Everyone on the night, counted by where they'll be. Unsaid counts as going. */
export function crowdCounts(
  memberIds: readonly string[],
  crowd: Crowd,
): { arena: number; couch: number } {
  let couch = 0;
  for (const id of memberIds) if (crowd.where[id] === "couch") couch += 1;
  return { arena: memberIds.length - couch, couch };
}
