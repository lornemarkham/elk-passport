import type { Experience } from "@/domain/experience/types";
import {
  activityEvidence,
  activityIn,
  inSeason,
  seasonLine,
  type Activity,
} from "@/domain/discovery/activities";
import { statedCloseOn, clockWords } from "./hours";

/**
 * **"Go ice skating" is an idea; Priest Valley Arena is a plan.**
 *
 * Somebody types an idea into an adventure. It used to become a card that
 * said "go ice skating" and nothing else. This reads the idea with
 * Discovery's own activity vocabulary (`activityIn` — the same reader as
 * the sentence box and the explorer, ADR 007), finds the places Atlas's own
 * words put in that activity near the adventure, and hands back what a
 * person needs to pick one: a picture, how far, what Atlas lists there, and
 * any hours, prices or rentals the place itself published.
 *
 * Nothing here is invented. A place is offered only where Atlas lists a
 * word for the activity (`activityEvidence`); a fact is shown only in the
 * publisher's words; and where Atlas holds no times or prices for any of
 * them, the answer says so and names the next step rather than filling the
 * gap.
 */

export interface PlaceFact {
  readonly label: string;
  readonly value: string;
}

export interface PlaceOption {
  readonly experience: Experience;
  /** Straight-line km from the adventure's town, where Atlas places it. */
  readonly km?: number;
  /** The Atlas words that put it in the activity — "Public skating". */
  readonly listed: readonly string[];
  /** Hours, admission, rentals, sessions — the publisher's own words. */
  readonly facts: readonly PlaceFact[];
  /** Its stated hours on the adventure's day, where it states them. */
  readonly onTheDay?: string;
}

export interface IdeaAnswer {
  readonly said: string;
  /** The activity Passport recognised, in Passport's words. */
  readonly activity?: { readonly key: string; readonly label: string };
  /** Near first, measured before unmeasured. At most `limit`. */
  readonly options: readonly PlaceOption[];
  /** Further away than the adventure's circle — the nearest few. */
  readonly further: readonly PlaceOption[];
  /** It is usually another time of year, said rather than hidden. */
  readonly season?: string;
  /** What Atlas does not hold for these places, in one sentence. */
  readonly gap?: string;
}

export interface IdeaContext {
  readonly origin?: { readonly latitude: number; readonly longitude: number };
  /** "Vernon" — said back, and used to keep a placeless match in town. */
  readonly town?: string;
  /** `YYYY-MM-DD`, the adventure's day, where it has one. */
  readonly on?: string;
  readonly km?: number;
  readonly limit?: number;
}

const USEFUL_FACT =
  /\b(hours?|open|opening|admission|price|prices|cost|fees?|tickets?|rates?|rentals?|rent|skate|skating|session|drop[- ]?in|schedule|book|booking|reserv\w*|lessons?|passes?|lift)\b/i;

const SEASON_SHUT =
  /\bclosed (?:for|until) the (?:season|spring|summer|winter)\b|\bseason(?:al)? closure\b/i;

const NOT_A_FACT =
  /\b(history|award|built|founded|named after|donated|construction|capacity|seats?)\b/i;

function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const pointOf = (e: Experience) => {
  const c = e.geography?.coordinates;
  return c ? { latitude: c[1], longitude: c[0] } : undefined;
};

/** What the place published that helps somebody go: hours, prices, rentals. */
export function usefulFacts(e: Experience): PlaceFact[] {
  const out: PlaceFact[] = [];
  for (const p of e.knowledge?.practical ?? []) {
    const label = p.label?.trim();
    const value = p.value?.trim();
    if (!label || !value) continue;
    if (NOT_A_FACT.test(label)) continue;
    if (!USEFUL_FACT.test(label) && !USEFUL_FACT.test(value.slice(0, 80)))
      continue;
    out.push({
      label,
      value: value.length > 220 ? `${value.slice(0, 217)}…` : value,
    });
  }
  for (const s of e.schedule?.statements ?? []) {
    if (s.scope && s.scope !== "subject") continue;
    if (!out.some((f) => f.value === s.text))
      out.push({ label: "Hours", value: s.text });
  }
  return out.slice(0, 4);
}

/** A place said by its own words to have been something else first, sorts below. */
const strength = (listed: readonly string[]) =>
  listed.some((w) => /\b(public|free|drop[- ]?in|family|open)\b/i.test(w))
    ? 1
    : 0;

/**
 * **The activity in an idea — unless the idea already names where.**
 * "Dinner at Mom's" and "breakfast at home" are somebody's own place; a
 * list of restaurants would be an answer to a question nobody asked.
 */
