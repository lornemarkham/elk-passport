import {
  CHECKS,
  FEATURES,
  KINDS,
  REACTION_IDS,
  REPORTS,
  TOWNS,
  TOWN_AT,
  inArea,
  seasonOf,
  type Authorisation,
  type CheckId,
  type FeatureId,
  type Kind,
  type LightsDoc,
  type Pin,
  type ReactionId,
  type ReportId,
  type TownId,
} from "./model";

/**
 * **What can happen to a pin**, each a pure step from one document to the
 * next. A refusal is said in words (`Refused`) so a route can hand it to the
 * person as it stands.
 */

export class Refused extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const clean = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
};

const MAX_PINS_PER_PERSON_PER_DAY = 10;

export interface Submission {
  readonly kind: Kind;
  readonly name: string;
  readonly description?: string;
  readonly town: TownId;
  readonly at: { lat: number; lng: number };
  readonly address?: string;
  readonly hours?: string;
  readonly features: FeatureId[];
  readonly residential: boolean;
  readonly consentClaim?: Pin["consentClaim"];
  readonly consentUrl?: string;
}

/** Nearest of the five towns, for a pin dropped without one. */
export function nearestTown(at: { lat: number; lng: number }): TownId {
  let best: TownId = "vernon";
  let bestD = Infinity;
  for (const t of TOWNS) {
    const d = (TOWN_AT[t].lat - at.lat) ** 2 + (TOWN_AT[t].lng - at.lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** A submission, read from what a browser sent. */
export function parseSubmission(body: Record<string, unknown>): Submission {
  const kind = KINDS.find((k) => k === body.kind);
  if (!kind) throw new Refused("Say what kind of display it is.");
  const name = clean(body.name, 80);
  if (!name || name.length < 3)
    throw new Refused("Give the display a name — three letters at least.");
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    throw new Refused("Drop the pin on the map first.");
  const at = { lat: round(lat), lng: round(lng) };
  if (!inArea(at))
    throw new Refused(
      "For now the map covers Vernon, Coldstream, Lumby, Armstrong and Kelowna.",
    );
  const town = TOWNS.find((t) => t === body.town) ?? nearestTown(at);
  const said: unknown[] = Array.isArray(body.features) ? body.features : [];
  const features = FEATURES.map((f) => f.id).filter((f) => said.includes(f));
  const residential = kind === "home" || body.residential === true;
  const consentClaim = (
    ["i-live-here", "owner-said-yes", "public-listing"] as const
  ).find((c) => c === body.consentClaim);
  const consentUrl = clean(body.consentUrl, 300);
  if (consentUrl && !/^https:\/\/[^\s]+$/i.test(consentUrl))
    throw new Refused("A public listing link starts with https://.");
  const description = clean(body.description, 500);
  const address = clean(body.address, 120);
  const hours = clean(body.hours, 80);
  return {
    kind,
    name,
    town,
    at,
    features,
    residential,
    ...(description ? { description } : {}),
    ...(address ? { address } : {}),
    ...(hours ? { hours } : {}),
    ...(consentClaim ? { consentClaim } : {}),
    ...(consentUrl ? { consentUrl } : {}),
  };
}

/** Five decimals is about a metre: as precise as a phone, no more. */
const round = (n: number) => Math.round(n * 1e5) / 1e5;

/** Metres between two points, the haversine way. */
export function metres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Pins already on the map within 40 m — probably the same display. */
export function nearDuplicates(
  doc: LightsDoc,
  at: { lat: number; lng: number },
) {
  return doc.pins.filter(
    (p) =>
      p.status !== "declined" &&
      p.status !== "removed" &&
      metres(p.at, at) < 40,
  );
}

export function submit(
  doc: LightsDoc,
  s: Submission,
  by: string,
  id: string,
  now: Date,
  photo?: string,
): { doc: LightsDoc; pin: Pin } {
  const today = now.toISOString().slice(0, 10);
  const mineToday = doc.pins.filter(
    (p) => p.submittedBy === by && p.submittedAt.slice(0, 10) === today,
  ).length;
  if (mineToday >= MAX_PINS_PER_PERSON_PER_DAY)
    throw new Refused(
      "That's a lot of magic for one day — try again tomorrow.",
      429,
    );
  const at = now.toISOString();
  const pin: Pin = {
    id,
    ...s,
    status: "pending",
    confirmed: [],
    dark: [],
    ...(photo ? { photo } : {}),
    submittedBy: by,
    submittedAt: at,
    reactions: [],
    trail: [{ at, by, kind: "submitted", season: seasonOf(now) }],
    updatedAt: at,
  };
  return { doc: { pins: [...doc.pins, pin] }, pin };
}

function edit(doc: LightsDoc, id: string, fn: (p: Pin) => Pin): LightsDoc {
  const pin = doc.pins.find((p) => p.id === id);
  if (!pin) throw new Refused("That pin isn't on the map.", 404);
  const next = fn(pin);
  return { pins: doc.pins.map((p) => (p.id === id ? next : p)) };
}

export function find(doc: LightsDoc, id: string): Pin {
  const pin = doc.pins.find((p) => p.id === id);
  if (!pin) throw new Refused("That pin isn't on the map.", 404);
  return pin;
}

/**
 * **A reviewer publishes a pin.** A home needs the owner's consent or a
 * public listing recorded, here, by the reviewer — the submitter's claim is
 * what they weigh, not the permission itself. Approving confirms it lit for
 * this season.
 */
export function approve(
  doc: LightsDoc,
  id: string,
  reviewer: string,
  now: Date,
  authorisation?: { basis: Authorisation["basis"]; url?: string },
): LightsDoc {
  const at = now.toISOString();
  const season = seasonOf(now);
  return edit(doc, id, (p) => {
    if (p.status === "removed") throw new Refused("That pin was removed.", 409);
    let auth = p.authorisation;
    if (p.residential && !auth) {
      if (!authorisation)
        throw new Refused(
          "A home needs the owner's consent or a public listing before it can be shown.",
        );
      if (
        authorisation.basis === "public-listing" &&
        !authorisation.url?.startsWith("https://")
      )
        throw new Refused("Give the public listing's https:// link.");
      auth = {
        basis: authorisation.basis,
        ...(authorisation.url ? { url: authorisation.url } : {}),
        by: reviewer,
        at,
      };
    }
    return {
      ...p,
      status: "approved",
      ...(auth ? { authorisation: auth } : {}),
      confirmed: p.confirmed.includes(season)
        ? p.confirmed
        : [...p.confirmed, season],
      trail: [...p.trail, { at, by: reviewer, kind: "approved", season }],
      updatedAt: at,
    };
  });
}

export function decline(
  doc: LightsDoc,
  id: string,
  reviewer: string,
  now: Date,
  why?: string,
) {
  const at = now.toISOString();
  return edit(doc, id, (p) => ({
    ...p,
    status: "declined",
    trail: [
      ...p.trail,
      {
        at,
        by: reviewer,
        kind: "declined",
        ...(why ? { text: why.slice(0, 300) } : {}),
      },
    ],
    updatedAt: at,
  }));
}

/** Removed for good — by its submitter, or a reviewer. The photo goes too (the server deletes it). */
export function remove(
  doc: LightsDoc,
  id: string,
  by: string,
  isReviewer: boolean,
  now: Date,
) {
  const at = now.toISOString();
  return edit(doc, id, (p) => {
    if (!isReviewer && p.submittedBy !== by)
      throw new Refused(
        "Only the person who pinned it, or a reviewer, can remove it.",
        403,
      );
    const { photo, address, ...rest } = p;
    void photo;
    void address;
    return {
      ...rest,
      status: "removed",
      trail: [...p.trail, { at, by, kind: "removed" }],
      updatedAt: at,
    };
  });
}

/** A reviewer puts a hidden pin back (after checking a takedown was not the owner's). */
export function restore(
  doc: LightsDoc,
  id: string,
  reviewer: string,
  now: Date,
) {
  const at = now.toISOString();
  return edit(doc, id, (p) => {
    if (p.status !== "hidden")
      throw new Refused("Only a hidden pin can be restored.", 409);
    return {
      ...p,
      status: "approved",
      trail: [...p.trail, { at, by: reviewer, kind: "restored" }],
      updatedAt: at,
    };
  });
}

/**
 * **Something wrong?** Anyone may say, signed in or not. A privacy report on
 * a home hides it at once — wrongly hiding a display costs a family a stop;
 * wrongly showing a home costs its owner their privacy. Everything else waits
 * for a reviewer.
 */
export function report(
  doc: LightsDoc,
  id: string,
  by: string,
  reason: ReportId,
  text: string | undefined,
  now: Date,
) {
  if (!REPORTS.some((r) => r.id === reason))
    throw new Refused("Pick a reason.");
  const at = now.toISOString();
  return edit(doc, id, (p) => {
    if (p.trail.filter((e) => e.kind === "report" && e.by === by).length >= 3)
      throw new Refused("Thanks — we already have your report.", 429);
    const hide =
      reason === "privacy" && p.residential && p.status === "approved";
    const note = `${reason}${text ? `: ${text.slice(0, 300)}` : ""}`;
    return {
      ...p,
      ...(hide ? { status: "hidden" as const } : {}),
      trail: [
        ...p.trail,
        { at, by, kind: "report", text: note },
        ...(hide ? [{ at, by, kind: "hidden" as const }] : []),
      ],
      updatedAt: at,
    };
  });
}

/**
 * **A family says what they saw tonight.** One say per person per pin per
 * day. _Lights are on!_ confirms the season; a reviewer's _Not decorated_
 * counts at once, a family's needs a second family (see `seasonState`).
 */
export function check(
  doc: LightsDoc,
  id: string,
  by: string,
  what: CheckId,
  now: Date,
  text?: string,
) {
  if (!CHECKS.some((c) => c.id === what))
    throw new Refused("Pick what you saw.");
  const at = now.toISOString();
  const day = at.slice(0, 10);
  const season = seasonOf(now);
  return edit(doc, id, (p) => {
    if (p.status !== "approved")
      throw new Refused("That pin isn't published.", 409);
    if (
      p.trail.some(
        (e) => e.by === by && e.kind === what && e.at.slice(0, 10) === day,
      )
    )
      throw new Refused(
        "Got it already — thanks for keeping the map honest!",
        409,
      );
    const confirmed =
      what === "on" && !p.confirmed.includes(season)
        ? [...p.confirmed, season]
        : p.confirmed;
    const dark =
      what === "dark" && !p.dark.includes(season)
        ? [...p.dark, season]
        : p.dark;
    return {
      ...p,
      confirmed,
      dark,
      trail: [
        ...p.trail,
        {
          at,
          by,
          kind: what,
          season,
          ...(text ? { text: text.slice(0, 300) } : {}),
        },
      ],
      updatedAt: at,
    };
  });
}

/**
 * **A reaction, toggled.** Each account may give each of the five once per
 * pin; pressing it again takes it back. Signed in only, so one person cannot
 * be a crowd.
 */
export function react(
  doc: LightsDoc,
  id: string,
  by: string,
  reaction: ReactionId,
  now: Date,
) {
  if (!REACTION_IDS.includes(reaction))
    throw new Refused("That isn't one of the reactions.");
  return edit(doc, id, (p) => {
    if (p.status !== "approved")
      throw new Refused("That pin isn't published.", 409);
    const had = p.reactions.some((r) => r.by === by && r.id === reaction);
    return {
      ...p,
      reactions: had
        ? p.reactions.filter((r) => !(r.by === by && r.id === reaction))
        : [...p.reactions, { by, id: reaction, at: now.toISOString() }],
    };
  });
}
