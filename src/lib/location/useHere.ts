"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_PLACE,
  blunt,
  type PlaceContext,
  type Point,
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
 * The blunted point itself is **kept in memory for the visit**, because the
 * page also asks "which of these is near me" and that is arithmetic done here
 * in the browser against coordinates Atlas already published. It is never sent
 * anywhere for that purpose — no second request, no coordinate ever leaves
 * again — and it is still written to nothing.
 *
 * It is written to no database, no cookie, no `localStorage`, no log line, and
 * no analytics call. Reloading the page forgets it. That is deliberate: a
 * question about this afternoon's sky does not need a permanent record of
 * where somebody was standing when they asked it, and a record that does not
 * exist cannot be leaked or subpoenaed.
 *
 * ## Asked once
 *
 * `ask` is returned **only** while `place.state` is `default`. Once the asking
 * starts — and once it resolves, granted or declined or declined by a browser
 * that remembered a previous "no" — the offer is gone for this visit, and it
 * is gone here rather than in each surface's JSX. Re-prompting somebody who
 * already said no is how a product teaches people to say no permanently, and
 * that rule is worth one enforcement rather than one per caller.
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
  /**
   * Their blunted position, present as soon as the browser gives one.
   *
   * Deliberately **not** conditional on `place.state`: a forecast Environment
   * Canada could not answer says nothing about whether the position is known.
   *
   * In memory, in the browser, for this visit. Read by `proximity.ts` to work
   * out what Atlas has placed within reach; sent nowhere.
   */
  readonly at?: Point;
  /**
   * `undefined` where the browser cannot do this, **and** once it has been
   * asked. A surface renders the offer wherever this is present and does not
   * carry the once-only rule itself.
   */
  readonly ask?: () => void;
} {
  const [place, setPlace] = useState<PlaceContext>(DEFAULT_PLACE);
  const [weather, setWeather] = useState<TodayWeather>();
  const [at, setAt] = useState<Point>();
  const supported = useSyncExternalStore(
    NEVER_CHANGES,
    () => Boolean(navigator.geolocation),
    () => false,
  );

  const ask = useCallback(() => {
    setPlace({ state: "asking" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = blunt(coords.latitude, coords.longitude);
        // **Set before the forecast is asked for, not after it answers.**
        // Where somebody is and what the sky is doing are different facts, and
        // the first version made the second a precondition for the first — so
        // a minute when Environment Canada was unreachable also hid every
        // possibility Passport could place near them. Nothing about a weather
        // outage makes a position less known.
        setAt(point);
        void (async () => {
          try {
            const response = await fetch("/api/environment/here", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(point),
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
    ...(at ? { at } : {}),
    // A browser that cannot do this is simply never offered it, and neither
    // is one that has already been asked. The default context stands,
    // labelled as the default.
    ...(supported && place.state === "default" ? { ask } : {}),
  };
}