export function ideaActivity(said: string): Activity | undefined {
  if (
    /\bat (?:my |our |the )?[a-z]+(?:'|’)s\b|\bat home\b|\bat (?:my|our) place\b/i.test(
      said,
    )
  )
    return undefined;
  return activityIn(said);
}

export function findPlacesFor(
  said: string,
  pool: readonly Experience[],
  context: IdeaContext = {},
): IdeaAnswer {
  const activity: Activity | undefined = ideaActivity(said);
  if (!activity) return { said, options: [], further: [] };
  const km = context.km ?? 40;
  const limit = context.limit ?? 5;
  const town = context.town?.toLowerCase();

  const scored = pool.flatMap((e) => {
    const listed = activityEvidence(e, activity);
    if (listed.length === 0) return [];
    const here = pointOf(e);
    const away =
      context.origin && here ? distanceKm(context.origin, here) : undefined;
    const inTown =
      town !== undefined &&
      (e.geography?.locality ?? "").toLowerCase() === town;
    const close = context.on ? statedCloseOn(e, context.on) : undefined;
    const facts = usefulFacts(e);
    const shut = facts.find((f) => SEASON_SHUT.test(f.value));
    const option: PlaceOption = {
      experience: e,
      ...(away !== undefined ? { km: Math.round(away * 10) / 10 } : {}),
      listed,
      facts,
      ...(shut
        ? {
            onTheDay:
              "Its own note says it's closed for the season — check it has reopened.",
          }
        : close
          ? {
              onTheDay: close.closed
                ? "Closed that day, by its own hours."
                : `Open till ${clockWords(close.minutes)} that day, by its own hours.`,
            }
          : {}),
    };
    return [{ option, away, inTown, shut: Boolean(shut || close?.closed) }];
  });

  const near = scored
    .filter(
      (s) =>
        (s.away !== undefined && s.away <= km) ||
        (s.away === undefined && (s.inTown || !context.origin)),
    )
    .sort((a, b) => {
      const measured = (x: typeof a) => (x.away !== undefined ? 0 : 1);
      // Near first; a place that says "public skating" counts as 5 km closer.
      const reach = (x: typeof a) =>
        (x.away ?? 0) - 5 * strength(x.option.listed) + (x.shut ? 100 : 0);
      return (
        Number(a.shut) - Number(b.shut) ||
        measured(a) - measured(b) ||
        reach(a) - reach(b) ||
        Number(Boolean(b.option.experience.heroMedia?.src)) -
          Number(Boolean(a.option.experience.heroMedia?.src))
      );
    })
    .map((s) => s.option);
  const options = dedupe(near).slice(0, limit);
  const further =
    options.length > 0
      ? []
      : scored
          .filter((s) => s.away !== undefined && s.away > km)
          .sort((a, b) => a.away! - b.away!)
          .map((s) => s.option)
          .slice(0, 3);

  const shown = options.length > 0 ? options : further;
  const label = activity.label.toLowerCase();
  const gap =
    shown.length === 0
      ? `Atlas doesn't hold anywhere for ${label}${context.town ? ` near ${context.town}` : ""} yet. Keep it as your own idea — you can add the place by name.`
      : shown.every((o) => o.facts.length === 0 && !o.onTheDay)
        ? `Atlas doesn't hold times or prices for ${label} at ${shown.length === 1 ? "this place" : "these places"} — check with the venue before you go.`
        : undefined;

  return {
    said,
    activity: { key: activity.key, label: activity.label },
    options,
    further,
    ...(!inSeason(activity, context.on) && seasonLine(activity)
      ? { season: `${activity.label} is usually ${seasonLine(activity)}.` }
      : {}),
    ...(gap ? { gap } : {}),
  };
}

/** Atlas sometimes holds a place and its operator separately; show one. */
function dedupe(options: readonly PlaceOption[]): PlaceOption[] {
  const seen = new Set<string>();
  const out: PlaceOption[] = [];
  const keyOf = (o: PlaceOption) =>
    o.experience.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\b(the|centre|center|inc|ltd)\b/g, "")
      .trim();
  // A season closure Atlas holds on either record belongs to both.
  const shutNote = new Map<string, string>();
  for (const o of options)
    if (o.onTheDay?.includes("closed for the season"))
      shutNote.set(keyOf(o), o.onTheDay);
  for (const raw of options) {
    const note = shutNote.get(keyOf(raw));
    const o = note ? { ...raw, onTheDay: note } : raw;
    const key = keyOf(o);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}
