import type { Experience } from "@/domain/experience/types";
import { distanceKm } from "@/lib/environment/geo";
import { activityByKey, activityEvidence } from "@/domain/discovery/activities";
import { distanceTo } from "@/domain/discovery/proximity";
import { clockWords, statedCloseOn } from "@/domain/occasion/hours";
import { isLightDisplay, onThatDay, type PinView } from "./lights/model";
import { bestOf } from "./lights/rank";
import { addDays } from "./when";

/**
 * **What else is near, beside Atlas's Christmas listings** (owner brief
 * "Christmas discovery UX repair", 2026-11-22):
 *
 * ```
 * lights on        the community map's displays, confirmed lit this
 *                  season by a person, on the days asked
 * popular nearby   displays families rated — the only popularity evidence
 *                  Passport holds; nothing is ranked "popular" without it
 * open this        restaurants whose own published hours have them open
 * evening          after 8 pm on the day asked — never guessed hours
 * ```
 *
 * Movies are deliberately absent: Atlas holds no showtimes, and a cinema
 * being open is not a film being on.
 */

type Point = { readonly latitude: number; readonly longitude: number };

export interface PinNear {
  readonly pin: PinView;
  readonly km: number;
}

/** Displays rated by at least this many people may be called popular. */
export const POPULAR_RATINGS = 3;
const POPULAR_SHELF = 6;
const LIGHTS_SHELF = 12;

function daysIn(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 14; d = addDays(d, 1)) out.push(d);
  return out;
}

export function lightsNear(
  pins: readonly PinView[],
  origin: Point,
  km: number,
  days?: { readonly from: string; readonly to: string },
): { readonly on: readonly PinNear[]; readonly popular: readonly PinNear[] } {
  const inside = new Map<string, number>();
  for (const p of pins) {
    if (p.status !== "approved" || !isLightDisplay(p.kind)) continue;
    const d = distanceKm(origin, { latitude: p.at.lat, longitude: p.at.lng });
    if (d <= km) inside.set(p.id, d);
  }
  const near = pins.filter((p) => inside.has(p.id));
  const withKm = (pin: PinView) => ({ pin, km: inside.get(pin.id)! });
  const popular = bestOf(
    near,
    (v) => (v.rating?.count ?? 0) >= POPULAR_RATINGS,
    POPULAR_SHELF,
  ).map(withKm);
  // Lit this season, and — where days were asked — on one of them.
  const on = near
    .filter(
      (p) =>
        p.season === "lit" &&
        (!days || daysIn(days.from, days.to).some((d) => onThatDay(p, d))),
    )
    .map(withKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, LIGHTS_SHELF);
  return { on, popular };
}

export interface OpenEvening {
  readonly experience: Experience;
  readonly km: number;
  /** "Open till 9:00 pm Sunday, by its own hours". */
  readonly hours: string;
}

/** Open after this, by its own hours, is open for the evening. */
const EVENING = 20 * 60;
const EVENING_SHELF = 8;

export function openThisEvening(
  experiences: readonly Experience[],
  origin: Point,
  km: number,
  day: string,
): readonly OpenEvening[] {
  const restaurants = activityByKey("restaurants");
  if (!restaurants) return [];
  const weekday = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
  const out: OpenEvening[] = [];
  for (const e of experiences) {
    if (activityEvidence(e, restaurants).length === 0) continue;
    const d = distanceTo(e, origin);
    if (d === undefined || d > km) continue;
    if (
      e.schedule?.onDate?.date === day &&
      e.schedule.onDate.reading === "not-on"
    )
      continue;
    const close = statedCloseOn(e, day);
    if (!close || close.closed) continue;
    // After midnight ("till 1:00 am") is later still.
    if (close.minutes < EVENING && close.minutes >= 4 * 60) continue;
    out.push({
      experience: e,
      km: d,
      hours: `Open till ${clockWords(close.minutes)} ${weekday}, by its own hours`,
    });
  }
  return out.sort((a, b) => a.km - b.km).slice(0, EVENING_SHELF);
}
