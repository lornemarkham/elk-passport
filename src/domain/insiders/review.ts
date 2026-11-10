import type { Draft } from "./extract";
import {
  blockers,
  canonicalInterest,
  duplicatesOf,
  publishesDirectly,
  KINDS,
  type Ambassador,
  type Confidence,
  type Kind,
  type Listing,
  type Network,
  type Note,
  type SubmitterRole,
  type Verification,
} from "./model";

/**
 * **Every change to the network, as a pure function** of the network, the
 * person and the clock. The service (`src/lib/insiders/service.ts`) wraps
 * these in a compare-and-swap write; tests call them directly.
 */

export interface Actor {
  readonly role: SubmitterRole;
  /** Email for accounts; "visitor" plus a contact when one was given. */
  readonly who: string;
  readonly ambassador?: Ambassador;
}

export class Refused extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const clean = (s: unknown, max: number) =>
  typeof s === "string" ? s.trim().replace(/\s+/g, " ").slice(0, max) : "";

const cleanBlock = (s: unknown, max: number) =>
  typeof s === "string" ? s.trim().slice(0, max) : "";

function cleanUrl(raw: unknown): string | undefined {
  const s = clean(raw, 500);
  if (!s) return undefined;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    if (!u.hostname.includes(".")) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)?)?$/;
const cleanDate = (raw: unknown) => {
  const s = clean(raw, 40);
  return ISO.test(s) &&
    !Number.isNaN(Date.parse(s.length === 10 ? `${s}T12:00:00Z` : s))
    ? s
    : undefined;
};

/** What a form or API sends: a draft plus what only a person can add. */
export interface SubmissionInput extends Partial<Draft> {
  readonly provenance?: string;
  /** How a visitor can be reached about it, if they want to be. Never shown. */
  readonly contact?: string;
  readonly access?: Listing["access"];
  readonly latitude?: number;
  readonly longitude?: number;
}

