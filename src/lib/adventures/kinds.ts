/**
 * **The kinds of adventure Passport knows how to start.**
 *
 * The database holds `kind` as an open, validated string, so a new kind of
 * adventure is a new entry here and nothing else: no migration, no new
 * membership, invitation or permission code. Everything a kind may vary
 * lives in this declaration, and it is deliberately small.
 *
 * What a kind does NOT get to vary: who may read, who may invite, who may
 * remove, what an invite link reveals. Those are the core's, enforced by
 * Postgres (supabase/migrations/20261021000000_passport_adventures.sql), identical for
 * every kind.
 *
 * Kind-specific facts (a game's puck drop, a conference's flights) belong in
 * a typed extension table keyed by the adventure id — see `extension`.
 */

export type AdventureVisibility = "members" | "hidden";

export interface AdventureKind {
  readonly id: string;
  /** What to call one, on a button or a heading. */
  readonly label: string;
  /** One line, for the person choosing what to start. */
  readonly blurb: string;
  /**
   * Whether somebody joining is listed to the other members by default.
   * A conference of colleagues defaults to unlisted (the conference lane's
   * rule); a night out among friends to listed. The joiner can change it.
   */
  readonly joinVisibility: AdventureVisibility;
  /** The typed extension table this kind writes, if any. */
  readonly extension?: "hockey";
}

export const ADVENTURE_KINDS: readonly AdventureKind[] = [
  {
    id: "hockey-night",
    label: "Hockey Night",
    blurb: "A game, the people going, and where you eat first.",
    joinVisibility: "members",
    extension: "hockey",
  },
  {
    id: "conference",
    label: "Conference",
    blurb: "Colleagues in one city, and what to do between sessions.",
    joinVisibility: "hidden",
  },
  {
    id: "day",
    label: "Go Have A Day",
    blurb: "A day out together: the stops, and who's in.",
    joinVisibility: "members",
  },
  {
    id: "birthday",
    label: "Birthday",
    blurb: "Somebody's day, planned by the people who love them.",
    joinVisibility: "members",
  },
  {
    id: "weekend",
    label: "Weekend Adventure",
    blurb: "Two days, somewhere worth going.",
    joinVisibility: "members",
  },
  {
    id: "trip",
    label: "Longer Trip",
    blurb: "Several days, one plan, a day at a time.",
    joinVisibility: "members",
  },
];

/**
 * The kinds Saved offers when somebody turns what they collected into an
 * adventure: the ones that are about days out, not a game or a conference.
 */
export const PLANNING_KINDS: readonly string[] = ["day", "weekend", "trip"];

/** Same rule as the database's CHECK, so a bad kind fails before Postgres. */
export const KIND_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;

export function adventureKind(id: string): AdventureKind | undefined {
  return ADVENTURE_KINDS.find((kind) => kind.id === id);
}

/**
 * How to name a kind the code no longer (or does not yet) declare.
 *
 * A row written by a newer deployment, or a kind retired from this list,
 * must still render. It is shown as itself rather than refused.
 */
export function kindLabel(id: string): string {
  return adventureKind(id)?.label ?? "Adventure";
}
