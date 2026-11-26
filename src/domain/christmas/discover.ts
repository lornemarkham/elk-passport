import type { Experience } from "@/domain/experience/types";
import { christmasPictures, hasChristmasPicture } from "./pictures";
import { townById, type DiscoveryTown } from "@/domain/discovery/towns";
import { distanceTo } from "@/domain/discovery/proximity";
import { excludesAge } from "@/domain/discovery/suitability";
import {
  isThemeId,
  readChristmas,
  themeById,
  type ChristmasReading,
  type ThemeId,
} from "./themes";
import { distanceKm } from "@/lib/environment/geo";
import {
  isWhenChoice,
  presetDates,
  readWhen,
  type WhenChoice,
  type WhenReading,
} from "./when";

/**
 * **Christmas Discovery: what a family asked for, and what Atlas can say.**
 *
 * Every constraint here is optional and progressive (doctrine §4): nothing is
 * asked before results, and each one narrows only where Atlas holds the fact
 * it needs. Where Atlas is silent, the find stays and the card says so —
 * unknown is not "no" (`CandidateAvailability`, `proximity.ts`).
 *
 * ```
 * where      a town Passport knows → Atlas's distances; unplaced is held apart
 * how far    km, straight line, from that town (never a drive time)
 * when       tonight / tomorrow / this weekend / chosen days: only what is
 *            confirmed for them is offered (`availableFor`)
 * who        the party, and how many — carried into the plan
 * ages       the youngest is asked of Atlas (one age per corpus read)
 * interests  the themes
 * budget     "free" keeps only what the organiser states is free
 * time       a typical visit Atlas holds that is longer than the time is out
 * ```
 */

export type Party = "family" | "friends" | "couple" | "solo";
export type Budget = "any" | "free";

export interface Ask {
  readonly at?: string;
  readonly km: number;
  /** A preset said as a word; `from`/`to` then hold the days it means today. */
  readonly when?: WhenChoice;
  /** Listings with no confirmed place are shown, on their own shelf, only when asked for. */
  readonly unplaced?: boolean;
  readonly from?: string;
  readonly to?: string;
  readonly party?: Party;
  readonly people?: number;
  readonly ages: readonly number[];
  readonly themes: readonly ThemeId[];
  readonly budget: Budget;
  /** Hours somebody has. */
  readonly hours?: number;
}

/**
 * **How far**, straight-line kilometres (owner brief 2026-11-22). Driving
 * time is not offered: Atlas routes the legs of one plan, not a town to
 * every listing, and a straight line is never called minutes.
 */
export const DISTANCES = [2, 5, 10, 20, 30, 50] as const;
export const DEFAULT_KM = 30;
export const HOURS = [1, 2, 4, 8] as const;

/**
 * The choice nearest an old link's distance (15, 25, 60, 100, 250 km were
 * offered before), the further one on a tie — so an old link still opens on
 * a radius the control can show.
 */
