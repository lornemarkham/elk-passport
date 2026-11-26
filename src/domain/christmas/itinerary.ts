import type { Experience } from "@/domain/experience/types";
import {
  activityByKey,
  activityEvidence,
  type Activity,
} from "@/domain/discovery/activities";
import { distanceTo } from "@/domain/discovery/proximity";
import { subjectHref } from "@/domain/experience/destination";
import { statedDay, ZONE } from "@/domain/experience/eventTime";
import { cardPictures, type CardPicture } from "@/lib/media/cardPicture";
import { isIllustrative } from "@/domain/discovery/illustrations";
import { statedCloseOn, clockWords } from "@/domain/occasion/hours";
import { wallMinutes, zonedInstant } from "@/domain/date-night/conditions";
import { usefulFacts } from "@/domain/occasion/ideas";
import { priceOf, titleKey } from "./discover";
import { readChristmas, type ChristmasReading, type ThemeId } from "./themes";
import { addDays, readWhen, type WhenReading } from "./when";
import { dayLabel } from "./plans";
import {
  KIND_LABEL,
  onThatDay,
  type Kind,
  type LatLng,
  type PinView,
} from "./lights/model";
import {
  directionsUrl,
  leg,
  order,
  timeTour,
  type Stop as TourStop,
} from "./lights/tour";
import { type Edits } from "./edits";
export {
  clockText,
  durationText,
  readEdits,
  writeEdits,
  type Edits,
} from "./edits";
import {
  NEED_EMOJI,
  NEED_LABEL,
  titleFor,
  type Need,
  type Request,
} from "./request";

/**
 * **A Christmas itinerary that does what was asked.**
 *
 * Every part somebody asked for (`readRequest`) becomes one stop, and each
 * stop is either a real place that fits — or it is shown **unresolved**, with
 * the reason, and never filled with something else because Atlas happened to
 * have it. "Romantic night of lights, dinner and a movie" is a restaurant, a
 * lights tour and a cinema, or it is a restaurant, a lights tour and *"Atlas
 * lists no cinema within 25 km of Vernon — the nearest it knows is in
 * Kelowna, 45 km"* (owner brief, Christmas Experience 2.0, 2026-11-14).
 *
 * Where the facts come from, and nothing else:
 *
 * - **Atlas** — places and events, by Atlas's own words for what they are
 *   (Discovery's `activityEvidence`, Christmas's `readChristmas`), its dates
 *   (`readWhen`), the place's own published hours (`statedCloseOn`), its
 *   distance reading (ADR 094) and its pictures (`cardPictures`, stand-ins
 *   left out).
 * - **The community lights map** — displays a person reviewed and published,
 *   lit this season, on that day (`tourable`'s rule). Labelled as such, never
 *   mixed into Atlas's evidence (doctrine §12, locals).
 *
 * Never invented: showtimes, hours, prices, that something is on. Where
 * Atlas holds no hours the stop says so; a movie's time is "about", with the
 * cinema's own listings named as the place to check.
 *
 * Ranking, in the brief's order: **intent** (the words that put it in the
 * part) → **availability** (on that day, open then) → **geography** (near
 * the last stop) → **evidence** (a real picture, published facts) →
 * **experience** (a sit-down dinner over a pizza counter for a date). Pure:
 * no clock, no network.
 */

// ------------------------------------------------------------------ types

export interface Origin {
  readonly latitude: number;
  readonly longitude: number;
  /** "Vernon" */
  readonly name: string;
  readonly id: string;
}

export interface Sources {
  /** The whole Atlas pool, with distance readings where Discovery has them. */
  readonly experiences: readonly Experience[];
  /** Pins this visitor may see (`visible`), published or not. */
  readonly pins: readonly PinView[];
  readonly origin: Origin;
  /** `YYYY-MM-DD`, Pacific. */
  readonly today: string;
  /** How far somebody said they will drive (the 2–50 km choice). */
  readonly reachKm?: number;
}

export interface Place {
  readonly ref: string;
  readonly source: "atlas" | "map";
  readonly title: string;
  /** What it is: "Restaurant", "Public display", "Christmas market". */
  readonly what: string;
  /** "Vernon" or the address a reviewer published. */
  readonly where?: string;
  /** Straight-line km from the starting town. */
  readonly km?: number;
  readonly at?: LatLng;
  readonly pictures: readonly CardPicture[];
  readonly href: string;
  /** Why it is in this part, in Atlas's (or the map's) words. */
  readonly why: string;
  /** Its dates, when it has them. */
  readonly when?: string;
  /** Its hours that day, in its own words — or that Atlas holds none. */
  readonly hours?: string;
  readonly description?: string;
  readonly price?: string;
  readonly free?: boolean;
  /** What part it would be if added from "nearby". */
  readonly as?: Need;
}

export interface Travel {
  readonly km: number;
  readonly minutes: number;
}

