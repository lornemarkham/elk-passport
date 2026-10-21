import { adventureKind, type AdventureVisibility } from "./kinds";

/**
 * **What a request may ask for, checked before Postgres is asked.**
 *
 * The database is the boundary — every limit here is also a CHECK there —
 * but a person deserves "a title is needed" rather than a constraint name.
 * Pure functions, so the rules are pinned by unit tests without a database.
 */

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T>(error: string): Parsed<T> => ({ ok: false, error });

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TOWN = /^[a-z0-9-]{1,64}$/;
/** Same as the migration's `atlas_ref` CHECK. */
export const ATLAS_REF = /^[A-Za-z0-9_:.-]{1,128}$/;

function text(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : undefined;
}

function day(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !DAY.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

function moment(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

// ------------------------------------------------------------- adventure

export interface AdventureDetails {
  readonly title: string;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly timeZone: string | null;
  readonly destinationLabel: string | null;
  readonly destinationTownId: string | null;
}

export interface NewAdventure extends AdventureDetails {
  readonly kind: string;
}

function details(
  body: Record<string, unknown>,
): Parsed<Omit<AdventureDetails, "title">> {
  const startsOn = day(body.startsOn);
  const endsOn = day(body.endsOn);
  if (startsOn === undefined && body.startsOn !== undefined)
    return fail("That start date isn't a real day.");
  if (endsOn === undefined && body.endsOn !== undefined)
    return fail("That end date isn't a real day.");
  if (endsOn && !startsOn) return fail("An end date needs a start date.");
  if (endsOn && startsOn && endsOn < startsOn)
    return fail("It can't end before it starts.");

  const timeZone = text(body.timeZone, 64);
  if (timeZone === undefined && body.timeZone !== undefined)
    return fail("That time zone isn't usable.");
  const destinationLabel = text(body.destinationLabel, 120);
  if (destinationLabel === undefined && body.destinationLabel !== undefined)
    return fail("Keep where it is under 120 characters.");
  const town = text(body.destinationTownId, 64);
  if (
    (town === undefined && body.destinationTownId !== undefined) ||
    (town && !TOWN.test(town))
  )
    return fail("That town isn't one Passport knows.");

  return ok({
    startsOn: startsOn ?? null,
    endsOn: endsOn ?? null,
    timeZone: timeZone ?? null,
    destinationLabel: destinationLabel ?? null,
    destinationTownId: town ?? null,
  });
}

function title(value: unknown): Parsed<string> {
  const t = text(value, 120);
  if (!t) return fail("It needs a name, under 120 characters.");
  return ok(t);
}

/** Starting one. Only kinds this deployment declares may be started. */
export function parseNewAdventure(body: unknown): Parsed<NewAdventure> {
  if (!body || typeof body !== "object") return fail("Nothing was sent.");
  const b = body as Record<string, unknown>;
  const kind = typeof b.kind === "string" ? adventureKind(b.kind) : undefined;
  if (!kind) return fail("Pick what kind of adventure this is.");
  const t = title(b.title);
  if (!t.ok) return t;
  const d = details(b);
  if (!d.ok) return d;
  return ok({ kind: kind.id, title: t.value, ...d.value });
}

/** Changing one. Only the fields sent are changed; the kind never is. */
export function parseAdventurePatch(
  body: unknown,
): Parsed<Partial<AdventureDetails>> {
  if (!body || typeof body !== "object") return fail("Nothing was sent.");
  const b = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (b.title !== undefined) {
    const t = title(b.title);
    if (!t.ok) return t;
    patch.title = t.value;
  }
  const d = details(b);
  if (!d.ok) return d;
  for (const key of [
    "startsOn",
    "endsOn",
    "timeZone",
    "destinationLabel",
    "destinationTownId",
  ] as const) {
    if (b[key] !== undefined) patch[key] = d.value[key];
  }
  if (Object.keys(patch).length === 0) return fail("Nothing to change.");
  return ok(patch as Partial<AdventureDetails>);
}

// ---------------------------------------------------------------- invites

export interface InviteRequest {
  readonly label: string | null;
  /** `null` is an open link: anyone holding it, until revoked or expired. */
  readonly maxUses: number | null;
  readonly expiresInDays: number | null;
}

/**
 * A link is single-use unless the owner asks otherwise. "Send it to Bob"
 * is the common case, and a link that only works once cannot be forwarded
 * into a stranger's hands after Bob has used it.
 */
export function parseInviteRequest(body: unknown): Parsed<InviteRequest> {
  const b = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const label = text(b.label, 60);
  if (label === undefined && b.label !== undefined)
    return fail("Keep the note under 60 characters.");

  let maxUses: number | null = 1;
  if (b.maxUses === null) maxUses = null;
  else if (b.maxUses !== undefined) {
    if (
      typeof b.maxUses !== "number" ||
      !Number.isInteger(b.maxUses) ||
      b.maxUses < 1 ||
      b.maxUses > 100
    )
      return fail("A link can be used between 1 and 100 times, or openly.");
    maxUses = b.maxUses;
  }

  let expiresInDays: number | null = null;
  if (b.expiresInDays !== undefined && b.expiresInDays !== null) {
    if (
      typeof b.expiresInDays !== "number" ||
      !(b.expiresInDays > 0) ||
      b.expiresInDays > 365
    )
      return fail("A link can last up to a year.");
    expiresInDays = b.expiresInDays;
  }

  return ok({ label: label ?? null, maxUses, expiresInDays });
}

/** Tokens are base64url, 32 random bytes. Anything else is not one of ours. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

// ------------------------------------------------------------------ items

export type ItemStatus = "proposed" | "confirmed";

export interface ItemInput {
  readonly atlasRef: string | null;
  readonly label: string | null;
  readonly note: string | null;
  readonly status: ItemStatus;
  readonly onDay: string | null;
  readonly startsAt: string | null;
}

/** A change to an item. `position` orders it within its day or the ideas. */
export type ItemPatch = Partial<ItemInput> & { readonly position?: number };

/** Something for the plan: an Atlas thing, a place in the group's words, or a note. */
export function parseItem(body: unknown): Parsed<ItemInput> {
  if (!body || typeof body !== "object") return fail("Nothing was sent.");
  const b = body as Record<string, unknown>;

  const atlasRef = text(b.atlasRef, 128);
  if (
    (atlasRef === undefined && b.atlasRef !== undefined) ||
    (atlasRef && !ATLAS_REF.test(atlasRef))
  )
    return fail("That isn't an Atlas id.");
  const label = text(b.label, 120);
  if (label === undefined && b.label !== undefined)
    return fail("Keep the name under 120 characters.");
  const note = text(b.note, 1000);
  if (note === undefined && b.note !== undefined)
    return fail("Keep the note under 1000 characters.");
  if (!atlasRef && !label && !note)
    return fail("Add a place, a name or a note.");

  const status = b.status === "confirmed" ? "confirmed" : "proposed";
  if (b.status !== undefined && b.status !== status)
    return fail("A plan is proposed or confirmed.");

  const onDay = day(b.onDay);
  if (onDay === undefined && b.onDay !== undefined)
    return fail("That day isn't a real day.");
  const startsAt = moment(b.startsAt);
  if (startsAt === undefined && b.startsAt !== undefined)
    return fail("That time isn't a real time.");

  return ok({
    atlasRef: atlasRef ?? null,
    label: label ?? null,
    note: note ?? null,
    status,
    onDay: onDay ?? null,
    startsAt: startsAt ?? null,
  });
}

export function parseItemPatch(body: unknown): Parsed<ItemPatch> {
  if (!body || typeof body !== "object") return fail("Nothing was sent.");
  const b = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (b.status !== undefined) {
    if (b.status !== "proposed" && b.status !== "confirmed")
      return fail("A plan is proposed or confirmed.");
    patch.status = b.status;
  }
  if (b.note !== undefined) {
    const note = text(b.note, 1000);
    if (note === undefined) return fail("Keep the note under 1000 characters.");
    patch.note = note;
  }
  if (b.label !== undefined) {
    const label = text(b.label, 120);
    if (label === undefined) return fail("Keep the name under 120 characters.");
    patch.label = label;
  }
  if (b.onDay !== undefined) {
    const onDay = day(b.onDay);
    if (onDay === undefined) return fail("That day isn't a real day.");
    patch.onDay = onDay;
  }
  if (b.startsAt !== undefined) {
    const startsAt = moment(b.startsAt);
    if (startsAt === undefined) return fail("That time isn't a real time.");
    patch.startsAt = startsAt;
  }
  if (b.position !== undefined) {
    if (
      typeof b.position !== "number" ||
      !Number.isInteger(b.position) ||
      b.position < 0 ||
      b.position > 10_000
    )
      return fail("That isn't a place in the list.");
    patch.position = b.position;
  }
  if (Object.keys(patch).length === 0) return fail("Nothing to change.");
  return ok(patch as ItemPatch);
}

export type ResponseValue = "in" | "maybe" | "out";

/** `null` takes an answer back. */
export function parseResponse(body: unknown): Parsed<ResponseValue | null> {
  const r = (body as { response?: unknown } | null)?.response;
  if (r === null) return ok(null);
  if (r === "in" || r === "maybe" || r === "out") return ok(r);
  return fail("Say in, maybe or out.");
}

export function parseVisibility(value: unknown): AdventureVisibility | null {
  return value === "members" || value === "hidden" ? value : null;
}

// ------------------------------------------------------- hockey extension

export interface HockeyFacts {
  readonly puckDrop: string | null;
  readonly homeTeam: string | null;
  readonly awayTeam: string | null;
  readonly arenaAtlasRef: string | null;
  readonly arenaLabel: string | null;
}

export function parseHockeyFacts(body: unknown): Parsed<HockeyFacts> {
  const b = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const puckDrop = moment(b.puckDrop);
  if (puckDrop === undefined && b.puckDrop !== undefined)
    return fail("That puck drop isn't a real time.");
  const homeTeam = text(b.homeTeam, 60);
  const awayTeam = text(b.awayTeam, 60);
  if (
    (homeTeam === undefined && b.homeTeam !== undefined) ||
    (awayTeam === undefined && b.awayTeam !== undefined)
  )
    return fail("Keep team names under 60 characters.");
  const arenaAtlasRef = text(b.arenaAtlasRef, 128);
  if (
    (arenaAtlasRef === undefined && b.arenaAtlasRef !== undefined) ||
    (arenaAtlasRef && !ATLAS_REF.test(arenaAtlasRef))
  )
    return fail("That isn't an Atlas id.");
  const arenaLabel = text(b.arenaLabel, 120);
  if (arenaLabel === undefined && b.arenaLabel !== undefined)
    return fail("Keep the arena under 120 characters.");
  return ok({
    puckDrop: puckDrop ?? null,
    homeTeam: homeTeam ?? null,
    awayTeam: awayTeam ?? null,
    arenaAtlasRef: arenaAtlasRef ?? null,
    arenaLabel: arenaLabel ?? null,
  });
}

/**
 * Saved things to add as ideas: Atlas ids only, de-duplicated, at most 24
 * at once (a board's worth of choosing, not a bulk import).
 */
export function parseIdeas(body: unknown): Parsed<string[]> {
  const refs = (body as { atlasRefs?: unknown } | null)?.atlasRefs;
  if (!Array.isArray(refs) || refs.length === 0)
    return fail("Pick at least one thing.");
  if (refs.length > 24) return fail("Add up to 24 at a time.");
  if (!refs.every((r) => typeof r === "string" && ATLAS_REF.test(r)))
    return fail("That isn't an Atlas id.");
  return ok([...new Set(refs as string[])]);
}