export function nearestDistance(km: number): number {
  return DISTANCES.reduce<number>((best, d) => {
    const near = Math.abs(d - km);
    const was = Math.abs(best - km);
    return near < was || (near === was && d > best) ? d : best;
  }, DISTANCES[0]);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PARTIES: readonly Party[] = ["family", "friends", "couple", "solo"];

type Params = Readonly<Record<string, string | string[] | undefined>>;
/** One value; a repeated one (checkboxes) arrives joined with commas. */
const one = (p: Params, k: string): string | undefined => {
  const v = p[k];
  if (Array.isArray(v)) return v.filter(Boolean).join(",") || undefined;
  return typeof v === "string" && v !== "" ? v : undefined;
};

/**
 * **The URL is the state**, as on Discovery: every ask is shareable.
 *
 * `today` turns a preset (`when=tonight`) into its days; `km` is the
 * distance this browser last chose, used when the address names none.
 */
export function readAsk(
  params: Params,
  defaults: { readonly today?: string; readonly km?: number } = {},
): Ask {
  const at = one(params, "at");
  const rawKm = Number(one(params, "km"));
  const from = one(params, "from");
  const to = one(params, "to");
  const when = one(params, "when");
  const party = one(params, "who");
  const people = Number(one(params, "n"));
  const hours = Number(one(params, "hours"));
  const ages = (one(params, "ages") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{1,2}$/.test(s))
    .map(Number)
    .filter((n) => n >= 0 && n <= 17);
  const themes = (one(params, "theme") ?? "").split(",").filter(isThemeId);
  const remembered = (DISTANCES as readonly number[]).includes(
    defaults.km ?? NaN,
  )
    ? defaults.km!
    : DEFAULT_KM;
  const km =
    Number.isFinite(rawKm) && rawKm > 0 ? nearestDistance(rawKm) : remembered;
  const preset = isWhenChoice(when) ? when : undefined;
  const days = preset
    ? defaults.today
      ? presetDates(preset, defaults.today)
      : {}
    : {
        ...(from && DAY.test(from) ? { from } : {}),
        ...(to && DAY.test(to) ? { to } : {}),
      };
  return {
    ...(townById(at) ? { at } : {}),
    km,
    ...(preset ? { when: preset } : {}),
    ...days,
    ...(one(params, "place") === "all" ? { unplaced: true } : {}),
    ...(PARTIES.includes(party as Party) ? { party: party as Party } : {}),
    ...(Number.isInteger(people) && people > 0 && people <= 40
      ? { people }
      : {}),
    ages: [...new Set(ages)].slice(0, 6),
    themes: [...new Set(themes)],
    budget: one(params, "budget") === "free" ? "free" : "any",
    ...((HOURS as readonly number[]).includes(hours) ? { hours } : {}),
  };
}

/** Back to a query string, leaving out what was never said. */
export function writeAsk(ask: Partial<Ask>): string {
  const q = new URLSearchParams();
  if (ask.at) q.set("at", ask.at);
  if (ask.km && ask.km !== DEFAULT_KM) q.set("km", String(ask.km));
  if (ask.when) q.set("when", ask.when);
  else {
    if (ask.from) q.set("from", ask.from);
    if (ask.to) q.set("to", ask.to);
  }
  if (ask.party) q.set("who", ask.party);
  if (ask.people) q.set("n", String(ask.people));
  if (ask.ages?.length) q.set("ages", ask.ages.join(","));
  if (ask.themes?.length) q.set("theme", ask.themes.join(","));
  if (ask.budget === "free") q.set("budget", "free");
  if (ask.hours) q.set("hours", String(ask.hours));
  if (ask.unplaced) q.set("place", "all");
  return q.toString();
}

export const youngest = (ask: Ask): number | undefined =>
  ask.ages.length ? Math.min(...ask.ages) : undefined;

/** The day Atlas is asked about: a single chosen day, else none. */
export const askedDay = (ask: Ask): string | undefined =>
  ask.from && (!ask.to || ask.to === ask.from) ? ask.from : undefined;

// --------------------------------------------------------------- the finds

export interface Find {
  readonly experience: Experience;
  readonly reading: ChristmasReading;
  readonly when: WhenReading;
  /** Straight-line km where Atlas and the town both say. */
  readonly km?: number;
  /** The organiser's own price words, where stated. */
  readonly price?: string;
  /** Stated free (a price-band statement or the organiser's words). */
  readonly free: boolean;
  /** Atlas's typical visit, minutes, where held. */
  readonly minutes?: readonly [number, number];
  /**
   * The same thing listed again — another record for the same venue, or the
   * same event on other nights — folded into this card (`oneEach`).
   */
  readonly others?: number;
}

const PRICE_LABEL = /\b(price|prices|admission|tickets?|cost|fee|fares?|\$)/i;
/**
 * Free *for everybody*, said as the price itself — "Cost: FREE", "Admission:
 * by donation", "a complimentary event". Not "infant free on lap" or "ages
 * 15 and under are free", which are a paid thing with a discount.
 */
const FREE_PRICE =
  /^\s*(free|free admission|free entry|free event|by donation|admission by donation|complimentary|no charge)\b/i;
const FREE_SAID =
  /\b(free admission|admission is free|free of charge|free event|free entry|complimentary)\b/i;
const PARTLY_FREE =
  /\b(under|and under|kids?|children|child|infants?|babies|toddlers|seniors?|members?)\b[^.;]{0,20}\bfree\b|\bfree\b[^.;]{0,12}\b(for|on) (kids?|children|infants?|lap|members?)\b/i;

export function priceOf(e: Experience): { price?: string; free: boolean } {
  const band = e.suitability?.statements?.find((s) => s.about === "price-band");
  const practical = e.knowledge?.practical?.find(
    (p) => PRICE_LABEL.test(p.label) || /\$\s?\d/.test(p.value),
  );
  const price = practical
    ? `${practical.label}: ${practical.value}`
    : band?.text;
  const free =
    band?.says === "free" ||
    (practical
      ? FREE_PRICE.test(practical.value) && !/\$\s?\d/.test(practical.value)
      : (e.suitability?.statements ?? []).some(
          (s) => FREE_SAID.test(s.text) && !PARTLY_FREE.test(s.text),
        ));
  return { ...(price ? { price } : {}), free };
}

const STATED_PLACE = /^(location|venue|where|address|place)$/i;

/**
 * **Where the organiser says it is**, in their words — "Downtown Vernon, 30th
 * Avenue between 30th Street and 34th Street" — for a listing Atlas has not
 * linked to a venue yet. It is said on the card, never measured: a stated
 * address is not a point, so it moves nothing onto "Closest to you".
 */
export function statedPlace(e: Experience): string | undefined {
  return e.knowledge?.practical?.find((p) => STATED_PLACE.test(p.label.trim()))
    ?.value;
}

/**
 * **Directions**, to Atlas's point where it holds one, else to the venue it
 * names in its town, else to the organiser's stated address. None of those,
 * and there is no honest link to make.
 */
export function directionsOf(e: Experience): string | undefined {
  const base = "https://www.google.com/maps/dir/?api=1&destination=";
  const point = e.geography?.coordinates;
  if (point && typeof point[0] === "number" && typeof point[1] === "number")
    return `${base}${point[1]},${point[0]}`;
  const venue = e.venue?.name;
  const town = e.venue?.locality ?? e.geography?.locality;
  if (venue && town) return `${base}${encodeURIComponent(`${venue}, ${town}`)}`;
  const stated = statedPlace(e);
  return stated ? `${base}${encodeURIComponent(stated)}` : undefined;
}

/** Every Christmas find in a corpus, read once. */
export function findsIn(
  experiences: readonly Experience[],
  today: string,
): Find[] {
  return experiences.flatMap((experience) => {
    const reading = readChristmas(experience);
    if (!reading) return [];
    const { price, free } = priceOf(experience);
    return [
      {
        experience,
        reading,
        when: readWhen(experience, today),
        ...(price ? { price } : {}),
        free,
        ...(experience.visitDuration?.minutes
          ? { minutes: experience.visitDuration.minutes }
          : {}),
      },
    ];
  });
}

// ------------------------------------------------------------- the answer

export interface Shelf {
  readonly id: string;
  readonly title: string;
  readonly line?: string;
  readonly finds: readonly Find[];
}

export interface Answer {
  readonly town?: DiscoveryTown;
  /** What fits, surest and nearest first. */
  readonly shelves: readonly Shelf[];
  /** What the page offers near the search origin — the result count. */
  readonly total: number;
  /** What each constraint took out, so the page can say so. */
  readonly removed: Readonly<Record<string, number>>;
  /**
   * Listings that fit everything but have no confirmed place: kept, never
   * mixed into nearby results, and shown only when asked for (`ask.unplaced`).
   */
  readonly unplaced: number;
}

/**
 * **A town centre is not a place** (owner brief 2026-11-22, TEST E). Atlas
 * measures a listing that names only its town from that town's centre;
 * Vancouver runs 10 km across, so "in Vancouver" says nothing about being
 * within 5 km of Downtown. Below this radius such a reading is shown apart,
 * as in that town, never counted as near.
 */
export const TOWN_SPREAD_KM = 10;

/** The big outings a longer drive is for — not a class, a party or a sale. */
const DRIVE_THEMES: ReadonlySet<ThemeId> = new Set([
  "markets",
  "lights",
  "festivals",
  "shows",
]);
const NOT_AN_OUTING =
  /\b(fundraiser|party|class|classes|workshop|photos?|story ?time|sale|meeting|bingo|lunch|luncheon)\b/i;

/** How far "worth the drive" reaches: at least this, or twice the radius. */
export const DRIVE_REACH_KM = 100;
/** Cards on the "worth the drive" shelf. A few, not a second directory. */
const DRIVE_SHELF = 6;

const IDENTITY: ReadonlySet<string> = new Set(["name", "subtype"]);
const FIELD_RANK = {
  name: 0,
  subtype: 0,
  activity: 1,
  description: 2,
  organiser: 3,
};

/**
 * **Whether Atlas confirms it for the days asked** — the only thing a dated
 * search may offer as its answer:
 *
 * ```
 * yes      its own dates are confirmed and cover them, or Atlas's reading
 *          of its stated hours or season says "on" for the day asked
 * no       its dates miss them, it is over, or Atlas says "not on" that day
 * maybe    a window that covers them without saying which days, or no
 *          dates at all — never offered as on
 * ```
 */
export function availableFor(
  f: Find,
  from: string,
  to: string,
): "yes" | "no" | "maybe" {
  const onDate = f.experience.schedule?.onDate;
  if (onDate && onDate.date >= from && onDate.date <= to) {
    if (onDate.reading === "not-on") return "no";
    if (onDate.reading === "on") return "yes";
  }
  const w = f.when;
  if (w.confidence === "past") return "no";
  if (w.from && w.to) {
    if (w.from > to || w.to < from) return "no";
    return w.confidence === "dated" ? "yes" : "maybe";
  }
  return "maybe";
}

/** Over already: its own stated clock end has gone. */
function finishedBy(f: Find, now: Date): boolean {
  const e = f.experience;
  if (e.kind !== "Event" || e.timePrecision !== "minute") return false;
  const end = e.endTime ?? undefined;
  return end !== undefined && Date.parse(end) < now.getTime();
}

const hasPicture = (f: Find) =>
  Boolean(
    f.experience.heroMedia ||
    (f.experience as { presentationImage?: { relationship?: string } })
      .presentationImage?.relationship === "exact",
  );

/**
 * **The order of a shelf** (owner brief 2026-11-22): confirmed for the
 * days asked, then how plainly it is the kind of thing asked for, then how
 * near, then a real picture of it, then how sure Atlas is of its place.
 * No score is invented: every step is a fact Atlas holds or does not.
 */
function ranker(ask: Ask) {
  const theme = ask.themes.length === 1 ? ask.themes[0] : undefined;
  const sure = (f: Find) =>
    ask.from || ask.to
      ? availableFor(f, ask.from ?? ask.to!, ask.to ?? ask.from!) === "yes"
        ? 0
        : 1
      : { dated: 0, check: 1, unconfirmed: 2, past: 3 }[f.when.confidence];
  const relevance = (f: Find) => {
    const evidence = theme
      ? f.reading.evidence.find((e) => themeById(theme).words.test(e.word))
      : f.reading.evidence[0];
    return (
      (f.reading.christmas ? 0 : 4) +
      FIELD_RANK[evidence?.field ?? "description"]
    );
  };
  const placed = (f: Find) =>
    f.experience.geography?.coordinatesBasis === "observed" ? 0 : 1;
  return (a: Find, b: Find): number =>
    sure(a) - sure(b) ||
    relevance(a) - relevance(b) ||
    (a.km ?? Infinity) - (b.km ?? Infinity) ||
    Number(!hasPicture(a)) - Number(!hasPicture(b)) ||
    placed(a) - placed(b) ||
    (a.when.from ?? "9999").localeCompare(b.when.from ?? "9999") ||
    a.experience.title.localeCompare(b.experience.title);
}

const titleKey = (t: string) =>
  t
    .toLowerCase()
    .replace(/\b20\d\d\b/g, " ")
    // No spaces at all: "Silver Star" and "SilverStar" are one name, and two
    // records of the same light-up said it each way (M1059).
    .replace(/[^a-z0-9]+/g, "");

function pointOf(f: Find) {
  const c = f.experience.geography?.coordinates;
  return c && typeof c[0] === "number" && typeof c[1] === "number"
    ? { latitude: c[1], longitude: c[0] }
    : undefined;
}

/** Listings of one thing this close together are the same thing. */
const SAME_PLACE_KM = 10;

/**
 * **One card for one thing** (owner QA 2026-11-22: "Caravan Farm Theatre"
 * three times, a rink twice, a tour eight times). Atlas keeps a venue and
 * its organisation as separate records, and an event once per night; a
 * shelf shows the first in its order and says how many more there are. Two
 * listings are one only with the same name and no evidence they are apart:
 * within 10 km, or the same stated town, or neither placed.
 */
export function oneEach(sorted: readonly Find[]): Find[] {
  const kept: Find[] = [];
  for (const f of sorted) {
    const key = titleKey(f.experience.title);
    const at = pointOf(f);
    const town = f.experience.geography?.locality?.toLowerCase();
    const i = kept.findIndex((k) => {
      if (titleKey(k.experience.title) !== key) return false;
      const there = pointOf(k);
      if (at && there) return distanceKm(at, there) <= SAME_PLACE_KM;
      const theirs = k.experience.geography?.locality?.toLowerCase();
      if (town || theirs) return town === theirs;
      return !at && !there;
    });
    if (i < 0) kept.push(f);
    else
      kept[i] = borrowPicture(
        { ...kept[i]!, others: (kept[i]!.others ?? 0) + 1 },
        f,
      );
  }
  return kept;
}

/**
 * **The card shows the thing's picture, whichever listing holds it**
 * (mission 1126). Atlas keeps one Caravan Farm Theatre three times, and the
 * listing that leads the shelf can be the one without a photograph while its
 * twin has one. They are one thing by `oneEach`'s own rule, so the twin's own
 * picture — never a venue's or a stand-in — is a picture of this thing.
 */
function borrowPicture(card: Find, twin: Find): Find {
  if (hasChristmasPicture(card.experience)) return card;
  const picture = christmasPictures(twin.experience)[0];
  if (!picture) return card;
  return {
    ...card,
    experience: {
      ...card.experience,
      heroMedia: { type: "image", src: picture.src, alt: picture.alt },
    },
  };
}

/**
 * **One answer to one ask.** `finds` must already carry Atlas's distance
 * readings (`experience.distance`) where the town was sent — including those
 * beyond the radius, flagged — and Atlas's age verdict (`suitability.forAge`)
 * for `youngest(ask)` where one was said. `now` decides what has already
 * finished tonight.
 */
export function answer(
  finds: readonly Find[],
  ask: Ask,
  context: { readonly today?: string; readonly now?: Date } = {},
): Answer {
  const town = townById(ask.at);
  const origin = town
    ? { latitude: town.latitude, longitude: town.longitude }
    : undefined;
  const age = youngest(ask);
  const removed: Record<string, number> = {};
  const drop = (why: string) => {
    removed[why] = (removed[why] ?? 0) + 1;
  };
  const dated = Boolean(ask.from || ask.to);
  const from = ask.from ?? ask.to;
  const to = ask.to ?? ask.from;
  // Tonight (a single day that is today) offers only what is confirmed.
  const tonight =
    dated &&
    from === to &&
    context.today !== undefined &&
    from === context.today;

  const measured = finds.map((f) => {
    const km = distanceTo(f.experience, origin);
    return km === undefined ? f : { ...f, km };
  });

  const kept: Find[] = [];
  const maybe: Find[] = [];
  const notForAge: Find[] = [];
  const past: Find[] = [];
  for (const f of measured) {
    if (
      ask.themes.length &&
      !f.reading.themes.some((t) => ask.themes.includes(t))
    ) {
      drop("interests");
      continue;
    }
    if (!dated && f.when.confidence === "past") {
      past.push(f);
      continue;
    }
    // Over already today, by its own stated end: never offered as on or
    // upcoming, whatever was asked (owner brief M1053, "never show expired
    // events as upcoming").
    if (context.now && finishedBy(f, context.now)) {
      drop("finished");
      continue;
    }
    let unsure = false;
    if (dated) {
      const fits = availableFor(f, from!, to!);
      if (fits === "no") {
        drop("dates");
        continue;
      }
      if (fits === "maybe") {
        if (tonight) {
          drop("unconfirmed");
          continue;
        }
        unsure = true;
      }
    }
    if (ask.budget === "free" && !f.free) {
      drop("budget");
      continue;
    }
    if (ask.hours && f.minutes && f.minutes[0] > ask.hours * 60) {
      drop("time");
      continue;
    }
    if (age !== undefined && excludesAge(f.experience, age)) {
      notForAge.push(f);
      continue;
    }
    (unsure ? maybe : kept).push(f);
  }

  const rank = ranker(ask);
  const shelf = (list: readonly Find[]) => oneEach([...list].sort(rank));
  const shelves: Shelf[] = [];
  let unplaced = 0;
  if (town) {
    const name = town.name.replace(/,\s*BC$/, "");
    // **The radius is a rule, not a hint.** What Atlas places inside it is
    // the answer. A few big Christmas things placed further out are offered
    // apart, as worth the drive, and say so; the rest is set aside and
    // counted. What Atlas has not placed is never called near: it is held
    // apart and shown only when asked for (owner QA 2026-11-22 — a
    // Vancouver market on a Vernon page, under "location not confirmed").
    const townOnly = (f: Find) =>
      ask.km < TOWN_SPREAD_KM &&
      f.experience.distance?.state === "measured" &&
      f.experience.distance.basis === "town";
    const inside = (f: Find) =>
      f.km !== undefined && f.km <= ask.km && !townOnly(f);
    const inTownOnly = shelf(
      kept.filter((f) => townOnly(f) && f.km !== undefined && f.km <= ask.km),
    );
    const reach = Math.max(DRIVE_REACH_KM, ask.km * 2);
    const near = shelf(kept.filter(inside));
    const drive = shelf(
      kept.filter(
        (f) =>
          f.km !== undefined &&
          f.km > ask.km &&
          f.km <= reach &&
          f.reading.christmas &&
          f.reading.themes.some(
            (t) =>
              DRIVE_THEMES.has(t) &&
              themeById(t).called.test(f.experience.title),
          ) &&
          !NOT_AN_OUTING.test(f.experience.title) &&
          IDENTITY.has(f.reading.evidence[0]?.field ?? "") &&
          f.when.confidence === "dated" &&
          f.when.phase !== "finished",
      ),
    )
      .sort((a, b) => a.km! - b.km!)
      .slice(0, DRIVE_SHELF);
    const shownFar = new Set(drive.map((f) => f.experience.id));
    const placedOut = kept.filter(
      (f) =>
        f.km !== undefined && f.km > ask.km && !shownFar.has(f.experience.id),
    ).length;
    const notPlaced = kept.filter((f) => f.km === undefined);
    // Atlas places it in some other area: it is not near, whatever it is.
    const elsewhere = notPlaced.filter((f) => {
      const area = f.experience.geography?.area?.name;
      return area !== undefined && area !== town.area;
    });
    const unknown = notPlaced.filter((f) => !elsewhere.includes(f));
    removed.distance = (removed.distance ?? 0) + placedOut + elsewhere.length;

    shelves.push({
      id: "near",
      title: "Closest to you",
      line: `Within ${ask.km} km of ${name}, straight-line — confirmed first, then nearest.`,
      finds: near,
    });
    if (inTownOnly.length)
      shelves.push({
        id: "town",
        title: "Exact spot not listed",
        line: `These say only which town they're in, so we can't tell whether they're within ${ask.km} km. Check the address before you go.`,
        finds: inTownOnly,
      });
    const nearMaybe = shelf(maybe.filter(inside));
    if (nearMaybe.length)
      shelves.push({
        id: "maybe",
        title: "Might be on — not confirmed for these dates",
        line: "Within your distance, but the listing doesn't confirm these days. Check before you go.",
        finds: nearMaybe,
      });
    if (drive.length)
      shelves.push({
        id: "drive",
        title: "Worth the drive",
        line: `Further than ${ask.km} km from ${name} (up to ${reach} km, straight-line): Christmas events named as such, with this season's dates confirmed.`,
        finds: drive,
      });
    unplaced = oneEach(unknown).length;
    if (ask.unplaced && unplaced)
      shelves.push({
        id: "unplaced",
        title: "Location not confirmed",
        line: `These listings don't say where they are, so they could be anywhere — not necessarily near ${name}. Check before you go.`,
        finds: shelf(unknown),
      });
  } else {
    const byArea = new Map<string, Find[]>();
    for (const f of kept) {
      const area = f.experience.geography?.area?.name ?? "";
      byArea.set(area, [...(byArea.get(area) ?? []), f]);
    }
    for (const [area, list] of [...byArea.entries()].sort(
      ([a, x], [b, y]) => Number(!a) - Number(!b) || y.length - x.length,
    ))
      shelves.push({
        id: area ? `area-${area}` : "unplaced",
        title: area || "Location not confirmed",
        ...(area
          ? {}
          : {
              line: "Real, and maybe close — Passport won't guess. Tell it where you are to see what's near.",
            }),
        finds: shelf(list),
      });
    if (maybe.length)
      shelves.push({
        id: "maybe",
        title: "Might be on — not confirmed for these dates",
        line: "The listing doesn't confirm these days. Check before you go.",
        finds: shelf(maybe),
      });
  }
  if (notForAge.length)
    shelves.push({
      id: "age",
      title: `Not for a ${age}-year-old`,
      line: "A rule from the organiser — not a guess.",
      finds: shelf(notForAge),
    });
  if (past.length)
    shelves.push({
      id: "past",
      title: "Earlier dates — not confirmed for this year",
      line: "These ran in other years or have finished. They are not on this year's calendar until an organiser says so.",
      finds: shelf(past),
    });

  const shown = shelves.filter((s) => s.finds.length > 0 || s.id === "near");
  return {
    ...(town ? { town } : {}),
    shelves: shown.filter((s) => s.finds.length > 0),
    total: town
      ? (shown.find((s) => s.id === "near")?.finds.length ?? 0)
      : shown
          .filter((s) => s.id !== "age" && s.id !== "past")
          .reduce((n, s) => n + s.finds.length, 0),
    removed,
    unplaced,
  };
}