export interface ItineraryStop {
  readonly need: Need;
  readonly label: string;
  readonly emoji: string;
  /** Asked for in so many words, or added by Passport. */
  readonly said: boolean;
  readonly status: "planned" | "unresolved";
  /** Minutes after midnight. */
  readonly time?: number;
  /** "about" for a movie (no showtimes), "starts" for an event's own time. */
  readonly timeIs?: "about" | "starts";
  readonly minutes?: number;
  readonly travel?: Travel;
  readonly place?: Place;
  /** A lights tour's displays, in driving order. */
  readonly displays?: readonly Place[];
  readonly directions?: string;
  readonly notes: readonly string[];
  readonly alternatives: readonly Place[];
  readonly nearby: readonly Place[];
  /** Why it could not be planned. */
  readonly reason?: string;
  /** The nearest real option outside the circle, offered, not chosen. */
  readonly nearest?: Place;
  /** A day it can be planned, when this day is the problem. */
  readonly tryDay?: {
    readonly day: string;
    readonly label: string;
    readonly why: string;
  };
}

export interface Question {
  readonly id: "day";
  readonly ask: string;
  readonly options: readonly { readonly day: string; readonly label: string }[];
}

export interface Itinerary {
  readonly title: string;
  readonly day: string;
  readonly dayLabel: string;
  /** The day was assumed, not said — the one question asked. */
  readonly question?: Question;
  readonly from: Origin;
  readonly mode: "drive" | "walk";
  readonly reachKm: number;
  readonly stops: readonly ItineraryStop[];
  readonly start?: number;
  /** When to set out from the starting town for the first stop. */
  readonly leaveAt?: number;
  readonly end?: number;
  readonly totalMinutes: number;
  readonly km: number;
  readonly who?: string;
  readonly budget?: string;
  readonly homeBy?: string;
  /** An accessibility need that was said, with what Passport can and can't confirm. */
  readonly access?: string;
  readonly planned: number;
  readonly unresolved: number;
}

// --------------------------------------------------------------- the parts

/** Discovery's activity for each part that is a kind of place. */
const ACTIVITY: Partial<Record<Need, string>> = {
  breakfast: "restaurants",
  lunch: "restaurants",
  dinner: "restaurants",
  coffee: "coffee",
  drinks: "bars",
  movie: "movies",
  skating: "skating",
};

/** Christmas's theme for each part that is a Christmas thing. */
const THEME: Partial<Record<Need, ThemeId>> = {
  lights: "lights",
  market: "markets",
  santa: "santa",
  show: "shows",
  festival: "festivals",
};

/** Map kinds that are each part. */
const PIN_KINDS: Partial<Record<Need, readonly Kind[]>> = {
  lights: ["public-display", "neighbourhood", "home", "community-tree"],
  market: ["market"],
  festival: ["festive-attraction"],
};

/** When each part usually starts, minutes after midnight, and how long it takes. */
const NOMINAL: Readonly<Record<Need, { at: number; minutes: number }>> = {
  breakfast: { at: 9 * 60, minutes: 60 },
  santa: { at: 10 * 60 + 30, minutes: 45 },
  lunch: { at: 12 * 60, minutes: 60 },
  market: { at: 13 * 60 + 30, minutes: 75 },
  skating: { at: 15 * 60, minutes: 60 },
  coffee: { at: 15 * 60 + 30, minutes: 30 },
  festival: { at: 17 * 60, minutes: 90 },
  dinner: { at: 17 * 60 + 30, minutes: 90 },
  lights: { at: 19 * 60, minutes: 50 },
  show: { at: 19 * 60 + 30, minutes: 120 },
  movie: { at: 20 * 60 + 30, minutes: 150 },
  drinks: { at: 21 * 60 + 30, minutes: 60 },
};

const NOUN: Partial<Record<Need, string>> = {
  santa: "Santa visit",
  show: "Christmas show",
  festival: "Christmas festival",
  market: "Christmas market",
};

/** Lights are after dark: Okanagan sunset is ~4:20 pm in December. */
const DARK = 17 * 60;
const DRIVE_REACH = 25;
const WALK_REACH = 2.5;
/** How far "the nearest one" may be offered from. */
const FURTHEST = 80;
const NEARBY_KM = 1.5;
const LIGHTS_NAME =
  /\b(lights?|illuminations?|light[- ]?ups?|luminar\w*|glow)\b/i;
const NOT_A_DISPLAY = /\b(yoga|class|workshop|sale|paint|fundraiser|craft)\b/i;

/** Not what a date night means by "dinner" — ordering only, never a claim. */
const COUNTER =
  /\b(pub|bar (and|&) grill|grill (and|&) bar|sports|wings|pizza|pizzeria|diner|fast food|food truck|sports (bar|club)|buffet|takeout|take-out|drive[- ]thru|mcdonald|a&w|tim hortons|subway|wendy|burger king|dairy queen|kfc)\b/i;
const CHAIN =
  /\b(mcdonald|mccaf|tim hortons|starbucks|a&w|subway|dairy queen)\b/i;

