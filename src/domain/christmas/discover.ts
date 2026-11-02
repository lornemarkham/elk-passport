import type { Experience } from "@/domain/experience/types";
import { townById, type DiscoveryTown } from "@/domain/discovery/towns";
import { distanceTo } from "@/domain/discovery/proximity";
import { excludesAge } from "@/domain/discovery/suitability";
import {
  isThemeId,
  readChristmas,
  type ChristmasReading,
  type ThemeId,
} from "./themes";
import { fitsDates, readWhen, type WhenReading } from "./when";

/**
 * **Christmas Discovery: what a family asked for, and what Atlas can say.**
 *
 * Every constraint here is optional and progressive (doctrine §4): nothing is
 * asked before results, and each one narrows only where Atlas holds the fact
 * it needs. Where Atlas is silent, the find stays and the card says so —
 * unknown is not "no" (`CandidateAvailability`, `proximity.ts`).
 *
 * ```
 * where      a town Passport knows → Atlas's distances; unplaced stays, apart
 * how far    km, straight line, from that town
 * dates      only a stated range rules a find out
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

export const DISTANCES = [10, 25, 50, 100, 250] as const;
export const DEFAULT_KM = 50;
export const HOURS = [1, 2, 4, 8] as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PARTIES: readonly Party[] = ["family", "friends", "couple", "solo"];

type Params = Readonly<Record<string, string | string[] | undefined>>;
/** One value; a repeated one (checkboxes) arrives joined with commas. */
const one = (p: Params, k: string): string | undefined => {
  const v = p[k];
  if (Array.isArray(v)) return v.filter(Boolean).join(",") || undefined;
  return typeof v === "string" && v !== "" ? v : undefined;
};

/** The URL is the state, as on Discovery: every ask is shareable. */
export function readAsk(params: Params): Ask {
  const at = one(params, "at");
  const km = Number(one(params, "km"));
  const from = one(params, "from");
  const to = one(params, "to");
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
  return {
    ...(townById(at) ? { at } : {}),
    km: (DISTANCES as readonly number[]).includes(km) ? km : DEFAULT_KM,
    ...(from && DAY.test(from) ? { from } : {}),
    ...(to && DAY.test(to) ? { to } : {}),
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
  if (ask.from) q.set("from", ask.from);
  if (ask.to) q.set("to", ask.to);
  if (ask.party) q.set("who", ask.party);
  if (ask.people) q.set("n", String(ask.people));
  if (ask.ages?.length) q.set("ages", ask.ages.join(","));
  if (ask.themes?.length) q.set("theme", ask.themes.join(","));
  if (ask.budget === "free") q.set("budget", "free");
  if (ask.hours) q.set("hours", String(ask.hours));
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

function priceOf(e: Experience): { price?: string; free: boolean } {
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
  /** What fits, nearest and surest first. */
  readonly shelves: readonly Shelf[];
  /** Everything kept, for counts. */
  readonly total: number;
  /** What each constraint took out, so the page can say so. */
  readonly removed: Readonly<Record<string, number>>;
}

const CONFIDENCE_RANK = { dated: 0, check: 1, unconfirmed: 2, past: 3 };
const FIELD_RANK = {
  name: 0,
  subtype: 0,
  activity: 1,
  organiser: 2,
  description: 2,
};

function rank(a: Find, b: Find): number {
  return (
    CONFIDENCE_RANK[a.when.confidence] - CONFIDENCE_RANK[b.when.confidence] ||
    Number(!a.reading.christmas) - Number(!b.reading.christmas) ||
    FIELD_RANK[a.reading.evidence[0]?.field ?? "description"] -
      FIELD_RANK[b.reading.evidence[0]?.field ?? "description"] ||
    (a.km ?? Infinity) - (b.km ?? Infinity) ||
    (a.when.from ?? "9999").localeCompare(b.when.from ?? "9999") ||
    a.experience.title.localeCompare(b.experience.title)
  );
}

/**
 * **One answer to one ask.** `finds` must already carry Atlas's distance
 * readings (`experience.distance`) where the town was sent, and Atlas's age
 * verdict (`suitability.forAge`) for `youngest(ask)` where one was said.
 */
export function answer(finds: readonly Find[], ask: Ask): Answer {
  const town = townById(ask.at);
  const origin = town
    ? { latitude: town.latitude, longitude: town.longitude }
    : undefined;
  const age = youngest(ask);
  const removed: Record<string, number> = {};
  const drop = (why: string) => {
    removed[why] = (removed[why] ?? 0) + 1;
    return false;
  };

  const measured = finds.map((f) => {
    const km = distanceTo(f.experience, origin);
    return km === undefined ? f : { ...f, km };
  });

  const kept: Find[] = [];
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
    if (f.when.confidence === "past") {
      past.push(f);
      continue;
    }
    if (!fitsDates(f.when, ask.from, ask.to)) {
      drop("dates");
      continue;
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
    kept.push(f);
  }

  const shelves: Shelf[] = [];
  if (town) {
    const near = kept.filter((f) => f.km !== undefined && f.km <= ask.km);
    const far = kept.filter((f) => f.km !== undefined && f.km > ask.km);
    const unplaced = kept.filter((f) => f.km === undefined);
    const sameArea = unplaced.filter(
      (f) => f.experience.geography?.area?.name === town.area,
    );
    const nowhere = unplaced.filter(
      (f) => f.experience.geography?.area?.name !== town.area,
    );
    shelves.push({
      id: "near",
      title: `Within ${ask.km} km of ${town.name.replace(/,\s*BC$/, "")}`,
      line: "Straight-line distance from the town centre, from where Atlas places each one.",
      finds: near.sort(rank),
    });
    if (sameArea.length)
      shelves.push({
        id: "area",
        title: `Elsewhere in ${town.area}`,
        line: "Atlas puts these in your area but hasn't placed them exactly.",
        finds: sameArea.sort(rank),
      });
    if (nowhere.length)
      shelves.push({
        id: "unplaced",
        title: "Atlas hasn't said where",
        line: "Real, and maybe close — Passport won't guess. The card says what Atlas knows.",
        finds: nowhere.sort(rank),
      });
    if (far.length)
      shelves.push({
        id: "far",
        title: `Further than ${ask.km} km`,
        finds: far.sort(rank),
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
        title: area || "Atlas hasn't said where",
        ...(area
          ? {}
          : {
              line: "Real, and maybe close — Passport won't guess. Tell it where you are to see what's near.",
            }),
        finds: list.sort(rank),
      });
  }
  if (notForAge.length)
    shelves.push({
      id: "age",
      title: `Not for a ${age}-year-old`,
      line: "A rule Atlas holds from the organiser — not a guess.",
      finds: notForAge.sort(rank),
    });
  if (past.length)
    shelves.push({
      id: "past",
      title: "Not listed for this year yet",
      line: "Atlas's latest dates have gone. Save one and keep an eye out.",
      finds: past.sort(rank),
    });

  return {
    ...(town ? { town } : {}),
    shelves: shelves.filter((s) => s.finds.length > 0),
    total: kept.length,
    removed,
  };
}
