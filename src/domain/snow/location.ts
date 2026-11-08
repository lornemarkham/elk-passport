/**
 * **Finding your crew on the hill: the small pure part.**
 *
 * Sharing is a choice, for a while, in a shared day only, and it is described
 * here in numbers the database also enforces (docs/product/snow/
 * location-migration.sql, ADR 011). Nothing in this file touches a clock or a
 * network: callers pass `now` in.
 */
export const SHARE_MINUTES = [30, 60, 120, 240] as const;
export type ShareMinutes = (typeof SHARE_MINUTES)[number];
/** The most a share may last, and the database refuses anything longer. */
export const MAX_SHARE_MINUTES = 240;
/** A phone sends a new position no more often than this. */
export const SEND_EVERY_MS = 20_000;
/** A position older than this is shown as "last seen", not as "here". */
export const STALE_AFTER_MS = 3 * 60_000;

export interface Fix {
  readonly lat: number;
  readonly lng: number;
  readonly accuracyM: number | null;
}

export interface CrewPosition extends Fix {
  /** The core's random member id — never an account id. */
  readonly memberId: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
}

export interface Sharing {
  readonly sharing: { readonly expiresAt: string } | null;
  readonly others: readonly CrewPosition[];
}

/** About 11 m. The database rounds again; this keeps raw GPS off the wire. */
export const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function parseShare(raw: unknown): {
  fix: Fix;
  minutes: ShareMinutes | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lat = r.lat;
  const lng = r.lng;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  const acc =
    typeof r.accuracyM === "number" &&
    Number.isFinite(r.accuracyM) &&
    r.accuracyM >= 0
      ? Math.min(5000, Math.round(r.accuracyM))
      : null;
  const minutes =
    r.minutes === undefined
      ? null
      : (SHARE_MINUTES as readonly unknown[]).includes(r.minutes)
        ? (r.minutes as ShareMinutes)
        : undefined;
  if (minutes === undefined) return null;
  return {
    fix: { lat: round4(lat), lng: round4(lng), accuracyM: acc },
    minutes,
  };
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function metresBetween(a: Fix, b: Fix): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const POINTS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

/** Which way to face from `a` to see `b`, in words. */
export function pointOf(a: Fix, b: Fix): (typeof POINTS)[number] {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export function distanceWords(m: number): string {
  if (m < 30) return "right here";
  if (m < 1000) return `about ${Math.round(m / 10) * 10} m`;
  return `about ${(m / 1000).toFixed(1)} km`;
}

export function ageWords(iso: string, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export function isStale(p: { updatedAt: string }, now: Date): boolean {
  return now.getTime() - Date.parse(p.updatedAt) > STALE_AFTER_MS;
}

/** "about 240 m north-east of you · 1 min ago", or "last seen …" when old. */
export function describeFrom(me: Fix, p: CrewPosition, now: Date): string {
  const where = `${distanceWords(metresBetween(me, p))}${
    metresBetween(me, p) < 30 ? "" : ` ${pointOf(me, p)} of you`
  }`;
  return isStale(p, now)
    ? `last seen ${where}, ${ageWords(p.updatedAt, now)}`
    : `${where} · ${ageWords(p.updatedAt, now)}`;
}

export function remainingWords(expiresAt: string, now: Date): string {
  const min = Math.ceil((Date.parse(expiresAt) - now.getTime()) / 60_000);
  if (min <= 0) return "ending";
  if (min < 60) return `${min} min left`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min left`;
}

export const labelFor = (m: ShareMinutes) =>
  m < 60 ? `${m} min` : m === 60 ? "1 hour" : `${m / 60} hours`;