// ---------------------------------------------------------------- helpers

const pointOf = (e: Experience): LatLng | undefined => {
  const c = e.geography?.coordinates;
  return c && typeof c[0] === "number" && typeof c[1] === "number"
    ? { lat: c[1], lng: c[0] }
    : undefined;
};

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * A plan's pictures: the thing's own, or one Atlas is sure of. An offered
 * picture that is neither exact nor high-confidence is left out (M1128: an
 * organisation's summer-patio photograph, "not verified to show", stood for a
 * Christmas dinner) — the stop is text rather than a misleading picture.
 */
const realPictures = (e: Experience): CardPicture[] =>
  cardPictures(e).filter((p) => {
    const offered = e.presentationImage;
    if (!offered || p.src !== offered.url) return true;
    if (isIllustrative(offered)) return false;
    return offered.relationship === "exact" || offered.confidence === "high";
  });

/**
 * **One place, listed twice** (M1128: three RANGE Restaurant records a few
 * metres apart). Names where one is the other with more words, within half a
 * kilometre, are one alternative, not two.
 */
function samePlace(a: Place, b: Place): boolean {
  const ka = titleKey(a.title);
  const kb = titleKey(b.title);
  if (!ka || !kb || !(ka.startsWith(kb) || kb.startsWith(ka))) return false;
  return a.at && b.at ? haversine(a.at, b.at) <= 0.5 : false;
}

function distinctPlaces(list: readonly Place[], besides: Place): Place[] {
  const out: Place[] = [];
  for (const p of list)
    if (!samePlace(p, besides) && !out.some((o) => samePlace(o, p)))
      out.push(p);
  return out;
}

/** An event's stated clock time, on the Okanagan's wall (BC's legal offset). */
function eventMinutes(at: string | undefined): number | undefined {
  if (!at) return undefined;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return undefined;
  return wallMinutes(d, ZONE);
}

function firstSentence(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  const cut = clean.match(/^(.{20,180}?[.!?])(\s|$)/)?.[1] ?? clean;
  return cut.length > 180 ? `${cut.slice(0, 177)}…` : cut;
}

const roundUp5 = (m: number) => Math.ceil(m / 5) * 5;

// --------------------------------------------------------- the candidates

interface Candidate {
  readonly place: Place;
  /** 0–3: how squarely Atlas's words put it in the part. */
  readonly intent: number;
  /** 0–3: on that day / open then (3), check (2), unknown hours (1). */
  readonly availability: number;
  /** Minutes after midnight it starts, when an event states it. */
  readonly fixed?: number;
  /** Minutes after midnight it closes or ends, when stated. */
  readonly closes?: number;
  readonly quality: number;
  readonly minutes?: number;
  readonly light?: TourStop;
}

interface Pool {
  readonly near: Candidate[];
  readonly further: Candidate[];
  /** Real things excluded on this day, for the reason. */
  readonly offDay: number;
  readonly closed: number;
}

interface Context {
  readonly sources: Sources;
  readonly day: string;
  readonly reach: number;
  readonly request: Request;
  readonly readings: ReadonlyMap<Experience, ChristmasReading | null>;
}

function atlasPlace(
  e: Experience,
  origin: Origin,
  why: string,
  extra: Partial<Place> = {},
): Place {
  const km = distanceTo(e, origin);
  const at = pointOf(e);
  const { price, free } = priceOf(e);
  const where = e.geography?.locality;
  const description = firstSentence(e.description);
  return {
    ref: `atlas:${e.id}`,
    source: "atlas",
    title: e.title,
    what: (e.subtype ?? e.kind)
      .replace(/[_-]+/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase()),
    ...(where ? { where } : {}),
    ...(km !== undefined ? { km: Math.round(km * 10) / 10 } : {}),
    ...(at ? { at } : {}),
    pictures: realPictures(e).slice(0, 3),
    href: subjectHref(e.kind, e.id),
    why,
    ...(description ? { description } : {}),
    ...(price ? { price } : {}),
    ...(free ? { free } : {}),
    ...extra,
  };
}

/**
 * A community pin as a stop. A home's photograph stays on the lights map,
 * where it is labelled as a neighbour's display; on a plan it never stands
 * as the picture of an evening out (M1128: a driveway led a romantic tour).
 */
function pinPlace(p: PinView, origin: Origin): Place {
  const km = haversine({ lat: origin.latitude, lng: origin.longitude }, p.at);
  return {
    ref: `map:${p.id}`,
    source: "map",
    title: p.name,
    what: KIND_LABEL[p.kind],
    ...(p.address ? { where: p.address } : {}),
    km: Math.round(km * 10) / 10,
    at: p.at,
    pictures:
      p.hasPhoto && p.kind !== "home"
        ? [{ src: `/christmas/api/lights/${p.id}/photo`, alt: p.name }]
        : [],
    href: `/christmas/lights/${p.id}`,
    why: "On the community lights map — checked by a person",
    ...(p.hours ? { hours: `Viewing: ${p.hours}` } : {}),
    ...(p.description ? { description: firstSentence(p.description)! } : {}),
  };
}

