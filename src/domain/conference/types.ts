/**
 * **The conference foundation's nouns.**
 *
 * A conference is a private place for a group that is about to be somewhere
 * together. It holds what the organiser says about it, who is in it, and how
 * people get in. It does not hold flights, posts, schedules or plans: those
 * belong to the modules (`modules.ts`), which key their own data on
 * `(conferenceId, memberId)` and are told when to forget it.
 *
 * Nothing here knows the word "Sycle". Sycle Vancouver 2026 is one record of
 * this shape (`fixtures.ts`); a wedding is another.
 *
 * See docs/products/go-have-a-conference/ARCHITECTURE.md.
 */

/**
 * Who someone is, to the server. A signed-in Passport user, or a guest whose
 * identity is a signed cookie. **Never sent to a browser** — that is what
 * `Membership.memberId` is for.
 */
export type IdentityKey = `user:${string}` | `guest:${string}`;

/** What sort of gathering. Changes words, never logic. */
export const CONFERENCE_KINDS = [
  "conference",
  "retreat",
  "wedding",
  "reunion",
  "festival",
  "trip",
] as const;
export type ConferenceKind = (typeof CONFERENCE_KINDS)[number];

export const MODULE_IDS = [
  "discover",
  "arrivals",
  "schedule",
  "community",
  "plans",
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/**
 * Two roles, and no more. A third is a product decision nobody has made, and
 * the moment roles are configurable this is an RBAC system rather than a
 * gathering.
 */
export type ConferenceRole = "organiser" | "member";

/**
 * Whether other members can see you.
 *
 * `hidden` (the default): you are in, and nobody but organisers knows.
 * `members`: other members see the name you chose.
 */
export type Visibility = "hidden" | "members";

export interface ConferencePlace {
  /** How the organiser names it: "Vancouver", "Whistler, BC". */
  readonly label: string;
  /**
   * A `DiscoveryTown` id when the place is one Passport knows, so Discovery
   * and Go Have A Day can start from it. Absent is honest: no doors are built
   * from a place Passport cannot locate.
   */
  readonly townId?: string;
}

export interface ConferenceBranding {
  /** `#rrggbb`. Validated, because it is written into a style attribute. */
  readonly accent: string;
}

/** Everything an organiser edits. */
export interface ConferenceDetails {
  readonly name: string;
  readonly kind: ConferenceKind;
  readonly tagline?: string;
  readonly welcome?: string;
  readonly place: ConferencePlace;
  /** IANA zone the dates are in, e.g. `America/Vancouver`. */
  readonly timeZone: string;
  /** `YYYY-MM-DD`, in `timeZone`. */
  readonly startsOn: string;
  /** `YYYY-MM-DD`. Absent until the organiser knows it. */
  readonly endsOn?: string;
  readonly branding: ConferenceBranding;
  /** Which modules members see, in this order. */
  readonly modules: readonly ModuleId[];
}

export interface Conference {
  /** Random and unguessable. There are no slugs: a slug is a guessable name. */
  readonly id: string;
  readonly details: ConferenceDetails;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** The current access code, or `null` when codes are off (the default). */
  readonly accessCode: string | null;
  /**
   * When everything about this conference is erased: `endsOn` (or `startsOn`)
   * plus the retention window, recomputed whenever the dates change.
   */
  readonly retainUntil: string;
}

export interface Membership {
  readonly conferenceId: string;
  readonly identity: IdentityKey;
  /**
   * Random handle for this person in this conference. The only id a browser
   * or a module ever sees.
   */
  readonly memberId: string;
  readonly role: ConferenceRole;
  /** The name they chose to give this conference, or `null`. */
  readonly displayName: string | null;
  readonly visibility: Visibility;
  readonly joinedAt: string;
  readonly via: "created" | "code" | "link";
}

/** A shareable link. The token is the credential. */
export interface Invite {
  readonly token: string;
  readonly conferenceId: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  /** `null` for unlimited. */
  readonly maxUses: number | null;
  readonly uses: number;
}
