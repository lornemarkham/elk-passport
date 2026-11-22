/**
 * **Pin the Magic, as data** — the Christmas lights map's community pins
 * (owner brief "GO HAVE A DAY — PIN THE MAGIC!", 2026-11-10).
 *
 * Someone sees a display, pins it, a person checks it, and other families
 * find it, react to it and put it on their tour. Pure: no Next, no database,
 * no clock it does not take as an argument.
 *
 * ## The two rules this file exists to keep
 *
 * 1. **Nothing is public before the administrator approves it, and a
 *    homeowner's objection takes a listing down at once.** (Owner decision,
 *    2026-11-22, "Christmas Lights Map: community launch" — it replaces the
 *    earlier rule that a home needed its owner's consent or a public listing
 *    recorded first.) Anyone may submit a display; every submission waits in
 *    the administrator's queue; a removal request hides the listing at once,
 *    with no identity check, until the administrator resolves it. Nobody's
 *    identity — submitter's or homeowner's — is ever published.
 * 2. **Last year's lights are not this year's.** Every pin carries the
 *    seasons someone confirmed it in. A pin last confirmed in an earlier
 *    season is shown as _Not yet confirmed this year_ and is never put on a
 *    tour until somebody says the lights are on again (`seasonState`).
 */

export const KINDS = [
  "home",
  "public-display",
  "neighbourhood",
  "community-tree",
  "market",
  "festive-attraction",
] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  home: "Decorated home",
  "public-display": "Public display",
  neighbourhood: "Neighbourhood lights",
  "community-tree": "Community tree",
  market: "Christmas market",
  "festive-attraction": "Festive attraction",
};

/**
 * **What the lights map shows** (Lights Map 2.0, 2026-11-14): light
 * displays. Markets and festive attractions stay in the document (their
 * pins, reactions and history are kept) but are listed beside the map as
 * other Christmas things to do, never drawn on it or put on a lights tour.
 */
export const LIGHT_KINDS = [
  "home",
  "public-display",
  "neighbourhood",
  "community-tree",
] as const satisfies readonly Kind[];

export const isLightDisplay = (kind: Kind): boolean =>
  (LIGHT_KINDS as readonly Kind[]).includes(kind);

export const KIND_EMOJI: Record<Kind, string> = {
  home: "🏠",
  "public-display": "✨",
  neighbourhood: "🏘️",
  "community-tree": "🎄",
  market: "🛍️",
  "festive-attraction": "🎠",
};

/** The towns the map starts with (the brief's five). Ids are Discovery's. */
export const TOWNS = [
  "vernon",
  "coldstream",
  "lumby",
  "armstrong",
  "kelowna",
] as const;
export type TownId = (typeof TOWNS)[number];

export const TOWN_LABEL: Record<TownId, string> = {
  vernon: "Vernon",
  coldstream: "Coldstream",
  lumby: "Lumby",
  armstrong: "Armstrong",
  kelowna: "Kelowna",
};

/** Town centres, Discovery's own (`domain/environment/places.ts`). */
export const TOWN_AT: Record<TownId, LatLng> = {
  vernon: { lat: 50.267, lng: -119.272 },
  coldstream: { lat: 50.22, lng: -119.248 },
  lumby: { lat: 50.25, lng: -118.967 },
  armstrong: { lat: 50.4483, lng: -119.196 },
  kelowna: { lat: 49.8801, lng: -119.4436 },
};

/** The box the map accepts pins in: the five towns, with room around them. */
export const AREA = { south: 49.7, north: 50.6, west: -119.75, east: -118.8 };

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export function inArea(at: LatLng): boolean {
  return (
    at.lat >= AREA.south &&
    at.lat <= AREA.north &&
    at.lng >= AREA.west &&
    at.lng <= AREA.east
  );
}