/** May go on a plan for `day`: published, lit this season, on that day. */
const pinOn = (p: PinView, day: string) =>
  p.status === "approved" && p.season === "lit" && onThatDay(p, day);

function hoursOn(e: Experience, day: string) {
  const close = statedCloseOn(e, day);
  const weekday = dayLabel(day).split(",")[0];
  if (!close) return { hours: "Hours not listed — check before you go" };
  if (close.closed)
    return {
      closed: true as const,
      hours: `Closed ${weekday}, by its own hours`,
    };
  return {
    closes: close.minutes,
    hours: `Open till ${clockWords(close.minutes)} ${weekday}, by its own hours`,
  };
}

/** Whether a dated event or a dated Christmas thing is on that day. */
function onDay(when: WhenReading, day: string): "dated" | "check" | false {
  if (when.confidence === "past" || when.confidence === "unconfirmed")
    return false;
  if (when.from && when.to)
    return day >= when.from && day <= when.to
      ? when.confidence === "dated"
        ? "dated"
        : "check"
      : false;
  return when.confidence === "check" ? "check" : false;
}

function candidatesFor(need: Need, ctx: Context): Pool {
  const { sources, day, reach, request } = ctx;
  const origin = sources.origin;
  const town = origin.name.toLowerCase();
  const out: { c: Candidate; km?: number }[] = [];
  let offDay = 0;
  let closed = 0;

  const activity: Activity | undefined = ACTIVITY[need]
    ? activityByKey(ACTIVITY[need])
    : undefined;
  const theme = THEME[need];

  for (const e of sources.experiences) {
    let intent = 0;
    let why = "";
    if (activity) {
      const words = activityEvidence(e, activity);
      if (words.length === 0) continue;
      const subtype = (e.subtype ?? "").replace(/[_-]+/g, " ").toLowerCase();
      intent = words.some((w) => w.toLowerCase() === subtype) ? 3 : 2;
      why = `Listed as ${words.slice(0, 2).join(", ").toLowerCase()}`;
    } else if (theme) {
      const reading = ctx.readings.get(e);
      if (!reading || !reading.themes.includes(theme)) continue;
      if (!reading.christmas && theme !== "lights") continue;
      // A display, by what it is called — not a yoga class that "twinkles"
      // or a garage sale that sells lights.
      if (
        need === "lights" &&
        (!LIGHTS_NAME.test(`${e.title} ${e.subtype ?? ""}`) ||
          NOT_A_DISPLAY.test(e.title) ||
          // A winery's "Holiday Light-Up" tasting is a tasting (M1128).
          /\b(tastings?|wine|winery|vineyards?)\b/i.test(e.title))
      )
        continue;
      const evidence = reading.evidence[0];
      intent =
        evidence?.field === "name"
          ? 3
          : evidence?.field === "subtype"
            ? 2.5
            : 2;
      why = evidence ? `Matches “${evidence.word}”` : "A Christmas listing";
    } else continue;

    const km = distanceTo(e, origin);
    const inTown = (e.geography?.locality ?? "").toLowerCase() === town;
    if (km === undefined && !inTown) continue;
    if (km !== undefined && km > FURTHEST) continue;

    // Availability on the day.
    let availability = 1;
    let fixed: number | undefined;
    let closes: number | undefined;
    let whenLine: string | undefined;
    let hours: string | undefined;
    const isEvent = e.kind === "Event";
    if (isEvent || theme) {
      const when = readWhen(e, sources.today);
      const on = onDay(when, day);
      if (!on) {
        if (when.confidence !== "past" && (km === undefined || km <= reach))
          offDay += 1;
        continue;
      }
      availability = on === "dated" ? 3 : 2;
      whenLine = when.line;
      if (isEvent && when.from === when.to && e.timePrecision === "minute") {
        fixed = eventMinutes(e.startTime);
        const end = e.endTime ? eventMinutes(e.endTime) : undefined;
        if (end !== undefined && statedDay(e.endTime, e.timePrecision) === day)
          closes = end;
      }
      if (on === "check")
        hours = "Dates are listed, not the hours — check before you go";
    }
    if (!isEvent) {
      const h = hoursOn(e, day);
      if (h.closed) {
        closed += 1;
        continue;
      }
      const shut = usefulFacts(e).find((f) =>
        /\bclosed (for|until) the (season|spring|summer|winter)\b|\bseason(al)? closure\b/i.test(
          f.value,
        ),
      );
      if (shut) {
        closed += 1;
        continue;
      }
      if (h.closes !== undefined) {
        closes = h.closes;
        availability = Math.max(availability, 3);
      }
      hours = hours ?? h.hours;
    }

    let quality = 0;
    const name = `${e.title} ${e.subtype ?? ""}`;
    // A *romantic* dinner is part of what was asked: a pub counter is a
    // weaker match for it, not merely a lesser one.
    if (
      (request.romantic || request.party === "couple") &&
      need === "dinner" &&
      COUNTER.test(name)
    )
      intent -= 1;
    if (CHAIN.test(e.title)) quality -= 1;
    if (
      need === "dinner" &&
      /\b(breakfast|brunch|bakery|cafe|café|coffee)\b/i.test(name)
    )
      quality -= 1;
    // Its own description says what it is for (M1128: "a spot for a
    // leisurely breakfast" planned as a romantic dinner). A place that says
    // breakfast, brunch or lunch and never dinner is a weak dinner, and no
    // date's.
    if (
      need === "dinner" &&
      /\b(breakfast|brunch|lunch|bakery|deli|café|cafe|coffee)\b/i.test(
        e.description ?? "",
      ) &&
      !/\b(dinner|supper|evening)\b/i.test(e.description ?? "")
    ) {
      quality -= 2;
      if (request.romantic || request.party === "couple") intent -= 1;
    }
    const { free } = priceOf(e);
    if (request.budget !== undefined && free) quality += 1;
    if (
      request.party === "family" &&
      /\b(pub|bar|lounge|nightclub|tavern)\b/i.test(name)
    )
      quality -= 2;

    const place = atlasPlace(e, origin, why, {
      ...(whenLine ? { when: whenLine } : {}),
      ...(hours ? { hours } : {}),
    });
    out.push({
      c: {
        place,
        intent,
        availability,
        ...(fixed !== undefined ? { fixed } : {}),
        ...(closes !== undefined ? { closes } : {}),
        quality,
        ...(e.visitDuration?.basis === "explicit" && e.visitDuration.minutes
          ? { minutes: Math.min(240, Math.max(30, e.visitDuration.minutes[1])) }
          : {}),
        ...(need === "lights" && place.at
          ? {
              light: {
                id: place.ref,
                name: e.title,
                at: place.at,
                kind: "atlas" as const,
                label: place.what,
              },
            }
          : {}),
      },
      ...(km !== undefined ? { km } : {}),
    });
  }

  for (const p of sources.pins) {
    const kinds = PIN_KINDS[need];
    if (!kinds || !kinds.includes(p.kind)) continue;
    if (need === "festival" && !(p.dates && p.dates.from === p.dates.to))
      continue;
    if (!pinOn(p, day)) {
      if (
        p.status === "approved" &&
        haversine({ lat: origin.latitude, lng: origin.longitude }, p.at) <=
          reach
      )
        offDay += 1;
      continue;
    }
    const place = pinPlace(p, origin);
    out.push({
      c: {
        place,
        intent: 2.5,
        availability: p.dates ? 3 : 2,
        // A public display leads a date's lights; a private home may follow.
        quality:
          Math.min(1, p.total / 5) -
          (p.kind === "home" && (request.romantic || request.party === "couple")
            ? 1
            : 0),
        ...(need === "lights"
          ? {
              light: {
                id: place.ref,
                name: p.name,
                at: p.at,
                kind: p.kind,
                features: p.features,
                love: p.total,
              },
            }
          : {}),
      },
      km: place.km,
    });
  }

  const near = out
    .filter((o) => o.km === undefined || o.km <= reach)
    .map((o) => o.c);
  const further = out
    .filter((o) => o.km !== undefined && o.km > reach)
    .sort((a, b) => a.km! - b.km!)
    .map((o) => o.c);
  return { near, further, offDay, closed };
}

