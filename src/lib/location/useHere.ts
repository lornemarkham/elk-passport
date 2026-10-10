"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_PLACE,
  blunt,
  type PlaceContext,
} from "@/domain/discovery/situation";
import type { TodayWeather } from "@/lib/environment/today";

/**
 * **"Where am I?", asked once, answered for this visit only.**
 *
 * ## The whole path a position takes
 *
 * ```
 * the person taps "Use my location"
 *   → navigator.geolocation.getCurrentPosition          (browser only)
 *   → blunt()  — rounded to ~1 km before anything is sent
 *   → POST /api/environment/here   { latitude, longitude }    (body, not URL)
 *   → mscProvider draws a 0.6° box, keeps the nearest MSC city
 *   → api.weather.gc.ca                                 (the only recipient)
 *   ← { wet, chance, description, source, area, km }     — no coordinates
 *   → React state in this hook                           — this visit only
 * ```
 *
 * It is written to no database, no cookie, no `localStorage`, no log line, and
 * no analytics call. Reloading the page forgets it. That is deliberate: a
 * question about this afternoon's sky does not need a permanent record of
 * where somebody was standing when they asked it, and a record that does not
 * exist cannot be leaked or subpoenaed.
 *
 * ## Asked once
 *
 * `ask` is only ever offered while `place.state` is `default`. Once it
 * resolves — granted, declined, or declined by a browser that has remembered a
 * previous "no" — the offer is gone for this visit. The surface shows what it
 * has and says what it does not. Re-prompting somebody who already said no is
 * how a product teaches people to say no permanently.
 *
 * `enableHighAccuracy` is deliberately off: a GPS fix is slower, costs
 * battery, and would be rounded away a line later anyway.
 *
 * ## Why support is read through `useSyncExternalStore`
 *
 * There is no `navigator` on the server, so reading it while rendering makes
 * the server and the browser disagree about the markup. This is precisely what
 * that hook is for: a server snapshot of `false` and a client snapshot read
 * after hydration, with React doing the reconciling. Capability never changes
 * once the page is open, so there is nothing to subscribe to.
 *
 * The offer therefore appears a tick after hydration — and the sentence beside
 * it does not move, because it is true either way.
 */
/** Capability does not change while a page is open. Nothing to subscribe to. */
const NEVER_CHANGES = () => () => {};

export function useHere(): {
  readonly place: PlaceContext;
  /** The reader's own forecast, present only once `place` is `observed`. */
  readonly weather?: TodayWeather;
  /** `undefined` where the browser cannot do this at all. */
  readonly ask?: () => void;
} {
  const [place, setPlace] = useState<PlaceContext>(DEFAULT_PLACE);
  const [weather, setWeather] = useState<TodayWeather>();
  const supported = useSyncExternalStore(
    NEVER_CHANGES,
    () => Boolean(navigator.geolocation),
    () => false,
  );

  const ask = useCallback(() => {
    setPlace({ state: "asking" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void (async () => {
          try {
            const response = await fetch("/api/environment/here", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(blunt(coords.latitude, coords.longitude)),
            });
            if (!response.ok) throw new Error(String(response.status));
            const body = (await response.json()) as {
              weather?: TodayWeather;
            };
            const area = body.weather?.area;
            if (!body.weather || !area) {
              // They shared where they are and there is no forecast for it.
              // Not an error and not a denial — the honest shape of a
              // Canada-only provider, and the surface says which it was.
              setPlace({ state: "unavailable", lapse: "no-forecast" });
              return;
            }
            setWeather(body.weather);
            setPlace({
              state: "observed",
              area,
              ...(body.weather.km !== undefined ? { km: body.weather.km } : {}),
            });
          } catch {
            setPlace({ state: "unavailable", lapse: "failed" });
          }
        })();
      },
      (error) => {
        setPlace({
          state: "unavailable",
          lapse: error.code === error.PERMISSION_DENIED ? "denied" : "failed",
        });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }, []);

  return {
    place,
    ...(weather ? { weather } : {}),
    // A browser that cannot do this is simply never offered it. The default
    // context stands, labelled as the default, and nothing is said about a
    // capability the reader cannot act on.
    ...(supported ? { ask } : {}),
  };
}