/** The five reactions — the brief's own, in its order. No stars. */
export const REACTIONS = [
  { id: "magical", emoji: "🎄", label: "MAGICAL!" },
  { id: "wow", emoji: "✨", label: "WOW!" },
  { id: "santa", emoji: "🎅", label: "SANTA APPROVED!" },
  { id: "unbelievable", emoji: "🤯", label: "UNBELIEVABLE!" },
  { id: "family", emoji: "❤️", label: "FAMILY FAVOURITE!" },
] as const;
export type ReactionId = (typeof REACTIONS)[number]["id"];
export const REACTION_IDS = REACTIONS.map((r) => r.id) as ReactionId[];

/** What a family can say they saw, this season. */
export const CHECKS = [
  { id: "on", label: "Lights are on!" },
  { id: "dark", label: "Not decorated this year" },
  { id: "moved", label: "Incorrect location" },
  { id: "updated", label: "Display updated" },
] as const;
export type CheckId = (typeof CHECKS)[number]["id"];

/** "Something wrong?" reasons. `privacy` is the owner's takedown. */
export const REPORTS = [
  { id: "privacy", label: "This is my home — please take it down" },
  { id: "unsafe", label: "Unsafe or causes trouble for neighbours" },
  { id: "wrong", label: "Wrong place or not a display" },
  { id: "other", label: "Something else" },
] as const;
export type ReportId = (typeof REPORTS)[number]["id"];

/** Small, optional facts a family plans around. Said by people, never inferred. */
export const FEATURES = [
  { id: "music", label: "Music" },
  { id: "walk", label: "Good to walk" },
  { id: "walk-through", label: "Walk-through" },
  { id: "family", label: "Family-friendly" },
  { id: "free", label: "Free" },
  { id: "stroller", label: "Stroller friendly" },
  { id: "drive-by", label: "See it from the car" },
] as const;

/**
 * **"How magical was it?"** — the owner's 1–5 stars (Lights Map 2.0). A
 * community rating about a display, like the reactions: one per account per
 * display per season, changeable, never a taste signal about the person
 * (§15.3 stays open for Passport).
 */
export const RATING_TAGS = [
  { id: "amazing", label: "Amazing lights" },
  { id: "kids", label: "Great for kids" },
  { id: "creative", label: "Creative" },
  { id: "music", label: "Music" },
  { id: "worth-drive", label: "Worth the drive" },
] as const;
export type RatingTagId = (typeof RATING_TAGS)[number]["id"];

export interface Rating {
  readonly by: string;
  /** 1–5. */
  readonly stars: number;
  readonly tags: readonly RatingTagId[];
  readonly at: string;
  readonly season: number;
}
export type FeatureId = (typeof FEATURES)[number]["id"];

/**
 * ```
 * pending → approved → removed
 *         ↘ declined
 * approved → hidden (privacy takedown, until a reviewer looks)
 * ```
 */
export type Status = "pending" | "approved" | "declined" | "hidden" | "removed";

/** Why a home may be shown: its owner said yes, or it is publicly listed. */
export interface Authorisation {
  readonly basis: "owner-consent" | "public-listing";
  /** For a public listing: the page that lists it. */
  readonly url?: string;
  /** Reviewer who recorded it. */
  readonly by: string;
  readonly at: string;
}

export interface Event {
  /** Reviewer-only: how a removal requester may be reached, if they said. */
  readonly contact?: string;
  readonly at: string;
  /** A viewer key (never an email) or a reviewer's email. */
  readonly by: string;
  readonly kind:
    | "submitted"
    | "approved"
    | "declined"
    | "hidden"
    | "removed"
    | "restored"
    | "edited"
    | "details"
    | "report"
    | "removal-request"
    | "proposed"
    | "change-approved"
    | "change-declined"
    | CheckId;
  readonly text?: string;
  readonly season?: number;
}

export interface Reaction {
  readonly by: string;
  readonly id: ReactionId;
  readonly at: string;
}

/**
 * **A submitter's change to a published display, waiting for a reviewer.** It
 * sits beside the pin and never on it: the public keeps seeing the last
 * approved words until the administrator approves. Only the fields that
 * differ from what is published are present; an empty hours or description
 * means "clear it".
 */
export interface ProposedChange {
  readonly at: string;
  readonly name?: string;
  readonly description?: string;
  readonly hours?: string;
  readonly features?: readonly FeatureId[];
}