function score(c: Candidate, from: LatLng): number {
  const km = c.place.at ? haversine(from, c.place.at) : (c.place.km ?? 10);
  const geo = Math.max(0, 10 - km / 2.5);
  const evidence =
    (c.place.pictures.length ? 1 : 0) +
    (c.place.hours && !/not listed|check before/.test(c.place.hours) ? 0.5 : 0);
  return (
    c.intent * 100 +
    c.availability * 20 +
    geo * 3 +
    evidence * 2 +
    c.quality * 5
  );
}

// ---------------------------------------------------------------- schedule

function sortKey(need: Need, needs: readonly Need[]): number {
  if (need === "coffee" && needs.includes("lights") && needs.includes("dinner"))
    return 19 * 60 - 5; // a warm cup between dinner and the lights
  if (
    need === "market" &&
    needs.every((n) =>
      ["market", "dinner", "lights", "drinks", "movie", "coffee"].includes(n),
    ) &&
    needs.includes("lights") &&
    !needs.includes("lunch")
  )
    return 16 * 60; // an afternoon market before an evening
  return NOMINAL[need].at;
}

const WHO: Record<string, string> = {
  couple: "The two of you",
  family: "Family",
  friends: "Friends",
  solo: "Just you",
};

function whoLine(r: Request): string | undefined {
  const parts: string[] = [];
  if (r.party) parts.push(WHO[r.party]!);
  if (r.people && r.party !== "couple") parts.push(`${r.people} people`);
  if (r.kids) parts.push(`${r.kids} kid${r.kids === 1 ? "" : "s"}`);
  if (r.ages.length) parts.push(`ages ${r.ages.join(", ")}`);
  return parts.length ? parts.join(" · ") : undefined;
}

