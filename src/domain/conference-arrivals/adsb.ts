/**
 * **ADS-B, as ADSB.lol reports it, read into the few facts matching uses.**
 *
 * ADSB.lol (https://api.adsb.lol, ODbL 1.0) aggregates what volunteer ground
 * receivers hear. Each aircraft item is one transponder: its 24-bit ICAO
 * address (`hex`), the callsign it is broadcasting (`flight`), and a position
 * when one was decoded. Coverage is ground-based, so aircraft over oceans and
 * remote land go quiet. That is reported as quiet, never filled in.
 *
 * Route records come from the VRS standing-data set ADSB.lol publishes
 * (`vrs-standing-data.adsb.lol/routes/…`): a community-maintained map from
 * callsign to airports. It goes stale (it says `ACA855` flies LHR→YYZ), so it
 * is one piece of evidence and never proof on its own.
 *
 * Pure. Payload shapes were recorded from the live API on 2026-10-12; the
 * fixtures in `__fixtures__/` are those recordings.
 */
import type { LatLon } from "./geo";

export interface Observation {
  /** ICAO 24-bit address, lowercase hex. Stable for an airframe. */
  readonly hex: string;
  /** Broadcast callsign, trimmed. `null` when not being sent. */
  readonly callsign: string | null;
  readonly registration: string | null;
  /** ICAO aircraft type, e.g. `B738`. */
  readonly type: string | null;
  readonly position: LatLon | null;
  readonly onGround: boolean;
  readonly altitudeFt: number | null;
  readonly groundSpeedKt: number | null;
  /** Track over the ground, degrees true. */
  readonly trackDeg: number | null;
  /** Feet per minute; negative is descending. */
  readonly verticalRateFpm: number | null;
  /** When the position was last decoded (server clock minus `seen_pos`). */
  readonly positionAt: string | null;
  /** How the position was obtained. `mlat` is triangulated, still real. */
  readonly via: "adsb" | "mlat" | "other";
  /**
   * The aircraft is in a privacy programme (FAA LADD, or a privacy ICAO
   * address). Passport does not attach anybody's name to those.
   */
  readonly privacyListed: boolean;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// readsb's dbFlags bits: 1 military, 2 interesting, 4 PIA, 8 LADD.
const PIA = 4;
const LADD = 8;

export function readObservation(
  v: unknown,
  serverNowMs: number,
): Observation | null {
  const a = obj(v);
  const hex = str(a?.hex)?.toLowerCase();
  if (!a || !hex || !/^~?[0-9a-f]{6}$/.test(hex)) return null;
  const lat = num(a.lat);
  const lon = num(a.lon);
  const seenPos = num(a.seen_pos);
  const altitude = a.alt_baro;
  const type = str(a.type) ?? "";
  const flags = num(a.dbFlags) ?? 0;
  return {
    hex,
    callsign: str(a.flight)?.toUpperCase() ?? null,
    registration: str(a.r),
    type: str(a.t),
    position: lat !== null && lon !== null ? { lat, lon } : null,
    onGround: altitude === "ground",
    altitudeFt: num(altitude) ?? num(a.alt_geom),
    groundSpeedKt: num(a.gs),
    trackDeg: num(a.track) ?? num(a.true_heading),
    verticalRateFpm: num(a.baro_rate) ?? num(a.geom_rate),
    positionAt:
      lat !== null && lon !== null && seenPos !== null
        ? new Date(serverNowMs - seenPos * 1000).toISOString()
        : null,
    via: type.startsWith("adsb") ? "adsb" : type === "mlat" ? "mlat" : "other",
    privacyListed: (flags & (PIA | LADD)) !== 0,
  };
}

export interface AdsbSnapshot {
  /** ADSB.lol's own clock for this answer, ISO. */
  readonly at: string;
  readonly aircraft: readonly Observation[];
}

/** A `/v2/callsign/…` or `/v2/hex/…` answer. */
export function readSnapshot(body: unknown): AdsbSnapshot {
  const b = obj(body);
  const now = num(b?.now) ?? Date.now();
  const ac = Array.isArray(b?.ac) ? b.ac : [];
  return {
    at: new Date(now).toISOString(),
    aircraft: ac
      .map((x) => readObservation(x, now))
      .filter((x): x is Observation => x !== null),
  };
}

export interface RouteAirport extends LatLon {
  readonly icao: string;
  readonly iata: string | null;
  readonly city: string | null;
  readonly name: string;
}

export interface RouteRecord {
  readonly callsign: string;
  /** In flight order. More than two is a multi-stop route. */
  readonly airports: readonly RouteAirport[];
}

/** A `routes/XX/CALLSIGN.json` record. `null` when unusable. */
export function readRoute(body: unknown): RouteRecord | null {
  const b = obj(body);
  const callsign = str(b?.callsign)?.toUpperCase();
  const list = Array.isArray(b?._airports) ? b._airports : [];
  const airports = list
    .map((x): RouteAirport | null => {
      const a = obj(x);
      const icao = str(a?.icao);
      const lat = num(a?.lat);
      const lon = num(a?.lon);
      if (!a || !icao || lat === null || lon === null) return null;
      return {
        icao,
        iata: str(a.iata),
        city: str(a.location),
        name: str(a.name) ?? icao,
        lat,
        lon,
      };
    })
    .filter((x): x is RouteAirport => x !== null);
  if (!callsign || airports.length < 2) return null;
  return { callsign, airports };
}