export interface Pin {
  readonly id: string;
  readonly kind: Kind;
  readonly name: string;
  readonly description?: string;
  readonly town: TownId;
  readonly at: LatLng;
  /** A street address or venue, as submitted. Shown only when `exactVisible`. */
  readonly address?: string;
  /** Suggested viewing hours, in words ("Dusk to 10 pm"). */
  readonly hours?: string;
  /**
   * The days it is on, when a source states them (`YYYY-MM-DD`, local). A
   * one-night light-up is only toured on its night.
   */
  readonly dates?: {
    readonly from: string;
    readonly to: string;
    /** Only these days between `from` and `to` ("Saturdays Nov 21 & 28"). */
    readonly only?: readonly string[];
  };
  readonly features: readonly FeatureId[];
  /** Whether the submitter said it is a private home. Kind `home` always is. */
  readonly residential: boolean;
  /** What the submitter said about permission, for the reviewer to weigh. */
  readonly consentClaim?: "i-live-here" | "owner-said-yes" | "public-listing";
  readonly consentUrl?: string;
  readonly authorisation?: Authorisation;
  readonly status: Status;
  /** Seasons someone confirmed it lit in (a season is named by its December). */
  readonly confirmed: readonly number[];
  /** Seasons it was reported dark. */
  readonly dark: readonly number[];
  /** Photo document id, when one was sent. */
  readonly photo?: string;
  /** Where a researched pin came from; absent for a family's pin. */
  readonly source?: {
    readonly url: string;
    readonly read: string;
    readonly says: string;
  };
  readonly submittedBy: string;
  readonly submittedAt: string;
  readonly reactions: readonly Reaction[];
  /** Absent on pins written before ratings existed. */
  readonly ratings?: readonly Rating[];
  /** A submitter's edit to a published display, waiting for a reviewer. */
  readonly proposal?: ProposedChange;
  readonly trail: readonly Event[];
  readonly updatedAt: string;
}

export interface LightsDoc {
  readonly pins: readonly Pin[];
}

export const EMPTY: LightsDoc = { pins: [] };

// ---------------------------------------------------------------------------
// Seasons

/** The Christmas season a moment belongs to: Aug–Dec its year, Jan–Jul the last. */
export function seasonOf(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 7 ? y : y - 1;
}

export type SeasonState = "lit" | "unconfirmed" | "dark";

export const SEASON_LABEL: Record<SeasonState, string> = {
  lit: "Confirmed this season",
  unconfirmed: "Not yet confirmed this year",
  dark: "Reported not decorated this year",
};

/**
 * **Is it lit this season?** Confirmed this season (by a reviewer approving it
 * now, or a family saying _Lights are on!_) is `lit`; two or more families
 * saying _Not decorated_ since the last confirmation is `dark`; anything only
 * confirmed in an earlier season is `unconfirmed`.
 */
export function seasonState(pin: Pin, now: Date): SeasonState {
  const season = seasonOf(now);
  const lastOn = lastAt(pin, "on", season);
  const lastApproved = lastAt(pin, "approved", season);
  const confirmedAt = [lastOn, lastApproved].filter(Boolean).sort().pop();
  const darkSince = pin.trail.filter(
    (e) =>
      e.kind === "dark" &&
      e.season === season &&
      (!confirmedAt || e.at > confirmedAt),
  );
  const darkVoices = new Set(darkSince.map((e) => e.by)).size;
  const reviewerSaidDark = darkSince.some((e) => e.by.includes("@"));
  // A homeowner who pinned their own lights is believed at once about them.
  const ownerSaidDark =
    pin.consentClaim === "i-live-here" &&
    darkSince.some((e) => e.by === pin.submittedBy);
  if (
    pin.dark.includes(season) &&
    (darkVoices >= 2 || reviewerSaidDark || ownerSaidDark)
  )
    return "dark";
  return pin.confirmed.includes(season) ? "lit" : "unconfirmed";
}

function lastAt(pin: Pin, kind: Event["kind"], season: number) {
  return pin.trail
    .filter((e) => e.kind === kind && (e.season ?? seasonOf(e.at)) === season)
    .map((e) => e.at)
    .sort()
    .pop();
}