function nextWeekday(today: string, target: number): string {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, (target - dow + 7) % 7);
}

/**
 * The next useful day when none was said: today from Friday to Sunday (the
 * lights and markets are weekend things), otherwise the coming Friday.
 * Always asked about, never silent (`dayQuestion`).
 */
export function usefulDay(today: string): string {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  return dow === 5 || dow === 6 || dow === 0 ? today : nextWeekday(today, 5);
}

/** The day to plan when none was said: the next useful day — and the question. */
export function dayQuestion(today: string): Question {
  const tomorrow = addDays(today, 1);
  const weekend = [5, 6, 0].map((d) => nextWeekday(today, d));
  const days = [...new Set([today, tomorrow, ...weekend])].sort();
  const options = days.map((d) => ({
    day: d,
    label:
      d === today
        ? "Today"
        : d === tomorrow
          ? "Tomorrow"
          : dayLabel(d, true).replace(/ \w+$/, ""),
  }));
  return { id: "day", ask: "Which day?", options };
}

function noteFor(need: Need, c: Candidate): string[] {
  const notes: string[] = [];
  if (need === "movie")
    notes.push(
      "Showtimes aren't listed — check the cinema's own listings and book before you go.",
    );
  if (c.place.price) notes.push(c.place.price);
  return notes;
}

