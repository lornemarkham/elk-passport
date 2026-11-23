import {
  CHECKS,
  FEATURES,
  KINDS,
  RATING_TAGS,
  REACTION_IDS,
  REPORTS,
  TOWNS,
  TOWN_AT,
  TOWN_LABEL,
  inArea,
  seasonOf,
  type CheckId,
  type FeatureId,
  type Kind,
  type LightsDoc,
  type Pin,
  type ProposedChange,
  type RatingTagId,
  type ReactionId,
  type ReportId,
  type TownId,
} from "./model";
import {
  COOLING,
  MAX_WAITING as CONTRIBUTIONS_MAX_WAITING,
  TOO_FAST,
  coolingOff,
  pace,
} from "@/domain/contributions/guard";

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
  const named = clean(body.name, 80);
  if (named && named.length < 3)
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
  // The name is optional when adding lights: a plain one stands in.
  const name = named ?? `Christmas lights in ${TOWN_LABEL[town]}`;
  const said: unknown[] = Array.isArray(body.features) ? body.features : [];
  const features = FEATURES.map((f) => f.id).filter((f) => said.includes(f));
  const residential = kind === "home" || body.residential === true;
  const description = clean(body.description, 500);
  // Links are how spam arrives; a display needs words, not a web address.
  if ([named, description].some((t) => t && /https?:\/\/|www\./i.test(t)))
    throw new Refused("Leave web links out — just describe the display.");
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

/**
 * **A removed property stays removed.** Where a listing was permanently
 * removed (a homeowner's request, or a reviewer), a new submission within
 * 60 m is refused — the tombstone keeps only the place, never the photo,
 * address, words or anyone's contact.
 */
export const REMOVED_RADIUS_M = 60;
export function removedNear(doc: LightsDoc, at: { lat: number; lng: number }) {
  return doc.pins.some(
    (p) => p.status === "removed" && metres(p.at, at) < REMOVED_RADIUS_M,
  );
}

/**
 * Most waiting pins the queue will hold before asking people to come back (a
 * flood stopper). Shared with every other community queue
 * (`domain/contributions/guard.ts`): high enough that a busy weekend of real
 * families never meets it.
 */
export const MAX_WAITING = CONTRIBUTIONS_MAX_WAITING;

