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
 * 1. **A home is never shown without permission.** A pin at a private
 *    residence stays private — to its submitter and reviewers — until a
 *    reviewer records the owner's consent or an independent public listing
 *    (`authorisation`). Nothing published can lose that: an approved home
 *    always carries one. A privacy takedown hides a home at once, no review
 *    first.
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
  { id: "free", label: "Free" },
  { id: "stroller", label: "Stroller friendly" },
  { id: "drive-by", label: "See it from the car" },
] as const;
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
    | "report"
    | CheckId;
  readonly text?: string;
  readonly season?: number;
}

export interface Reaction {
  readonly by: string;
  readonly id: ReactionId;
  readonly at: string;
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
  if (pin.dark.includes(season) && (darkVoices >= 2 || reviewerSaidDark))
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

/** Whether the exact location and address may be shown to everybody. */
export function exactVisible(pin: Pin): boolean {
  if (pin.status !== "approved") return false;
  return !pin.residential || !!pin.authorisation;
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
  readonly lastConfirmed?: number;
  readonly hasPhoto: boolean;
  readonly source?: Pin["source"];
  readonly reactions: Record<ReactionId, number>;
  readonly mine: readonly ReactionId[];
  readonly trending: number;
  readonly total: number;
  readonly yours: boolean;
  readonly residential: boolean;
  /** Reviewers only. */
  readonly review?: {
    readonly consentClaim?: Pin["consentClaim"];
    readonly consentUrl?: string;
    readonly authorisation?: Authorisation;
    readonly trail: readonly Event[];
    readonly reports: number;
  };
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
    ...(confirmedYears.length
      ? { lastConfirmed: confirmedYears[confirmedYears.length - 1] }
      : {}),
    hasPhoto: !!pin.photo,
    ...(pin.source ? { source: pin.source } : {}),
    reactions: counts,
    mine,
    trending: pin.reactions.filter((r) => Date.parse(r.at) >= since).length,
    total: pin.reactions.length,
    yours: viewer.key !== null && pin.submittedBy === viewer.key,
    residential: pin.residential,
    ...(viewer.reviewer
      ? {
          review: {
            ...(pin.consentClaim ? { consentClaim: pin.consentClaim } : {}),
            ...(pin.consentUrl ? { consentUrl: pin.consentUrl } : {}),
            ...(pin.authorisation ? { authorisation: pin.authorisation } : {}),
            trail: pin.trail,
            reports: pin.trail.filter((e) => e.kind === "report").length,
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