export function planItinerary(
  request: Request,
  sources: Sources,
  edits: Edits = {},
): Itinerary {
  const day = edits.day ?? request.day ?? usefulDay(sources.today);
  const question =
    edits.day || request.day ? undefined : dayQuestion(sources.today);
  const reach =
    request.reachKm ??
    (request.mode === "walk" ? WALK_REACH : (sources.reachKm ?? DRIVE_REACH));
  const readings = new Map<Experience, ChristmasReading | null>();
  for (const e of sources.experiences) readings.set(e, readChristmas(e));
  const ctx: Context = { sources, day, reach, request, readings };

  const drop = new Set(edits.drop ?? []);
  const asked: { need: Need; said: boolean }[] = [];
  for (const n of [
    ...request.needs,
    ...(edits.add ?? []).map((need) => ({ need, said: true })),
  ])
    if (!drop.has(n.need) && !asked.some((a) => a.need === n.need))
      asked.push(n);
  const needs = asked.map((a) => a.need);
  const ordered = [...asked].sort(
    (a, b) => sortKey(a.need, needs) - sortKey(b.need, needs),
  );

  const originAt: LatLng = {
    lat: sources.origin.latitude,
    lng: sources.origin.longitude,
  };
  const first = ordered[0];
  const startFrom =
    edits.start ??
    request.start ??
    (request.time === "evening"
      ? 17 * 60 + 30
      : request.time === "afternoon"
        ? 13 * 60
        : request.time === "morning"
          ? 10 * 60
          : first
            ? sortKey(first.need, needs)
            : 13 * 60);

  let clock = startFrom;
  let here = originAt;
  let km = 0;
  const chosenRefs = new Set<string>();
  const stops: ItineraryStop[] = [];

  for (const { need, said } of ordered) {
    const pool = candidatesFor(need, ctx);
    const base = {
      need,
      label:
        need === "dinner" && (request.romantic || request.party === "couple")
          ? "Romantic dinner"
          : need === "lights"
            ? "Christmas lights tour"
            : NEED_LABEL[need],
      emoji: NEED_EMOJI[need],
      said,
    };
    const fresh = pool.near.filter((c) => !chosenRefs.has(c.place.ref));
    const override = edits.times?.[need];
    if (override !== undefined) clock = override;
    const ranked = [...fresh]
      .filter(
        (c) =>
          c.closes === undefined || c.closes >= clock + 45 || need === "lights",
      )
      .sort((a, b) => score(b, here) - score(a, here));
    const picked = edits.pick?.[need];
    const pickedC = picked
      ? [...pool.near, ...pool.further].find((c) => c.place.ref === picked)
      : undefined;
    const best = pickedC ?? ranked[0];

    if (!best) {
      stops.push({
        ...base,
        status: "unresolved",
        notes: [],
        alternatives: [],
        nearby: [],
        ...unresolved(need, pool, ctx),
      });
      continue;
    }

    // A lights tour: the best display, then up to three more close to it.
    let displays: Candidate[] = [best];
    if (need === "lights" && best.light) {
      const more = ranked
        .filter(
          (c) =>
            c !== best &&
            c.light &&
            best.place.at &&
            c.place.at &&
            haversine(best.place.at, c.place.at) <=
              (request.mode === "walk" ? 2 : 10),
        )
        .slice(0, request.tour ? 4 : 2);
      displays = [best, ...more];
    }

    let travel: Travel | undefined;
    let minutes = best.minutes ?? NOMINAL[need].minutes;
    let directions: string | undefined;
    let orderedDisplays: Place[] | undefined;
    if (need === "lights" && displays.every((d) => d.light)) {
      const tourStops = order(
        here,
        displays.map((d) => d.light!),
      );
      const tour = timeTour(here, request.mode, tourStops);
      const firstLeg = tour.stops[0]!.leg;
      travel = firstLeg;
      minutes = Math.max(15, tour.minutes - firstLeg.minutes);
      km += tour.km;
      orderedDisplays = tourStops.map(
        (s) => displays.find((d) => d.place.ref === s.id)!.place,
      );
      directions =
        directionsUrl(
          here,
          request.mode,
          tourStops.map((s) => s.at),
        ) ?? undefined;
      here = tourStops.at(-1)!.at;
    } else if (best.place.at) {
      const l = leg(here, best.place.at, request.mode);
      travel = l;
      km += l.km;
      directions =
        directionsUrl(here, request.mode, [best.place.at]) ?? undefined;
      here = best.place.at;
    }

    let time = roundUp5(clock + (stops.length ? (travel?.minutes ?? 10) : 0));
    if (override !== undefined) time = override;
    if (need === "lights") time = Math.max(time, DARK);
    let timeIs: ItineraryStop["timeIs"];
    const notes = noteFor(need, best);
    if (best.fixed !== undefined && override === undefined) {
      if (best.fixed >= time - 10) {
        time = best.fixed;
        timeIs = "starts";
      } else
        notes.unshift(
          `It starts at ${clockWords(best.fixed)} by its listing — earlier than you'd get there. Change its time, or start the day earlier.`,
        );
    }
    if (need === "movie") timeIs = "about";
    if (
      best.closes !== undefined &&
      need !== "lights" &&
      best.closes < time + 30
    )
      notes.unshift(
        `It closes at ${clockWords(best.closes)} by its own hours — that's tight.`,
      );
    clock = time + minutes;
    if (
      best.closes !== undefined &&
      best.fixed !== undefined &&
      best.closes > time
    )
      clock = Math.max(clock, Math.min(best.closes, time + minutes));
    chosenRefs.add(best.place.ref);
    for (const d of displays) chosenRefs.add(d.place.ref);

    stops.push({
      ...base,
      status: "planned",
      time,
      ...(timeIs ? { timeIs } : {}),
      minutes,
      ...(travel && stops.length ? { travel } : travel ? { travel } : {}),
      place: best.place,
      ...(orderedDisplays && orderedDisplays.length > 1
        ? { displays: orderedDisplays }
        : {}),
      ...(directions ? { directions } : {}),
      notes:
        pickedC && !pool.near.includes(pickedC)
          ? [
              `${best.place.km ?? "?"} km from ${sources.origin.name} — further than the rest of the plan.`,
              ...notes,
            ]
          : notes,
      alternatives: distinctPlaces(
        ranked
          .filter((c) => c !== best && !displays.includes(c))
          .map((c) => c.place),
        best.place,
      ).slice(0, 4),
      nearby: [],
    });
  }

  // "Find something nearby": real places a short walk from each stop.
  const planned = new Set(stops.map((s) => s.need));
  const withNearby = stops.map((s) =>
    s.status === "planned" && s.place?.at
      ? { ...s, nearby: nearbyOf(s, ctx, chosenRefs, planned) }
      : s,
  );

  const timed = withNearby.filter((s) => s.time !== undefined);
  const start = timed[0]?.time;
  const leaveAt =
    start !== undefined ? start - (timed[0]!.travel?.minutes ?? 0) : undefined;
  const last = timed.at(-1);
  const end = last ? last.time! + (last.minutes ?? 0) : undefined;
  const budget =
    request.budget !== undefined
      ? budgetLine(request.budget, withNearby)
      : undefined;
  const who = whoLine(request);
  const homeBy =
    request.homeBy !== undefined
      ? end !== undefined && end > request.homeBy
        ? `You wanted to be home by ${clockWords(request.homeBy)} — this runs to ${clockWords(end)}. Remove a stop or start earlier.`
        : `Home by ${clockWords(request.homeBy)} — this finishes about ${end !== undefined ? clockWords(end) : "then"}.`
      : undefined;

  const access =
    request.access !== undefined
      ? `You mentioned “${request.access}”. Passport can't confirm step-free access, parking or seating for these stops — call each one before you go.`
      : undefined;

  return {
    title: titleFor({ ...request, needs: asked }),
    day,
    dayLabel: dayLabel(day),
    ...(question ? { question } : {}),
    from: sources.origin,
    mode: request.mode,
    reachKm: reach,
    stops: withNearby,
    ...(start !== undefined ? { start } : {}),
    ...(leaveAt !== undefined ? { leaveAt: Math.floor(leaveAt / 5) * 5 } : {}),
    ...(end !== undefined ? { end } : {}),
    totalMinutes: start !== undefined && end !== undefined ? end - start : 0,
    km: Math.round(km * 10) / 10,
    ...(who ? { who } : {}),
    ...(budget ? { budget } : {}),
    ...(homeBy ? { homeBy } : {}),
    ...(access ? { access } : {}),
    planned: withNearby.filter((s) => s.status === "planned").length,
    unresolved: withNearby.filter((s) => s.status === "unresolved").length,
  };
}