/** The calendar day in the Okanagan (Pacific time) for a moment. */
export function localDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Within its stated days, or has none. */
export function onThatDay(pin: Pick<Pin, "dates">, day: string): boolean {
  const d = pin.dates;
  if (!d) return true;
  if (d.only) return d.only.includes(day);
  return day >= d.from && day <= d.to;
}

function running(d: NonNullable<Pin["dates"]>, day: string) {
  if (day < d.from) return "soon" as const;
  if (day > d.to) return "over" as const;
  return "on" as const;
}

/** May go on a tour on `day` (default: today): published, lit this season, on that day. */
export function tourable(pin: Pin, now: Date, day = localDay(now)): boolean {
  return (
    pin.status === "approved" &&
    seasonState(pin, now) === "lit" &&
    onThatDay(pin, day)
  );
}

// ---------------------------------------------------------------------------
// Privacy

/** Whether the exact location and address may be shown to everybody: only once approved. */
export function exactVisible(pin: Pin): boolean {
  return pin.status === "approved";
}

/** May this viewer see the pin at all? */
export function canSee(pin: Pin, viewer: Viewer): boolean {
  if (viewer.reviewer) return pin.status !== "removed";
  if (pin.status === "approved") return exactVisible(pin);
  return viewer.key !== null && pin.submittedBy === viewer.key;
}

export interface Viewer {
  /** Stable, non-reversible key for a signed-in account, or null. */
  readonly key: string | null;
  readonly reviewer: boolean;
}

/** A pin as a browser may see it: counts, never who; no trail for the public. */
export interface PinView {
  readonly id: string;
  readonly kind: Kind;
  readonly name: string;
  readonly description?: string;
  readonly town: TownId;
  readonly at: LatLng;
  readonly address?: string;
  readonly hours?: string;
  readonly dates?: Pin["dates"];
  readonly features: readonly FeatureId[];
  readonly status: Status;
  readonly season: SeasonState;
  /** Against its stated days, today: not started, on, or finished. */
  readonly running?: "soon" | "on" | "over";
  readonly lastConfirmed?: number;
  readonly hasPhoto: boolean;
  readonly source?: Pin["source"];
  readonly reactions: Record<ReactionId, number>;
  readonly mine: readonly ReactionId[];
  readonly trending: number;
  readonly total: number;
  /** Community rating, every season kept: mean of the stars people gave, and how many. */
  readonly rating: { readonly mean: number; readonly count: number } | null;
  /** This viewer's own rating this season, if any. */
  readonly myRating?: {
    readonly stars: number;
    readonly tags: readonly RatingTagId[];
  };
  /** Tags people gave, most said first, with counts. */
  readonly tags: readonly { readonly id: RatingTagId; readonly n: number }[];
  readonly yours: boolean;
  /** Yours, and you said they're your own lights: the yearly question is yours to answer. */
  readonly ownLights?: boolean;
  /** Yours or a reviewer's: your edit waiting for review. The public never sees it. */
  readonly proposed?: ProposedChange;
  /** Yours or a reviewer's: the Pacific day it was pinned, to tell same-named displays apart. */
  readonly pinnedOn?: string;
  readonly residential: boolean;
  /** Reviewers only. */
  readonly review?: {
    readonly consentClaim?: Pin["consentClaim"];
    readonly consentUrl?: string;
    readonly authorisation?: Authorisation;
    readonly trail: readonly Event[];
    readonly reports: number;
    /** A homeowner (or anyone) asked for this to come down and it has not been resolved. */
    readonly removalOpen: boolean;
    readonly submittedAt: string;
    readonly hasPhoto: boolean;
  };
}

/** A removal request is open until a reviewer restores or removes the listing. */
export function removalOpen(pin: Pick<Pin, "trail" | "status">): boolean {
  if (pin.status === "removed") return false;
  let open = false;
  for (const e of pin.trail) {
    if (e.kind === "removal-request") open = true;
    else if (e.kind === "restored" || e.kind === "approved") open = false;
  }
  return open;
}

const WEEK = 7 * 86_400_000;

