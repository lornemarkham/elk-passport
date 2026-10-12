import "server-only";
import {
  readRoute,
  readSnapshot,
  type AdsbSnapshot,
  type RouteRecord,
} from "@/domain/conference-arrivals/adsb";

/**
 * **The only code that talks to ADSB.lol.** Browsers never do: the API has
 * no key today, asks production users to get in touch first, and will
 * require a key (earned by feeding) in future, so one polite server-side
 * client is the seam to change when that happens.
 *
 * Politeness, in order:
 *
 * 1. **A shared cache.** Every viewer of every conference reads the same
 *    answers. A live lookup is reused for 8 s, so 160 people refreshing the
 *    board cost what one does.
 * 2. **Coalescing.** Two requests for the same URL in flight are one request.
 * 3. **A pace.** At most one request every 2 s leaves this process.
 *    ADSB.lol publishes no limit and sends no rate headers. Measured from
 *    this machine on 2026-10-12: a 400 ms pace drew 429s within seconds,
 *    and a penalty, once earned, outlasted a 3 s pace; after a rest, 14 of
 *    14 calls at one per ~5.5 s succeeded. Hence slow, and hence the shared
 *    area query in `tracker.ts`.
 * 4. **Backing off.** A 429 or 5xx pauses everything for two minutes; while
 *    paused, callers get the cached answer if there is one and `null` if
 *    not. `null` means "didn't answer", which the tracker never turns into
 *    movement.
 *
 * Route records are static files (VRS standing data, published by ADSB.lol
 * on GitHub Pages) and cached for 12 hours, misses included.
 */
export interface AdsbSource {
  /**
   * Everything within `AREA_NM` of a point: one call that covers the last
   * ~40 minutes of every flight into that airport, shared by all of them.
   */
  around(lat: number, lon: number): Promise<AdsbSnapshot | null>;
  byCallsign(callsign: string): Promise<AdsbSnapshot | null>;
  byHex(hex: string): Promise<AdsbSnapshot | null>;
  route(callsign: string): Promise<RouteRecord | null>;
}

const API = process.env.ADSB_LOL_API_URL ?? "https://api.adsb.lol";
const ROUTES =
  process.env.ADSB_LOL_ROUTES_URL ?? "https://vrs-standing-data.adsb.lol";
/** Says who is asking, so ADSB.lol can tell us apart from a scraper. */
const AGENT = "Passport-Conference-Arrivals/0.1";

/** ADSB.lol's maximum radius for a point query. */
export const AREA_NM = 250;
const LIVE_TTL = 8_000;
const ROUTE_TTL = 12 * 3_600_000;
const PACE = 2_000;
const BACKOFF = 120_000;

interface Entry<T> {
  readonly at: number;
  readonly value: T;
}

export function adsbLol(fetcher: typeof fetch = fetch): AdsbSource {
  const cache = new Map<string, Entry<unknown>>();
  const inflight = new Map<string, Promise<unknown>>();
  let nextSlot = 0;
  let pausedUntil = 0;

  async function slot() {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + PACE;
    if (wait) await new Promise((r) => setTimeout(r, wait));
  }

  async function cached<T>(
    url: string,
    ttl: number,
    read: (body: unknown) => T,
    paced: boolean,
  ): Promise<T | null> {
    const hit = cache.get(url) as Entry<T> | undefined;
    if (hit && Date.now() - hit.at < ttl) return hit.value;
    if (paced && Date.now() < pausedUntil) return hit?.value ?? null;
    const pending = inflight.get(url) as Promise<T | null> | undefined;
    if (pending) return pending;
    const p = (async () => {
      try {
        if (paced) await slot();
        const r = await fetcher(url, {
          headers: { "User-Agent": AGENT, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        if (r.status === 404 && !paced) {
          const value = read(null);
          cache.set(url, { at: Date.now(), value });
          return value;
        }
        if (r.status === 429 || r.status >= 500) {
          pausedUntil = Date.now() + BACKOFF;
          console.warn(`[arrivals] ADSB.lol ${r.status}; pausing two minutes`);
          return hit?.value ?? null;
        }
        if (!r.ok) return hit?.value ?? null;
        const value = read(await r.json());
        cache.set(url, { at: Date.now(), value });
        return value;
      } catch (error) {
        console.warn("[arrivals] ADSB.lol request failed", url, error);
        return hit?.value ?? null;
      } finally {
        inflight.delete(url);
      }
    })();
    inflight.set(url, p);
    return p;
  }

  const safe = (s: string) => encodeURIComponent(s.trim().toUpperCase());
  return {
    around: (lat, lon) =>
      cached(
        `${API}/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${AREA_NM}`,
        LIVE_TTL,
        readSnapshot,
        true,
      ),
    byCallsign: (callsign) =>
      cached(
        `${API}/v2/callsign/${safe(callsign)}`,
        LIVE_TTL,
        readSnapshot,
        true,
      ),
    byHex: (hex) =>
      cached(
        `${API}/v2/hex/${encodeURIComponent(hex.toLowerCase())}`,
        LIVE_TTL,
        readSnapshot,
        true,
      ),
    route: (callsign) => {
      const cs = callsign.trim().toUpperCase();
      if (!/^[A-Z0-9]{3,8}$/.test(cs)) return Promise.resolve(null);
      return cached(
        `${ROUTES}/routes/${cs.slice(0, 2)}/${cs}.json`,
        ROUTE_TTL,
        readRoute,
        false,
      );
    },
  };
}

const g = globalThis as unknown as { __arrivalsAdsb?: AdsbSource };
/** One client per server process, so the cache and the pace are shared. */
export const adsb = (): AdsbSource => (g.__arrivalsAdsb ??= adsbLol());
