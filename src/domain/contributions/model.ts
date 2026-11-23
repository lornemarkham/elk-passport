/**
 * **Community contributions, as data** (owner brief "PASSPORT — UNIVERSAL
 * COMMUNITY CONTRIBUTIONS", 2026-11-23, mission 1005).
 *
 * One suggestion queue for every Passport experience. Someone on Go Have a
 * Day, Christmas, Hockey Night, Date Night or Snow Day sees that something is
 * missing — a restaurant, a market, an event, a lights display — and says so
 * in under a minute, with no account. The administrator reviews every
 * suggestion in one place, and an approved one is copied to Atlas by hand
 * for now (automatic ingestion is deliberately not built: the brief's §6).
 *
 * Pure: no Next, no database, no clock it does not take as an argument.
 *
 * ## The rules this file exists to keep
 *
 * 1. **Nothing a contributor says is public.** A suggestion is a note to the
 *    administrator. It is never shown on any map, feed or page; what the
 *    public eventually sees comes through the existing publishing paths
 *    (Atlas, the lights map, the Local Insider Network) after review.
 * 2. **A contributor is a one-way key, never an identity.** No email, no
 *    address, no device token is stored in the clear; nothing about who
 *    suggested what is ever published (`contributorView`).
 * 3. **Experiences add themselves; towns are not a list.** The experience a
 *    suggestion came from is a slug any experience can send (unknown ones are
 *    kept, labelled by their slug), and a location is words plus an optional
 *    coordinate — no hard-coded community list decides what may be suggested.
 */

/** What can be suggested. The brief's list, plus `other`. */
export const CATEGORIES = [
  { id: "place", label: "Place", emoji: "📍" },
  { id: "restaurant", label: "Restaurant or café", emoji: "🍽️" },
  { id: "event", label: "Event", emoji: "🎟️" },
  { id: "market", label: "Market", emoji: "🛍️" },
  { id: "activity", label: "Activity", emoji: "🥾" },
  { id: "attraction", label: "Attraction", emoji: "🎡" },
  { id: "christmas-display", label: "Christmas lights", emoji: "🎄" },
  { id: "entertainment", label: "Live music or show", emoji: "🎶" },
  { id: "other", label: "Something else", emoji: "✨" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];
export const categoryLabel = (id: CategoryId): string =>
  CATEGORIES.find((c) => c.id === id)?.label ?? id;

/**
 * **Where a suggestion came from.** Known experiences have a label; any other
 * slug (`/^[a-z0-9-]{2,32}$/`) is accepted and shown by its slug, so a new
 * experience needs no change here to start collecting suggestions.
 */
export const KNOWN_EXPERIENCES: Record<string, string> = {
  gohaveaday: "Go Have a Day",
  christmas: "Christmas",
  hockey: "Hockey Night",
  datenight: "Date Night",
  snow: "Snow Day",
  "sesh-wars": "Sesh Wars",
  conference: "Conference",
  october: "October",
  badminton: "Badminton",
  local: "Local Insider Network",
};
export const EXPERIENCE_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;
export const experienceLabel = (slug: string): string =>
  KNOWN_EXPERIENCES[slug] ?? slug;

/**
 * ```
 * pending → approved
 *         ↘ declined (reason: duplicate | spam | not-right | other)
 * ```
 * Only `approved` counts toward a contributor's milestones; a duplicate or
 * spam decline never does (`milestones.ts`).
 */
export type Status = "pending" | "approved" | "declined";

export const DECLINE_REASONS = [
  { id: "duplicate", label: "Already have it" },
  { id: "spam", label: "Spam or nonsense" },
  { id: "not-right", label: "Not a fit for Passport" },
  { id: "other", label: "Something else" },
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number]["id"];

export interface Location {
  /** What the person typed: an address, a venue, "across from the arena". */
  readonly text: string;
  /** The remembered town (ADR 020) when the page knew one. */
  readonly town?: string;
  readonly lat?: number;
  readonly lng?: number;
}

export interface TrailEntry {
  readonly at: string;
  /** A contributor key, or a reviewer's email (reviewers only). */
  readonly by: string;
  readonly kind:
    "submitted" | "approved" | "declined" | "edited" | "atlas" | "note";
  readonly text?: string;
}

/** What happened when a suggestion was handed to Atlas as a source to read. */
export interface AtlasHandoff {
  readonly state:
    "queued" | "already-queued" | "not-configured" | "failed" | "no-url";
  readonly at: string;
  readonly detail?: string;
  readonly candidateId?: string;
}

export interface Suggestion {
  readonly id: string;
  readonly experience: string;
  readonly category: CategoryId;
  readonly name: string;
  readonly location: Location;
  readonly description?: string;
  /** Date and time in the contributor's words ("Dec 12, 6–9 pm"). */
  readonly when?: string;
  readonly website?: string;
  /** The id of the photo document beside the queue, when one was sent. */
  readonly photo?: string;
  readonly status: Status;
  readonly declineReason?: DeclineReason;
  /** A suggestion that looks like this one, for the reviewer to compare. */
  readonly duplicateOf?: string;
  /** One-way key; never shown. */
  readonly submittedBy: string;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly trail: readonly TrailEntry[];
  readonly atlas?: AtlasHandoff;
}

export interface SuggestionsDoc {
  readonly suggestions: readonly Suggestion[];
}

export const EMPTY: SuggestionsDoc = { suggestions: [] };

/** What the contributor sees of their own suggestion: never anybody's key or the trail. */
export interface ContributorView {
  readonly id: string;
  readonly name: string;
  readonly category: CategoryId;
  readonly experience: string;
  readonly status: Status;
  readonly submittedAt: string;
}

export function contributorView(s: Suggestion): ContributorView {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    experience: s.experience,
    status: s.status,
    submittedAt: s.submittedAt,
  };
}