export function viewOf(pin: Pin, viewer: Viewer, now: Date): PinView {
  const counts = Object.fromEntries(REACTION_IDS.map((r) => [r, 0])) as Record<
    ReactionId,
    number
  >;
  for (const r of pin.reactions) counts[r.id] += 1;
  const since = now.getTime() - WEEK;
  const mine = viewer.key
    ? pin.reactions.filter((r) => r.by === viewer.key).map((r) => r.id)
    : [];
  const confirmedYears = [...pin.confirmed].sort((a, b) => a - b);
  const ratings = pin.ratings ?? [];
  const season = seasonOf(now);
  const mineRated = viewer.key
    ? ratings.find((r) => r.by === viewer.key && r.season === season)
    : undefined;
  const tagCounts = new Map<RatingTagId, number>();
  for (const r of ratings)
    for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const yours = viewer.key !== null && pin.submittedBy === viewer.key;
  return {
    id: pin.id,
    kind: pin.kind,
    name: pin.name,
    ...(pin.description ? { description: pin.description } : {}),
    town: pin.town,
    at: pin.at,
    ...(pin.address ? { address: pin.address } : {}),
    ...(pin.hours ? { hours: pin.hours } : {}),
    ...(pin.dates ? { dates: pin.dates } : {}),
    features: pin.features,
    status: pin.status,
    season: seasonState(pin, now),
    ...(pin.dates ? { running: running(pin.dates, localDay(now)) } : {}),
    ...(confirmedYears.length
      ? { lastConfirmed: confirmedYears[confirmedYears.length - 1] }
      : {}),
    hasPhoto: !!pin.photo,
    ...(pin.source ? { source: pin.source } : {}),
    reactions: counts,
    mine,
    trending: pin.reactions.filter((r) => Date.parse(r.at) >= since).length,
    total: pin.reactions.length,
    rating: ratings.length
      ? {
          mean:
            Math.round(
              (ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) * 10,
            ) / 10,
          count: ratings.length,
        }
      : null,
    ...(mineRated
      ? { myRating: { stars: mineRated.stars, tags: mineRated.tags } }
      : {}),
    tags: [...tagCounts]
      .map(([id, n]) => ({ id, n }))
      .sort((a, b) => b.n - a.n),
    yours,
    ...(yours && pin.consentClaim === "i-live-here" ? { ownLights: true } : {}),
    ...(pin.proposal && (yours || viewer.reviewer)
      ? { proposed: pin.proposal }
      : {}),
    ...(yours || viewer.reviewer
      ? { pinnedOn: localDay(new Date(pin.submittedAt)) }
      : {}),
    residential: pin.residential,
    ...(viewer.reviewer
      ? {
          review: {
            ...(pin.consentClaim ? { consentClaim: pin.consentClaim } : {}),
            ...(pin.consentUrl ? { consentUrl: pin.consentUrl } : {}),
            ...(pin.authorisation ? { authorisation: pin.authorisation } : {}),
            trail: pin.trail,
            reports: pin.trail.filter((e) => e.kind === "report").length,
            removalOpen: removalOpen(pin),
            submittedAt: pin.submittedAt,
            hasPhoto: !!pin.photo,
          },
        }
      : {}),
  };
}

/** Every pin this viewer may see, as they may see it. */
export function visible(doc: LightsDoc, viewer: Viewer, now: Date): PinView[] {
  return doc.pins
    .filter((p) => canSee(p, viewer))
    .map((p) => viewOf(p, viewer, now));
}

/** Community favourites and this week's trending, among published pins. */
export function favourites(views: readonly PinView[], n = 6) {
  const live = views.filter((v) => v.status === "approved");
  return {
    favourites: [...live]
      .filter((v) => v.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, n),
    trending: [...live]
      .filter((v) => v.trending > 0)
      .sort((a, b) => b.trending - a.trending || b.total - a.total)
      .slice(0, n),
  };
}

/** Where a pin's photo is served, when it has one. */
export const photoSrc = (pin: Pick<PinView, "id" | "hasPhoto">) =>
  pin.hasPhoto ? `/christmas/api/lights/${pin.id}/photo` : null;