export function submit(
  doc: LightsDoc,
  s: Submission,
  by: string,
  id: string,
  now: Date,
  photo?: string,
): { doc: LightsDoc; pin: Pin } {
  // **No daily cap** (owner brief 2026-11-23, P0: the owner added ten real
  // displays in one evening and was told to "try again tomorrow"). What
  // tells a script from a person is pace and moderation, the shared rules
  // in `domain/contributions/guard.ts`: a burst is asked to pause, a
  // contributor whose recent pins were declined as spam cools off for a day.
  const mine = doc.pins.filter((p) => p.submittedBy === by);
  const p = pace(
    mine.map((x) => x.submittedAt),
    now,
  );
  if (!p.ok) throw new Refused(TOO_FAST, 429);
  if (
    coolingOff(
      mine
        .filter((x) => x.status === "declined")
        .map((x) => ({
          at: x.updatedAt,
          spam: x.trail.some(
            (e) => e.kind === "declined" && /^spam/.test(e.text ?? ""),
          ),
        })),
      now,
    )
  )
    throw new Refused(COOLING, 429);
  if (removedNear(doc, s.at))
    throw new Refused(
      "That property was taken off the map at its household's request, so it can't be added again.",
      409,
    );
  if (doc.pins.filter((p) => p.status === "pending").length >= MAX_WAITING)
    throw new Refused(
      "We have a lot waiting for review right now — please try again in a day or two.",
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
 * **The administrator publishes a pin.** Nothing is public before this.
 * Approving confirms it lit for this season. (Homes need no owner consent
 * any more — the owner's decision of 2026-11-22; a homeowner's objection
 * hides the listing at once instead: `requestRemoval`.)
 */
export function approve(
  doc: LightsDoc,
  id: string,
  reviewer: string,
  now: Date,
): LightsDoc {
  const at = now.toISOString();
  const season = seasonOf(now);
  return edit(doc, id, (p) => {
    if (p.status === "removed") throw new Refused("That pin was removed.", 409);
    if (p.status === "hidden")
      throw new Refused(
        "That listing is hidden — restore it after reviewing the request.",
        409,
      );
    if (removedNear(doc, p.at))
      throw new Refused(
        "A property removed at its household's request is here.",
        409,
      );
    return {
      ...p,
      status: "approved",
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

/**
 * **Delete for good** — by its submitter, or the administrator. The photo,
 * address, name, description and any requester's contact are erased; the
 * place, the audit trail and the fact of removal stay, so the same property
 * is not submitted again (`removedNear`) and every decision can be answered
 * for. The server deletes the photo document.
 */
export function remove(
  doc: LightsDoc,
  id: string,
  by: string,
  isReviewer: boolean,
  now: Date,
  why?: string,
) {
  const at = now.toISOString();
  return edit(doc, id, (p) => {
    if (!isReviewer && p.submittedBy !== by)
      throw new Refused(
        "Only the person who pinned it, or a reviewer, can remove it.",
        403,
      );
    const { photo, address, description, hours, proposal, ...rest } = p;
    void photo;
    void address;
    void description;
    void hours;
    void proposal;
    return {
      ...rest,
      name: "Removed listing",
      features: [],
      reactions: [],
      ratings: [],
      status: "removed",
      trail: [
        ...p.trail.map((e) => {
          const { contact, ...kept } = e;
          void contact;
          return kept;
        }),
        {
          at,
          by,
          kind: "removed",
          ...(why ? { text: why.slice(0, 300) } : {}),
        },
      ],
      updatedAt: at,
    };
  });
}

/**
 * **The administrator takes a published display off the map** without
 * deleting it (it can be restored). Audit-logged.
 */
export function hide(
  doc: LightsDoc,
  id: string,
  reviewer: string,
  now: Date,
  why?: string,
) {
  const at = now.toISOString();
  return edit(doc, id, (p) => {
    if (p.status !== "approved")
      throw new Refused("Only a published display can be hidden.", 409);
    return {
      ...p,
      status: "hidden",
      trail: [
        ...p.trail,
        {
          at,
          by: reviewer,
          kind: "hidden",
          ...(why ? { text: why.slice(0, 300) } : {}),
        },
      ],
      updatedAt: at,
    };
  });
}

/**
 * **Put a hidden listing back** after the request or report was looked at
 * and resolved (a dispute settled in the listing's favour). It returns to
 * where it was: published if it had been, otherwise back in the queue — a
 * hidden submission is never published by being restored.
 */
/**
 * **Has the public ever seen this display?** Once approved, it stays a
 * published display in the eyes of the rules below — hidden or not — so an
 * unreviewed edit can never reach the public by way of a later restore.
 */
export function wasPublished(pin: Pick<Pin, "trail">): boolean {
  return pin.trail.some((e) => e.kind === "approved");
}

export function restore(
  doc: LightsDoc,
  id: string,
  reviewer: string,
  now: Date,
  why?: string,
) {
  const at = now.toISOString();
  return edit(doc, id, (p) => {
    if (p.status !== "hidden")
      throw new Refused("Only a hidden pin can be restored.", 409);
    const published = wasPublished(p);
    return {
      ...p,
      status: published ? "approved" : "pending",
      trail: [
        ...p.trail,
        {
          at,
          by: reviewer,
          kind: "restored",
          ...(why ? { text: why.slice(0, 300) } : {}),
        },
      ],
      updatedAt: at,
    };
  });
}

const MAX_REMOVAL_REQUESTS_PER_PERSON = 2;

/** A contact is optional and private to the administrator; it must look like an email or phone number. */
export function parseContact(v: unknown): string | undefined {
  const t = clean(v, 120);
  if (!t) return undefined;
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) &&
    !/^[+()\d][\d\s().+-]{6,}$/.test(t)
  )
    throw new Refused(
      "That contact doesn't look like an email or phone number.",
    );
  return t;
}

/**
 * **"Is this your home? Request removal."** Anyone, no account, no identity
 * check. A credible objection hides the listing from everybody **at once**;
 * the administrator is told, and later resolves it (`restore` or `remove`).
 * Wrongly hiding a display costs families a stop for a day; wrongly leaving
 * a home up costs its household their peace.
 */
export function requestRemoval(
  doc: LightsDoc,
  id: string,
  by: string,
  text: string | undefined,
  contact: string | undefined,
  now: Date,
) {
  const at = now.toISOString();
  return edit(doc, id, (p) => {
    if (p.status === "removed")
      throw new Refused("That listing has already been removed.", 409);
    if (
      p.trail.filter((e) => e.kind === "removal-request" && e.by === by)
        .length >= MAX_REMOVAL_REQUESTS_PER_PERSON
    )
      throw new Refused("Thanks — we already have your request.", 429);
    const hide = p.status === "approved" || p.status === "pending";
    return {
      ...p,
      ...(hide ? { status: "hidden" as const } : {}),
      trail: [
        ...p.trail,
        {
          at,
          by,
          kind: "removal-request",
          ...(text ? { text: text.slice(0, 500) } : {}),
          ...(contact ? { contact } : {}),
        },
        ...(hide ? [{ at, by, kind: "hidden" as const }] : []),
      ],
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
    const hide = reason === "privacy" && p.status === "approved";
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

/**
 * **"How magical was it?"** One rating per account per display per season;
 * rating again replaces it. Published displays only, signed in only (the
 * route says so), so one person cannot be a crowd and a private home cannot
 * be rated into view. Earlier seasons' ratings are kept.
 */
export function rate(
  doc: LightsDoc,
  id: string,
  by: string,
  stars: unknown,
  tags: unknown,
  now: Date,
) {
  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 5)
    throw new Refused("Give it one to five stars.");
  const said: unknown[] = Array.isArray(tags) ? tags : [];
  const picked = RATING_TAGS.map((t) => t.id).filter((t) =>
    said.includes(t),
  ) as RatingTagId[];
  const season = seasonOf(now);
  return edit(doc, id, (p) => {
    if (p.status !== "approved")
      throw new Refused("That display isn't published.", 409);
    if (p.submittedBy === by)
      throw new Refused("You can't rate your own lights — but thank you!", 409);
    const others = (p.ratings ?? []).filter(
      (r) => !(r.by === by && r.season === season),
    );
    return {
      ...p,
      ratings: [
        ...others,
        { by, stars: n, tags: picked, at: now.toISOString(), season },
      ],
    };
  });
}

/** The optional details someone can add after pinning. Said by people, never inferred. */
export interface Details {
  readonly kind?: Kind;
  readonly features?: readonly FeatureId[];
  readonly hours?: string;
  readonly description?: string;
  readonly name?: string;
}

export function parseDetails(body: Record<string, unknown>): Details {
  const said: unknown[] | null = Array.isArray(body.features)
    ? body.features
    : null;
  // A field sent empty means "clear it"; a field not sent is left alone.
  const hours =
    typeof body.hours === "string" ? (clean(body.hours, 80) ?? "") : undefined;
  const description =
    typeof body.description === "string"
      ? (clean(body.description, 500) ?? "")
      : undefined;
  const name = clean(body.name, 80);
  if (name !== undefined && name.length < 3)
    throw new Refused("Give the display a name — three letters at least.");
  const kind = KINDS.find((k) => k === body.kind);
  return {
    ...(kind ? { kind } : {}),
    ...(said
      ? { features: FEATURES.map((f) => f.id).filter((f) => said.includes(f)) }
      : {}),
    ...(hours !== undefined ? { hours } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(name !== undefined ? { name } : {}),
  };
}

/** The public words of a display: what the public sees, and what a change would make them. */
interface Wanted {
  readonly name: string;
  readonly description: string;
  readonly hours: string;
  readonly features: readonly FeatureId[];
}

const sortedFeatures = (f: readonly FeatureId[]) => [...f].sort();

/** The words a submitter has now: what they sent, else what they already had waiting, else what is shown. */
function wantedWords(shown: Pin, d: Details, waiting?: ProposedChange): Wanted {
  return {
    name: d.name ?? waiting?.name ?? shown.name,
    description:
      d.description ?? waiting?.description ?? shown.description ?? "",
    hours: d.hours ?? waiting?.hours ?? shown.hours ?? "",
    features: d.features ?? waiting?.features ?? shown.features,
  };
}

/** Only the fields that differ from what is shown, so a change back to the published words cancels itself. */
function differing(
  shown: Pin,
  want: Wanted,
  at: string,
): ProposedChange | undefined {
  const diff: {
    name?: string;
    description?: string;
    hours?: string;
    features?: readonly FeatureId[];
  } = {};
  if (want.name !== shown.name) diff.name = want.name;
  if (want.description !== (shown.description ?? ""))
    diff.description = want.description;
  if (want.hours !== (shown.hours ?? "")) diff.hours = want.hours;
  if (
    JSON.stringify(sortedFeatures(want.features)) !==
    JSON.stringify(sortedFeatures(shown.features))
  )
    diff.features = want.features;
  return Object.keys(diff).length ? { at, ...diff } : undefined;
}

/** What is still waiting once a reviewer has changed the shown words underneath it. */
function stillWaiting(
  c: ProposedChange | undefined,
  shown: Pin,
): ProposedChange | undefined {
  if (!c) return undefined;
  return differing(shown, wantedWords(shown, {}, c), c.at);
}

/** Writes words onto a pin. An empty hours or description clears it. */
function withWords(p: Pin, d: Details): Pin {
  return {
    ...p,
    ...(d.name !== undefined ? { name: d.name } : {}),
    ...(d.description !== undefined
      ? { description: d.description || undefined }
      : {}),
    ...(d.hours !== undefined ? { hours: d.hours || undefined } : {}),
    ...(d.features ? { features: d.features } : {}),
  };
}

const fieldsOf = (c: object) =>
  Object.keys(c)
    .filter((k) => k !== "at")
    .join(", ");

/**
 * **Add the details after pinning** — name, music, hours, walk-through,
 * family-friendly, what's special. Its submitter or a reviewer. Location and
 * permission are not details: they can't be changed here.
 *
 * **A display the public has seen never changes on the submitter's word.**
 * Their words are kept beside it as a proposal (`proposal`) until a reviewer
 * approves or declines it; the public map keeps the last approved words. A
 * reviewer's own edit applies at once. A pending submission is not public, so
 * its details apply at once too.
 */
export function addDetails(
  doc: LightsDoc,
  id: string,
  by: string,
  isReviewer: boolean,
  d: Details,
  now: Date,
) {
  const at = now.toISOString();
  return edit(doc, id, (p) => {
    if (!isReviewer && p.submittedBy !== by)
      throw new Refused("Only the person who pinned it can add details.", 403);
    if (p.status === "removed" || p.status === "declined")
      throw new Refused("That pin isn't on the map.", 409);
    if (!isReviewer && wasPublished(p)) {
      const waiting = differing(p, wantedWords(p, d, p.proposal), at);
      return {
        ...p,
        proposal: waiting,
        trail: [
          ...p.trail,
          {
            at,
            by,
            kind: waiting ? ("proposed" as const) : ("details" as const),
            text: waiting
              ? `waiting for review: ${fieldsOf(waiting)}`
              : "same as what the public sees",
          },
        ],
        updatedAt: at,
      };
    }
    const next = withWords(p, d);
    return {
      ...next,
      ...(d.kind && isReviewer
        ? { kind: d.kind, residential: d.kind === "home" }
        : {}),
      proposal: stillWaiting(p.proposal, next),
      trail: [
        ...p.trail,
        {
          at,
          by,
          kind: "details" as const,
          text: `edited: ${Object.keys(d).join(", ")}`,
        },
      ],
      updatedAt: at,
    };
  });
}

/**
 * **The administrator agrees to a submitter's change** to a published display.
 * The words it asked for go on the public map now, and the trail says which.
 */
export function approveChange(
  doc: LightsDoc,
  id: string,
  reviewer: string,
  now: Date,
) {
  const at = now.toISOString();
  return edit(doc, id, (p) => {
    const c = p.proposal;
    if (!c)
      throw new Refused("Nothing is waiting for review on that display.", 409);
    if (p.status === "removed" || p.status === "declined")
      throw new Refused("That pin isn't on the map.", 409);
    return {
      ...withWords(p, c),
      proposal: undefined,
      trail: [
        ...p.trail,
        {
          at,
          by: reviewer,
          kind: "change-approved" as const,
          text: `published: ${fieldsOf(c)}`,
        },
      ],
      updatedAt: at,
    };
  });
}

/**
 * **The administrator turns a submitter's change down.** The public words are
 * unchanged; the proposal is dropped and the reason kept in the audit record.
 */
export function declineChange(
  doc: LightsDoc,
  id: string,
  reviewer: string,
  now: Date,
  why?: string,
) {
  const at = now.toISOString();
  return edit(doc, id, (p) => {
    if (!p.proposal)
      throw new Refused("Nothing is waiting for review on that display.", 409);
    return {
      ...p,
      proposal: undefined,
      trail: [
        ...p.trail,
        {
          at,
          by: reviewer,
          kind: "change-declined" as const,
          ...(why ? { text: why.slice(0, 300) } : {}),
        },
      ],
      updatedAt: at,
    };
  });
}
