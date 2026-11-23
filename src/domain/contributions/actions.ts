import {
  CATEGORY_IDS,
  DECLINE_REASONS,
  EXPERIENCE_RE,
  type AtlasHandoff,
  type CategoryId,
  type DeclineReason,
  type Location,
  type Suggestion,
  type SuggestionsDoc,
} from "./model";
import {
  COOLING,
  FLOODED,
  MAX_WAITING,
  TOO_FAST,
  coolingOff,
  pace,
} from "./guard";

/**
 * **What can happen to a suggestion**, each a pure step from one document to
 * the next. A refusal is said in words (`Refused`) so a route can hand it to
 * the person as it stands.
 */
export class Refused extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

const clean = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
};

/** Five decimals is about a metre: as precise as a phone, no more. */
const round = (n: number) => Math.round(n * 1e5) / 1e5;

export interface Submission {
  readonly experience: string;
  readonly category: CategoryId;
  readonly name: string;
  readonly location: Location;
  readonly description?: string;
  readonly when?: string;
  readonly website?: string;
}

/** A web address a person typed: `https://` added when missing; anything that isn't a URL is refused. */
export function parseWebsite(v: unknown): string | undefined {
  const t = clean(v, 300);
  if (!t) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Refused("That website address doesn't look right.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Refused("A website needs to start with http or https.");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname))
    throw new Refused("That website address doesn't look right.");
  return url.toString();
}

/** A suggestion, read from what a browser sent. Required: name, category, location. */
export function parseSubmission(body: Record<string, unknown>): Submission {
  const experienceRaw = clean(body.experience, 32)?.toLowerCase();
  const experience =
    experienceRaw && EXPERIENCE_RE.test(experienceRaw)
      ? experienceRaw
      : "gohaveaday";
  const category = CATEGORY_IDS.find((c) => c === body.category);
  if (!category) throw new Refused("Pick what kind of thing it is.");
  const name = clean(body.name, 120);
  if (!name || name.length < 2)
    throw new Refused("Give it a name — a couple of letters at least.");
  const locationText = clean(body.location, 200);
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const placed =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    body.lat !== undefined &&
    body.lat !== null &&
    body.lat !== "";
  if (!locationText && !placed)
    throw new Refused(
      "Say where it is — an address, a venue, or use your location.",
    );
  const town = clean(body.town, 60);
  const location: Location = {
    text: locationText ?? "At my location",
    ...(town ? { town } : {}),
    ...(placed ? { lat: round(lat), lng: round(lng) } : {}),
  };
  const description = clean(body.description, 1000);
  const when = clean(body.when, 160);
  const website = parseWebsite(body.website);
  // Links belong in the website field; words full of them are how spam arrives.
  const linky = (t?: string) =>
    t && (t.match(/https?:\/\/|www\./gi)?.length ?? 0) > 1;
  if (linky(name) || linky(description))
    throw new Refused(
      "Put the web address in the website box and keep the words for what it is.",
    );
  return {
    experience,
    category,
    name,
    location,
    ...(description ? { description } : {}),
    ...(when ? { when } : {}),
    ...(website ? { website } : {}),
  };
}

/** Lower-cased words only, for telling two names apart: "Long John's Pub!" is "long johns pub". */
export const normalName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f'\u2019"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

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

const sameTown = (a: Location, b: Location) =>
  !!a.town && !!b.town && a.town.toLowerCase() === b.town.toLowerCase();
const near = (a: Location, b: Location, m: number) =>
  a.lat !== undefined &&
  a.lng !== undefined &&
  b.lat !== undefined &&
  b.lng !== undefined &&
  metres({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) < m;

/**
 * **Something that looks like this suggestion already** (not declined): the
 * same name in the same town, or the same name within 500 m, or a different
 * name within 25 m. For the reviewer to compare; it refuses nothing.
 */
export function lookalike(
  doc: SuggestionsDoc,
  s: Submission,
): Suggestion | undefined {
  const n = normalName(s.name);
  return doc.suggestions.find(
    (x) =>
      x.status !== "declined" &&
      ((normalName(x.name) === n &&
        (sameTown(x.location, s.location) ||
          near(x.location, s.location, 500) ||
          (!x.location.town && !s.location.town && !x.location.lat))) ||
        near(x.location, s.location, 25)),
  );
}

/** The same person's own suggestion that this one repeats: a retry, not a new one. */
export function ownRepeat(
  doc: SuggestionsDoc,
  s: Submission,
  by: string,
): Suggestion | undefined {
  const n = normalName(s.name);
  return doc.suggestions.find(
    (x) =>
      x.submittedBy === by &&
      x.status === "pending" &&
      normalName(x.name) === n &&
      (x.location.text.toLowerCase() === s.location.text.toLowerCase() ||
        near(x.location, s.location, 50)),
  );
}

export function submit(
  doc: SuggestionsDoc,
  s: Submission,
  by: string,
  id: string,
  now: Date,
  photo?: string,
): { doc: SuggestionsDoc; suggestion: Suggestion; repeat: boolean } {
  const again = ownRepeat(doc, s, by);
  if (again) return { doc, suggestion: again, repeat: true };
  const mine = doc.suggestions.filter((x) => x.submittedBy === by);
  const p = pace(
    mine.map((x) => x.submittedAt),
    now,
  );
  if (!p.ok) throw new Refused(TOO_FAST, 429, p.retryAfterSeconds);
  if (
    coolingOff(
      mine
        .filter((x) => x.status === "declined")
        .map((x) => ({ at: x.updatedAt, spam: x.declineReason === "spam" })),
      now,
    )
  )
    throw new Refused(COOLING, 429, 3600);
  if (
    doc.suggestions.filter((x) => x.status === "pending").length >= MAX_WAITING
  )
    throw new Refused(FLOODED, 429, 3600);
  const at = now.toISOString();
  const twin = lookalike(doc, s);
  const suggestion: Suggestion = {
    id,
    ...s,
    ...(photo ? { photo } : {}),
    status: "pending",
    ...(twin ? { duplicateOf: twin.id } : {}),
    submittedBy: by,
    submittedAt: at,
    updatedAt: at,
    trail: [{ at, by, kind: "submitted" }],
  };
  return {
    doc: { suggestions: [...doc.suggestions, suggestion] },
    suggestion,
    repeat: false,
  };
}

export function find(doc: SuggestionsDoc, id: string): Suggestion {
  const s = doc.suggestions.find((x) => x.id === id);
  if (!s) throw new Refused("That suggestion isn't here.", 404);
  return s;
}

function edit(
  doc: SuggestionsDoc,
  id: string,
  fn: (s: Suggestion) => Suggestion,
): SuggestionsDoc {
  const s = find(doc, id);
  const next = fn(s);
  return { suggestions: doc.suggestions.map((x) => (x.id === id ? next : x)) };
}

/** The administrator says yes. It now counts toward the contributor's milestones. */
export function approve(
  doc: SuggestionsDoc,
  id: string,
  reviewer: string,
  now: Date,
  note?: string,
): SuggestionsDoc {
  const at = now.toISOString();
  return edit(doc, id, (s) => ({
    ...s,
    status: "approved",
    declineReason: undefined,
    trail: [
      ...s.trail,
      { at, by: reviewer, kind: "approved", ...(note ? { text: note } : {}) },
    ],
    updatedAt: at,
  }));
}

export function parseReason(v: unknown): DeclineReason {
  const r = DECLINE_REASONS.find((d) => d.id === v);
  if (!r) throw new Refused("Say why it's turned down.");
  return r.id;
}

/** Turned down, with the reason kept for the audit record and the cooling-off rule. */
export function decline(
  doc: SuggestionsDoc,
  id: string,
  reviewer: string,
  reason: DeclineReason,
  now: Date,
  note?: string,
): SuggestionsDoc {
  const at = now.toISOString();
  return edit(doc, id, (s) => ({
    ...s,
    status: "declined",
    declineReason: reason,
    trail: [
      ...s.trail,
      {
        at,
        by: reviewer,
        kind: "declined",
        text: `${reason}${note ? `: ${note.slice(0, 300)}` : ""}`,
      },
    ],
    updatedAt: at,
  }));
}

/** The fields a reviewer may correct. A field sent empty clears it; one not sent is left alone. */
export interface Edits {
  readonly name?: string;
  readonly category?: CategoryId;
  readonly location?: string;
  readonly town?: string;
  readonly description?: string;
  readonly when?: string;
  readonly website?: string;
}

export function parseEdits(body: Record<string, unknown>): Edits {
  const opt = (k: string, max: number) =>
    typeof body[k] === "string" ? (clean(body[k], max) ?? "") : undefined;
  const name = clean(body.name, 120);
  if (name !== undefined && name.length < 2)
    throw new Refused("A name needs a couple of letters at least.");
  const category = CATEGORY_IDS.find((c) => c === body.category);
  const location = clean(body.location, 200);
  const website =
    typeof body.website === "string"
      ? (parseWebsite(body.website) ?? "")
      : undefined;
  return {
    ...(name !== undefined ? { name } : {}),
    ...(category ? { category } : {}),
    ...(location !== undefined ? { location } : {}),
    ...(opt("town", 60) !== undefined ? { town: opt("town", 60) } : {}),
    ...(opt("description", 1000) !== undefined
      ? { description: opt("description", 1000) }
      : {}),
    ...(opt("when", 160) !== undefined ? { when: opt("when", 160) } : {}),
    ...(website !== undefined ? { website } : {}),
  };
}

/** The administrator corrects the words before copying them on. */
export function editSuggestion(
  doc: SuggestionsDoc,
  id: string,
  reviewer: string,
  e: Edits,
  now: Date,
): SuggestionsDoc {
  const at = now.toISOString();
  return edit(doc, id, (s) => ({
    ...s,
    ...(e.name !== undefined ? { name: e.name } : {}),
    ...(e.category ? { category: e.category } : {}),
    location: {
      ...s.location,
      ...(e.location !== undefined && e.location !== ""
        ? { text: e.location }
        : {}),
      ...(e.town !== undefined ? { town: e.town || undefined } : {}),
    },
    ...(e.description !== undefined
      ? { description: e.description || undefined }
      : {}),
    ...(e.when !== undefined ? { when: e.when || undefined } : {}),
    ...(e.website !== undefined ? { website: e.website || undefined } : {}),
    trail: [
      ...s.trail,
      {
        at,
        by: reviewer,
        kind: "edited",
        text: `edited: ${Object.keys(e).join(", ")}`,
      },
    ],
    updatedAt: at,
  }));
}

/** What Atlas said when the suggestion's page was handed to it. */
export function setAtlas(
  doc: SuggestionsDoc,
  id: string,
  reviewer: string,
  atlas: AtlasHandoff,
): SuggestionsDoc {
  return edit(doc, id, (s) => ({
    ...s,
    atlas,
    trail: [
      ...s.trail,
      {
        at: atlas.at,
        by: reviewer,
        kind: "atlas",
        text: `${atlas.state}${atlas.detail ? `: ${atlas.detail}` : ""}`,
      },
    ],
    updatedAt: atlas.at,
  }));
}

/** A contributor's approved and pending counts in this queue. */
export function countFor(
  doc: SuggestionsDoc,
  keys: readonly string[],
): { approved: number; pending: number } {
  const mine = doc.suggestions.filter((x) => keys.includes(x.submittedBy));
  return {
    approved: mine.filter((x) => x.status === "approved").length,
    pending: mine.filter((x) => x.status === "pending").length,
  };
}