export function idFor(title: string, at: string, salt: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "listing"}-${(Date.parse(at) % 1e6).toString(36)}${salt}`;
}

const note = (
  at: string,
  by: string,
  kind: Note["kind"],
  text?: string,
): Note => ({
  at,
  by,
  kind,
  ...(text ? { text: text.slice(0, 1000) } : {}),
});

function numberIn(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi
    ? n
    : undefined;
}

/** A submission, cleaned into a listing. Throws `Refused` when it can't be one. */
export function listingFrom(
  input: SubmissionInput,
  actor: Actor,
  now: Date,
  salt: string,
): Listing {
  const at = now.toISOString();
  const title = clean(input.title, 120);
  const description = cleanBlock(input.description, 2000);
  if (!title && !description)
    throw new Refused("Tell us what it is — a name or a few words.");
  const kind: Kind = (KINDS as readonly string[]).includes(input.kind ?? "")
    ? (input.kind as Kind)
    : "experience";
  const town = clean(input.town, 80);
  const starts = cleanDate(input.starts);
  const ends = cleanDate(input.ends);
  const organizerUrl = cleanUrl(input.organizerUrl);
  const registrationUrl = cleanUrl(input.registrationUrl);
  const interests = [
    ...new Set(
      (input.interests ?? [])
        .map((i) => canonicalInterest(clean(i, 40)))
        .filter(Boolean),
    ),
  ].slice(0, 8);
  const latitude = numberIn(input.latitude, 45, 60);
  const longitude = numberIn(input.longitude, -140, -110);
  const organizer = clean(input.organizer, 120);
  const schedule = clean(input.schedule, 160);
  const venue = clean(input.venue, 120);
  const contact = clean(input.contact, 160);
  const verification: Verification =
    actor.role === "organizer" ? "organizer-confirmed" : "community-reported";
  const confidence: Confidence = actor.role === "visitor" ? "low" : "medium";
  return {
    id: idFor(title || description.slice(0, 40), at, salt),
    kind,
    title: title || description.split(/[.!?\n]/)[0]!.slice(0, 90),
    description,
    place: {
      town,
      ...(venue ? { name: venue } : {}),
      ...(latitude !== undefined && longitude !== undefined
        ? { latitude, longitude }
        : {}),
    },
    interests,
    ...(organizer ? { organizer } : {}),
    ...(organizerUrl ? { organizerUrl } : {}),
    provenance:
      clean(input.provenance, 300) ||
      (actor.role === "visitor"
        ? "Sent in by a visitor"
        : `Sent in by ${actor.ambassador?.name ?? actor.who}`),
    ...(starts
      ? { dates: { starts, ...(ends && ends >= starts ? { ends } : {}) } }
      : {}),
    ...(schedule ? { schedule } : {}),
    ...(registrationUrl ? { registration: { url: registrationUrl } } : {}),
    access:
      input.access === "members" || input.access === "ask-first"
        ? input.access
        : "public",
    status: "submitted",
    verification,
    confidence,
    discoveredAt: at,
    submittedBy: { role: actor.role, who: actor.who },
    notes: [
      note(
        at,
        actor.who,
        "submitted",
        contact ? `Contact: ${contact}` : undefined,
      ),
    ],
    updatedAt: at,
  };
}

function replace(network: Network, listing: Listing): Network {
  return {
    ...network,
    listings: network.listings.map((l) => (l.id === listing.id ? listing : l)),
  };
}

function find(network: Network, id: string): Listing {
  const listing = network.listings.find((l) => l.id === id);
  if (!listing) throw new Refused("No such listing.", 404);
  return listing;
}

/**
 * **Send something in.** A duplicate of a listing already in the network is
 * not a second listing: what was sent is added to the existing one's trail
 * as a correction for a reviewer to read. A trusted ambassador's listing
 * that passes every check is published straight away; everyone else's waits
 * for review.
 */
export function submit(
  network: Network,
  input: SubmissionInput,
  actor: Actor,
  now: Date,
  salt: string,
): {
  network: Network;
  listing: Listing;
  duplicateOf?: string;
  published: boolean;
} {
  const listing = listingFrom(input, actor, now, salt);
  const dup = duplicatesOf(listing, network.listings)[0];
  if (dup) {
    const merged: Listing = {
      ...dup,
      notes: [
        ...dup.notes,
        note(
          now.toISOString(),
          actor.who,
          "correction",
          `Sent in again: ${listing.title}. ${listing.description}`.slice(
            0,
            1000,
          ),
        ),
      ],
      updatedAt: now.toISOString(),
    };
    return {
      network: replace(network, merged),
      listing: merged,
      duplicateOf: dup.id,
      published: false,
    };
  }
  const direct =
    publishesDirectly(actor.role, actor.ambassador) &&
    blockers(listing).length === 0;
  const stored: Listing = direct
    ? {
        ...listing,
        status: "published",
        notes: [
          ...listing.notes,
          note(
            now.toISOString(),
            actor.who,
            "published",
            "Trusted ambassador: published on submission.",
          ),
        ],
      }
    : listing;
  return {
    network: { ...network, listings: [...network.listings, stored] },
    listing: stored,
    published: direct,
  };
}

/** What an editor may change. Dates and links lose their check when they change. */
export interface Edit {
  readonly title?: string;
  readonly description?: string;
  readonly kind?: Kind;
  readonly town?: string;
  readonly venue?: string;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly interests?: readonly string[];
  readonly organizer?: string;
  readonly organizerUrl?: string;
  readonly provenance?: string;
  readonly starts?: string | null;
  readonly ends?: string | null;
  readonly dateSource?: string;
  /** A person says they checked the date against `dateSource` just now. */
  readonly dateChecked?: boolean;
  readonly schedule?: string;
  readonly registrationUrl?: string | null;
  readonly registrationChecked?: boolean;
  readonly access?: Listing["access"];
  readonly permissionBy?: string;
  readonly verification?: Verification;
  readonly confidence?: Confidence;
  readonly atlasEntityId?: string | null;
  /** A past edition to keep, ISO date, with its source. */
  readonly addHistory?: { readonly starts: string; readonly source?: string };
}

/** Ambassadors edit their own listings; admins edit any. */
export function canEdit(listing: Listing, actor: Actor): boolean {
  if (actor.role === "admin") return true;
  return (
    actor.role === "ambassador" &&
    listing.submittedBy.who.toLowerCase() === actor.who.toLowerCase()
  );
}

export function edit(
  network: Network,
  id: string,
  change: Edit,
  actor: Actor,
  now: Date,
) {
  const listing = find(network, id);
  if (!canEdit(listing, actor))
    throw new Refused("You can suggest a correction to this one instead.", 403);
  const at = now.toISOString();
  const has = (k: keyof Edit) =>
    Object.prototype.hasOwnProperty.call(change, k);
  let dates = listing.dates;
  if (has("starts")) {
    const starts =
      change.starts === null ? undefined : cleanDate(change.starts);
    if (change.starts && !starts)
      throw new Refused("Dates are written YYYY-MM-DD.");
    dates = !starts
      ? undefined
      : listing.dates && starts === listing.dates.starts
        ? listing.dates
        : { starts };
  }
  if (dates && has("ends")) {
    const ends = change.ends === null ? undefined : cleanDate(change.ends);
    const { ends: _old, ...rest } = dates;
    void _old;
    dates = ends && ends >= dates.starts ? { ...rest, ends } : rest;
    if (ends !== listing.dates?.ends) {
      const { verifiedAt: _v, ...unchecked } = dates;
      void _v;
      dates = unchecked;
    }
  }
  if (dates && has("dateSource")) {
    const source = cleanUrl(change.dateSource);
    if (source !== dates.source) {
      const { verifiedAt: _v, source: _s, ...rest } = dates;
      void _v;
      void _s;
      dates = source ? { ...rest, source } : rest;
    }
  }
  if (dates && change.dateChecked) {
    if (!dates.source)
      throw new Refused(
        "Add the page that states the date before marking it checked.",
      );
    dates = { ...dates, verifiedAt: at };
  }
  let registration = listing.registration;
  if (has("registrationUrl")) {
    const url =
      change.registrationUrl === null
        ? undefined
        : cleanUrl(change.registrationUrl);
    registration = url
      ? url === listing.registration?.url
        ? listing.registration
        : { url }
      : undefined;
  }
  if (registration && change.registrationChecked)
    registration = { ...registration, verifiedAt: at };
  const latitude = has("latitude")
    ? numberIn(change.latitude, 45, 60)
    : listing.place.latitude;
  const longitude = has("longitude")
    ? numberIn(change.longitude, -140, -110)
    : listing.place.longitude;
  const venue = has("venue") ? clean(change.venue, 120) : listing.place.name;
  const organizer = has("organizer")
    ? clean(change.organizer, 120)
    : listing.organizer;
  const organizerUrl = has("organizerUrl")
    ? cleanUrl(change.organizerUrl)
    : listing.organizerUrl;
  const schedule = has("schedule")
    ? clean(change.schedule, 160)
    : listing.schedule;
  const access = change.access ?? listing.access;
  const permission =
    change.permissionBy && actor.role === "admin"
      ? { by: clean(change.permissionBy, 160), at }
      : listing.permission;
  const atlasEntityId = has("atlasEntityId")
    ? clean(change.atlasEntityId, 64) || undefined
    : listing.atlasEntityId;
  const history =
    change.addHistory && cleanDate(change.addHistory.starts)
      ? [
          ...(listing.history ?? []),
          {
            starts: cleanDate(change.addHistory.starts)!,
            ...(cleanUrl(change.addHistory.source)
              ? { source: cleanUrl(change.addHistory.source)! }
              : {}),
          },
        ]
      : listing.history;
  const checked = change.dateChecked || change.registrationChecked;
  const next: Listing = {
    id: listing.id,
    kind:
      change.kind && (KINDS as readonly string[]).includes(change.kind)
        ? change.kind
        : listing.kind,
    title: has("title")
      ? clean(change.title, 120) || listing.title
      : listing.title,
    description: has("description")
      ? cleanBlock(change.description, 2000)
      : listing.description,
    place: {
      town: has("town") ? clean(change.town, 80) : listing.place.town,
      ...(venue ? { name: venue } : {}),
      ...(latitude !== undefined && longitude !== undefined
        ? { latitude, longitude }
        : {}),
    },
    interests: change.interests
      ? [
          ...new Set(
            change.interests
              .map((i) => canonicalInterest(clean(i, 40)))
              .filter(Boolean),
          ),
        ].slice(0, 8)
      : listing.interests,
    ...(organizer ? { organizer } : {}),
    ...(organizerUrl ? { organizerUrl } : {}),
    provenance: has("provenance")
      ? clean(change.provenance, 300)
      : listing.provenance,
    ...(dates ? { dates } : {}),
    ...(schedule ? { schedule } : {}),
    ...(history?.length ? { history } : {}),
    ...(registration ? { registration } : {}),
    access: access === "members" || access === "ask-first" ? access : "public",
    ...(permission ? { permission } : {}),
    status: listing.status,
    verification: change.verification ?? listing.verification,
    confidence: change.confidence ?? listing.confidence,
    ...(checked ||
    (change.verification !== listing.verification &&
      (change.verification === "source-checked" ||
        change.verification === "organizer-confirmed"))
      ? { lastVerifiedAt: at }
      : listing.lastVerifiedAt
        ? { lastVerifiedAt: listing.lastVerifiedAt }
        : {}),
    lastCheckedAt: at,
    discoveredAt: listing.discoveredAt,
    submittedBy: listing.submittedBy,
    ...(listing.extractedBy ? { extractedBy: listing.extractedBy } : {}),
    ...(atlasEntityId ? { atlasEntityId } : {}),
    ...(listing.atlas ? { atlas: listing.atlas } : {}),
    notes: [
      ...listing.notes,
      note(at, actor.who, checked ? "checked" : "edited"),
    ],
    updatedAt: at,
  };
  return { network: replace(network, next), listing: next };
}

export type Decision =
  "publish" | "needs-info" | "decline" | "withdraw" | "reopen";

/**
 * **A reviewer's decision.** Publishing is refused while any blocker stands,
 * whoever presses it. Ambassadors review only when trusted, and never their
 * own submission unless they are the trusted path's own direct publish.
 */
export function decide(
  network: Network,
  id: string,
  decision: Decision,
  actor: Actor,
  now: Date,
  reason?: string,
) {
  const listing = find(network, id);
  const reviewer =
    actor.role === "admin" ||
    (actor.role === "ambassador" && actor.ambassador?.trusted);
  if (!reviewer) throw new Refused("Only a reviewer can do that.", 403);
  const at = now.toISOString();
  const why = clean(reason, 500) || undefined;
  if (decision === "publish") {
    const left = blockers(listing);
    if (left.length) throw new Refused(left.join(" "), 409);
  }
  if ((decision === "needs-info" || decision === "decline") && !why)
    throw new Refused("Say why, so the person who sent it knows.");
  const status: Listing["status"] =
    decision === "publish"
      ? "published"
      : decision === "needs-info"
        ? "needs-info"
        : decision === "decline"
          ? "declined"
          : decision === "withdraw"
            ? "withdrawn"
            : "submitted";
  const kind: Note["kind"] =
    decision === "publish"
      ? "published"
      : decision === "needs-info"
        ? "needs-info"
        : decision === "decline"
          ? "declined"
          : decision === "withdraw"
            ? "withdrawn"
            : "edited";
  const next: Listing = {
    ...listing,
    status,
    ...(decision === "publish" ? { lastCheckedAt: at } : {}),
    notes: [...listing.notes, note(at, actor.who, kind, why)],
    updatedAt: at,
  };
  return { network: replace(network, next), listing: next };
}

/**
 * **Something is wrong with this listing**, or **this is mine** — from
 * anyone, signed in or not. Each is a note on the trail and puts a published
 * listing back in front of a reviewer; neither changes a fact by itself.
 */
export function flag(
  network: Network,
  id: string,
  kind: "report" | "claim" | "correction",
  text: string,
  who: string,
  now: Date,
) {
  const listing = find(network, id);
  const said = cleanBlock(text, 1000);
  if (!said) throw new Refused("Tell us what's wrong, or how to reach you.");
  const next: Listing = {
    ...listing,
    notes: [...listing.notes, note(now.toISOString(), who, kind, said)],
    updatedAt: now.toISOString(),
  };
  return { network: replace(network, next), listing: next };
}

/** Listings with a report, claim or correction no reviewer has acted on since. */
export function openFlags(listing: Listing): Note[] {
  const lastAction = listing.notes.reduce(
    (at, n) =>
      [
        "published",
        "declined",
        "needs-info",
        "withdrawn",
        "edited",
        "checked",
      ].includes(n.kind)
        ? n.at
        : at,
    "",
  );
  return listing.notes.filter(
    (n) =>
      (n.kind === "report" || n.kind === "claim" || n.kind === "correction") &&
      n.at > lastAction,
  );
}

/** The review queue: what waits, oldest first, then published listings with open flags. */
export function queue(network: Network): Listing[] {
  const waiting = network.listings
    .filter((l) => l.status === "submitted")
    .sort((a, b) => a.discoveredAt.localeCompare(b.discoveredAt));
  const flagged = network.listings.filter(
    (l) => l.status !== "submitted" && openFlags(l).length > 0,
  );
  return [...waiting, ...flagged];
}

export function setAtlas(
  network: Network,
  id: string,
  atlas: Listing["atlas"],
): Network {
  const listing = find(network, id);
  return replace(network, { ...listing, ...(atlas ? { atlas } : {}) });
}

// ---------------------------------------------------------------------------
// Ambassadors

export function invite(
  network: Network,
  input: { email: string; name: string; area?: string; trusted?: boolean },
  actor: Actor,
  now: Date,
): Network {
  if (actor.role !== "admin")
    throw new Refused("Only an administrator invites ambassadors.", 403);
  const email = clean(input.email, 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new Refused("That doesn't look like an email address.");
  const name = clean(input.name, 80);
  if (!name) throw new Refused("Give them a name.");
  const existing = network.ambassadors.find((a) => a.email === email);
  const ambassador: Ambassador = {
    email,
    name,
    area: clean(input.area, 80) || "North Okanagan",
    trusted: !!input.trusted,
    ...(existing?.bio ? { bio: existing.bio } : {}),
    invitedBy: existing?.invitedBy ?? actor.who,
    invitedAt: existing?.invitedAt ?? now.toISOString(),
    active: true,
  };
  return {
    ...network,
    ambassadors: existing
      ? network.ambassadors.map((a) => (a.email === email ? ambassador : a))
      : [...network.ambassadors, ambassador],
  };
}

export function retire(network: Network, email: string, actor: Actor): Network {
  if (actor.role !== "admin")
    throw new Refused("Only an administrator does that.", 403);
  const e = email.toLowerCase();
  return {
    ...network,
    ambassadors: network.ambassadors.map((a) =>
      a.email === e ? { ...a, active: false } : a,
    ),
  };
}

export function updateProfile(
  network: Network,
  email: string,
  change: { name?: string; area?: string; bio?: string },
): Network {
  const e = email.toLowerCase();
  const me = network.ambassadors.find((a) => a.email === e && a.active);
  if (!me) throw new Refused("You're not an ambassador yet.", 403);
  const updated: Ambassador = {
    ...me,
    name: clean(change.name, 80) || me.name,
    area: clean(change.area, 80) || me.area,
    ...(change.bio !== undefined
      ? { bio: cleanBlock(change.bio, 600) }
      : me.bio
        ? { bio: me.bio }
        : {}),
  };
  return {
    ...network,
    ambassadors: network.ambassadors.map((a) => (a.email === e ? updated : a)),
  };
}

/** Seed listings join once, by id; a seed already present (or edited) is left alone. */
export function withSeed(network: Network, seed: readonly Listing[]): Network {
  const have = new Set(network.listings.map((l) => l.id));
  const add = seed.filter((s) => !have.has(s.id));
  return add.length
    ? { ...network, listings: [...network.listings, ...add] }
    : network;
}