/** For the review page: everything but the raw contributor key. */
export interface ReviewView extends Omit<Suggestion, "submittedBy"> {
  /** How many suggestions this contributor has had approved; for the reviewer's judgement, not the public. */
  readonly contributorApproved: number;
  readonly contributorPending: number;
}

export function reviewView(doc: SuggestionsDoc, s: Suggestion): ReviewView {
  const { submittedBy, ...rest } = s;
  const mine = doc.suggestions.filter((x) => x.submittedBy === submittedBy);
  return {
    ...rest,
    // The trail names reviewers (their email, behind the sign-in); the
    // contributor's own key is replaced so it never leaves the server.
    trail: s.trail.map((e) =>
      e.by === submittedBy ? { ...e, by: "contributor" } : e,
    ),
    contributorApproved: mine.filter((x) => x.status === "approved").length,
    contributorPending: mine.filter((x) => x.status === "pending").length,
  };
}

/**
 * **The block the administrator copies for Atlas**: every fact the
 * contributor gave, labelled, plus the provenance line Atlas's curators
 * expect. Plain text so it pastes anywhere; the same facts as JSON beside it
 * for a future automatic reader (brief §6: structure now, ingest later).
 */
export function atlasCopy(s: Suggestion): { text: string; json: string } {
  const lines = [
    `Name: ${s.name}`,
    `Category: ${categoryLabel(s.category)}`,
    `Location: ${s.location.text}${s.location.town ? ` (${s.location.town})` : ""}`,
    ...(s.location.lat !== undefined && s.location.lng !== undefined
      ? [`Coordinates: ${s.location.lat}, ${s.location.lng}`]
      : []),
    ...(s.when ? [`When: ${s.when}`] : []),
    ...(s.website ? [`Website: ${s.website}`] : []),
    ...(s.description ? [`Description: ${s.description}`] : []),
    `Source: community suggestion via Passport ${experienceLabel(s.experience)}, ${s.submittedAt.slice(0, 10)}, suggestion ${s.id}`,
  ];
  const { submittedBy, trail, ...facts } = s;
  void submittedBy;
  void trail;
  return { text: lines.join("\n"), json: JSON.stringify(facts, null, 2) };
}