function budgetLine(budget: number, stops: readonly ItineraryStop[]): string {
  const planned = stops.filter((s) => s.place);
  const priced = planned.filter((s) => s.place!.price || s.place!.free);
  const free = planned.filter((s) => s.place!.free);
  if (priced.length === 0)
    return `Budget $${budget}: No prices are listed for these stops — check each one before you go.`;
  return `Budget $${budget}: Prices are listed for ${priced.length} of ${planned.length} stops${free.length ? ` (${free.length} free)` : ""}; check the rest before you go.`;
}

function nearbyOf(
  stop: ItineraryStop,
  ctx: Context,
  taken: ReadonlySet<string>,
  planned: ReadonlySet<Need>,
): Place[] {
  const at = stop.place!.at!;
  const open: Need[] = (
    [
      "coffee",
      "drinks",
      "dinner",
      "lunch",
      "market",
      "lights",
      "skating",
    ] as Need[]
  ).filter((n) => !planned.has(n));
  const out: Place[] = [];
  for (const need of open) {
    if (
      (need === "dinner" || need === "lunch") &&
      (planned.has("dinner") || planned.has("lunch"))
    )
      continue;
    if (need === "dinner" && (stop.time ?? 0) < 15 * 60) continue;
    if (need === "lunch" && (stop.time ?? 0) >= 15 * 60) continue;
    if (need === "drinks" && ctx.request.party === "family") continue;
    const pool = candidatesFor(need, ctx);
    const close = pool.near
      .filter(
        (c) =>
          !taken.has(c.place.ref) &&
          c.place.at &&
          haversine(at, c.place.at) <= NEARBY_KM,
      )
      .sort((a, b) => score(b, at) - score(a, at))[0];
    if (close) out.push({ ...close.place, as: need });
    if (out.length >= 3) break;
  }
  return out;
}

function unresolved(
  need: Need,
  pool: Pool,
  ctx: Context,
): Pick<ItineraryStop, "reason" | "nearest" | "tryDay"> {
  const town = ctx.sources.origin.name;
  const label = NEED_LABEL[need].toLowerCase();
  const nearest = pool.further[0]?.place;
  const where = (p: Place) =>
    `${p.title}${p.where && p.source === "atlas" ? ` in ${p.where}` : ""}, ${p.km} km away`;
  if (need === "lights" || THEME[need]) {
    const tryDay = findDay(need, ctx);
    const what =
      need === "lights"
        ? `Neither the event listings nor the community lights map has a display confirmed lit on ${dayLabel(ctx.day)} within ${ctx.reach} km of ${town}.`
        : `No ${NOUN[need] ?? label} confirmed on ${dayLabel(ctx.day)} within ${ctx.reach} km of ${town}.`;
    return {
      reason: `${what}${pool.offDay ? ` ${pool.offDay} ${pool.offDay === 1 ? "is" : "are"} known, on other days.` : ""} Passport won't guess one.`,
      ...(nearest ? { nearest } : {}),
      ...(tryDay ? { tryDay } : {}),
    };
  }
  const reason =
    pool.closed > 0
      ? `Every ${label} place we know of within ${ctx.reach} km of ${town} is closed then, by its own hours.`
      : `We know of no ${need === "movie" ? "cinema" : label + " place"} within ${ctx.reach} km of ${town}.`;
  return {
    reason: `${reason}${nearest ? ` The nearest it knows is ${where(nearest)}.` : ""} Passport won't substitute something else.`,
    ...(nearest ? { nearest } : {}),
  };
}

/** The next day (within six weeks) this part can be planned near here. */
function findDay(
  need: Need,
  ctx: Context,
): ItineraryStop["tryDay"] | undefined {
  for (let i = 1; i <= 42; i++) {
    const day = addDays(ctx.day, i);
    const pool = candidatesFor(need, { ...ctx, day });
    const top = pool.near.sort((a, b) => b.availability - a.availability)[0];
    if (top)
      return {
        day,
        label: dayLabel(day),
        why: `${top.place.title} is on that day${top.place.source === "map" ? " (community lights map)" : ""}.`,
      };
  }
  return undefined;
}

/** The instant a stop starts, for the adventure's items (`starts_at`). */
export function stopInstant(day: string, minutes: number): string {
  return new Date(
    zonedInstant(day, 0, ZONE).getTime() + minutes * 60_000,
  ).toISOString();
}
