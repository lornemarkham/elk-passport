import type { DayPlanned, DayStop } from "@/domain/day/build";
import type { Experience } from "@/domain/experience/types";
import { planDateLine } from "@/domain/day/plan";

/**
 * **The printable adventure — what goes on the paper, and what each line is
 * allowed to claim.**
 *
 * ## This is a view model, not a contract
 *
 * Nothing here is the Adventure or the Moment. Those shared contracts belong
 * to another mission, and `src/lib/schemas.ts` already holds an older
 * `Adventure` that this does not touch. This file takes the day the builder
 * already makes (`DayPlanned`, `src/domain/day/build.ts`) and lays it out for
 * paper. When the shared contracts land, the only thing that changes is the
 * adapter at the bottom of this file. The layout does not change.
 *
 * ## Three kinds of statement, and they must not look alike
 *
 * This is the discipline from `/about/experiment-07-fishing-with-emi`, which
 * found that a family adventure page mixes three completely different kinds
 * of sentence and most travel content prints them all the same way:
 *
 * ```
 * published  a place said it, and the page repeats it in their words
 * check      nobody has said it, or it changes daily. Find out before you go
 * suggested  Passport's own idea. It is not a fact about any place
 * ```
 *
 * A checklist line that says *washrooms are listed here* and one that says
 * *bring snacks* are different kinds of promise. The paper says which is which.
 *
 * ## What it will not print
 *
 * Driving times, opening hours that nobody published, and a total cost added
 * up from prices written in each publisher's own words ("$12 adults, $8
 * kids"). The builder already refuses the first two. This file refuses the
 * third, and says so on the page.
 */

export type Basis = "published" | "check" | "suggested";

export const BASIS_LABEL: Readonly<Record<Basis, string>> = {
  published: "Published",
  check: "Check first",
  suggested: "Suggestion",
};

export interface PrepItem {
  readonly id: string;
  readonly label: string;
  readonly why?: string;
  readonly basis: Basis;
}

export interface PrintableStop {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly where?: string;
  /** The plan's share of their time. Not how long the place takes. */
  readonly minutes: number;
  /** Straight-line km. Absent when either end has no position. */
  readonly km?: number;
  readonly because: string;
  /** A published price, in the publisher's words. */
  readonly cost?: string;
  /** What is published about the day asked about. */
  readonly open?: string;
  readonly notes: readonly string[];
  readonly challenge?: string;
  /**
   * What Atlas says you can do or find here, in its own words. Printed as
   * optional. Nobody has to do all of it.
   */
  readonly alsoHere: readonly string[];
  /** A map link to open before leaving, while there is still signal. */
  readonly directions?: string;
  /**
   * What to type into a map, for paper: coordinates where Atlas has them,
   * otherwise the name and town. A URL can't be typed off a page.
   */
  readonly findBy?: string;
}

export interface TimeSummary {
  /** Hours the person gave. Absent when they did not give any. */
  readonly statedHours?: number;
  /** Hours the plan divided up: what they said, or what it assumed. */
  readonly plannedHours: number;
  readonly stopCount: number;
  readonly minutesPerStop: number;
  /** Sum of the legs that were measured, in straight-line km. */
  readonly measuredKm?: number;
  /** Legs with no distance, because one end had no position. */
  readonly unmeasuredLegs: number;
}

export interface BudgetSummary {
  /** Dollars, for everybody, where they said. */
  readonly statedBudget?: number;
  readonly published: readonly { title: string; cost: string }[];
  readonly unpublished: readonly string[];
}

export interface SideQuest {
  readonly id: string;
  readonly prompt: string;
}

export interface PrintableAdventure {
  readonly title: string;
  readonly opening: string;
  /** What they asked for, quoted back. */
  readonly said?: string;
  /** The date written out, where one was carried in. */
  readonly dateLine?: string;
  readonly childAge?: number;
  readonly stops: readonly PrintableStop[];
  readonly prep: readonly PrepItem[];
  readonly time: TimeSummary;
  readonly budget: BudgetSummary;
  readonly sideQuests: readonly SideQuest[];
  readonly memoryPrompts: readonly string[];
  readonly unknowns: readonly string[];
  readonly closing: string;
  /** A sample, not a day somebody built. The page says so. */
  readonly sample: boolean;
}

/**
 * A map link for one stop: by coordinate where Atlas has one, otherwise by
 * name and town. Without either there is no honest link to make.
 */
export function directionsFor(experience: Experience): string | undefined {
  const where = experience.geography?.locality ?? experience.venue?.locality;
  const point = experience.geography?.coordinates;
  if (point) {
    return `https://www.google.com/maps/search/?api=1&query=${point[1]},${point[0]}`;
  }
  if (where) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${experience.title}, ${where}`,
    )}`;
  }
  return undefined;
}

/** The same lookup as `directionsFor`, written for a person to type. */
export function findByFor(experience: Experience): string | undefined {
  const where = experience.geography?.locality ?? experience.venue?.locality;
  const point = experience.geography?.coordinates;
  if (point) return `${point[1].toFixed(5)}, ${point[0].toFixed(5)}`;
  if (where) return `${experience.title}, ${where}`;
  return undefined;
}

/** Atlas's verbs and features for a stop, deduplicated, in its own words. */
function alsoHereFor(experience: Experience): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string | undefined) => {
    const text = raw?.trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  };
  for (const a of experience.knowledge?.affordances ?? []) add(a.name);
  for (const f of experience.knowledge?.features ?? []) add(f);
  return out.slice(0, 6);
}

/** "1 hr 15 min", "45 min", "2 hr". */
export function minutesLine(minutes: number): string {
  const rounded = Math.round(minutes / 15) * 15;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function kmLine(km: number): string {
  return km < 1 ? "under 1 km" : `${Math.round(km)} km`;
}

const listOf = (names: readonly string[]): string =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * Practical features a place has published, the kind that change what you
 * pack. Only ones Atlas lists, matched by name and never inferred.
 */
const PRACTICAL_FEATURE =
  /washroom|toilet|restroom|drinking water|water fountain|parking|picnic|shelter/i;

/**
 * **The checklist.** Every line says what kind of line it is.
 *
 * Built from what the plan knows (`check`), what the places publish
 * (`published`), and a short honest list of things that make any day out go
 * better (`suggested`). The suggestions are Passport's idea and are labelled
 * that way, same rule as Fishing With Emi's pack list.
 */
export function prepFor(day: DayPlanned): PrepItem[] {
  const items: PrepItem[] = [];
  const titles = (pick: (s: DayStop) => boolean) =>
    day.stops.filter(pick).map((s) => s.experience.title);

  const noHours = titles((s) => !s.open);
  if (noHours.length > 0) {
    items.push({
      id: "hours",
      label: "Opening hours",
      why: `Not published for ${listOf(noHours)}. A call or a look at their own site settles it.`,
      basis: "check",
    });
  }
  const noPrice = titles((s) => !s.cost);
  if (noPrice.length > 0) {
    items.push({
      id: "prices",
      label: "Prices",
      why: `Not published for ${listOf(noPrice)}.`,
      basis: "check",
    });
  }
  items.push({
    id: "route",
    label: "The route between stops",
    why: "Distances on this page are straight lines. Passport has no road routing and gives no drive times.",
    basis: "check",
  });
  items.push({
    id: "weather",
    label: day.brief.on
      ? `The forecast for ${planDateLine(day.brief.on)}`
      : "The forecast",
    why: "Passport is not reading it for this page.",
    basis: "check",
  });

  for (const stop of day.stops) {
    for (const feature of stop.experience.knowledge?.features ?? []) {
      if (PRACTICAL_FEATURE.test(feature)) {
        items.push({
          id: `feature-${stop.experience.id}-${feature.toLowerCase()}`,
          label: `${feature} listed at ${stop.experience.title}`,
          basis: "published",
        });
      }
    }
    if (stop.notes.length > 0) {
      items.push({
        id: `rules-${stop.experience.id}`,
        label: `Rules at ${stop.experience.title}`,
        why: stop.notes.join(" · "),
        basis: "published",
      });
    }
  }

  if (day.stops.some((s) => s.cost && /\$\d/.test(s.cost))) {
    items.push({
      id: "money",
      label: "A card and some cash",
      why: "At least one place names a price.",
      basis: "suggested",
    });
  }
  items.push({
    id: "told",
    label: "Someone knows where you are going and when you'll be back",
    basis: "suggested",
  });
  if (day.stops.some((s) => directionsFor(s.experience))) {
    items.push({
      id: "maps",
      label: "Map links opened while you still have signal",
      why: "Each stop has one. Paper can't load a map, so look before you leave.",
      basis: "suggested",
    });
  }
  items.push({
    id: "food",
    label:
      day.brief.childAge !== undefined
        ? "Water, and more snacks than seem necessary"
        : "Water and something to eat",
    basis: "suggested",
  });
  if (day.brief.childAge !== undefined) {
    items.push({
      id: "layers",
      label: `A warm layer and a change of clothes for the ${day.brief.childAge}-year-old`,
      basis: "suggested",
    });
  }
  items.push({
    id: "phone",
    label: "Phone charged, for getting home rather than looking things up",
    basis: "suggested",
  });
  items.push({
    id: "pen",
    label: "A pen",
    why: "This page has places to write.",
    basis: "suggested",
  });
  return items;
}

/**
 * **Time, as the plan's arithmetic.** The builder gives each stop an equal
 * share of the hours stated, or four if none were stated. Getting between
 * stops comes out of that share. This says so rather than adding an invented
 * drive on top.
 */
export function timeFor(day: DayPlanned): TimeSummary {
  const legs = day.stops.map((s) => s.km);
  const measured = legs.filter((k): k is number => k !== undefined);
  return {
    ...(day.brief.hours !== undefined ? { statedHours: day.brief.hours } : {}),
    plannedHours: day.brief.hours ?? 4,
    stopCount: day.stops.length,
    minutesPerStop: day.stops[0]?.minutes ?? 0,
    ...(measured.length > 0
      ? {
          measuredKm:
            Math.round(measured.reduce((sum, k) => sum + k, 0) * 10) / 10,
        }
      : {}),
    unmeasuredLegs: legs.length - measured.length,
  };
}

/**
 * **Money, without arithmetic.** Prices are printed in each publisher's own
 * words. Adding "$12 adults, $8 kids" to "by donation" gives a number nobody
 * said, so the page lists them and leaves the total out.
 */
export function budgetFor(day: DayPlanned): BudgetSummary {
  return {
    ...(day.brief.budget !== undefined
      ? { statedBudget: day.brief.budget }
      : {}),
    published: day.stops
      .filter((s): s is DayStop & { cost: string } => Boolean(s.cost))
      .map((s) => ({ title: s.experience.title, cost: s.cost })),
    unpublished: day.stops
      .filter((s) => !s.cost)
      .map((s) => s.experience.title),
  };
}

/**
 * **Optional, all day, anywhere.** None of these is about a particular place,
 * so none of them can be wrong about one. They are things to do that are not
 * looking at a phone, in the spirit of Wonder's *Little Missions* and the
 * builder's per-stop challenges.
 */
const QUESTS_ANYONE: readonly SideQuest[] = [
  {
    id: "local",
    prompt: "Ask someone who lives here for their favourite spot. Go there.",
  },
  {
    id: "unplanned",
    prompt: "Stop once for something that isn't on this page.",
  },
  { id: "sound", prompt: "Close your eyes for a minute. Count the sounds." },
  {
    id: "old",
    prompt: "Find the oldest thing you can. Guess how old it is.",
  },
  {
    id: "photo",
    prompt: "Take one photo all day. Make it count.",
  },
  {
    id: "sign",
    prompt: "Find the strangest sign. Write down what it says.",
  },
];

const QUESTS_WITH_KIDS: readonly SideQuest[] = [
  { id: "birds", prompt: "Hear three different birds." },
  { id: "leaf", prompt: "Find a leaf bigger than your hand." },
  { id: "rocks", prompt: "Skip a rock, or find a flat one for next time." },
  { id: "colours", prompt: "Find something of every colour in a rainbow." },
];

export function sideQuestsFor(day: DayPlanned): SideQuest[] {
  // Deterministic per day, so the paper and the screen agree and a reprint
  // gives the same page.
  const seed = day.stops.reduce(
    (sum, s) =>
      sum + [...s.experience.id].reduce((a, c) => a + c.charCodeAt(0), 0),
    0,
  );
  const rotate = (pool: readonly SideQuest[], take: number) => {
    const start = seed % pool.length;
    return [...pool.slice(start), ...pool.slice(0, start)].slice(0, take);
  };
  const young = day.brief.childAge !== undefined && day.brief.childAge <= 12;
  return young
    ? [...rotate(QUESTS_WITH_KIDS, 2), ...rotate(QUESTS_ANYONE, 2)]
    : rotate(QUESTS_ANYONE, 4);
}

/**
 * **What actually happened.** The doctrine's REMEMBER (§2.9) on paper:
 * not "clicked waterfall", but what was good, what surprised them, and what
 * the plan got wrong.
 */
export function memoryPromptsFor(day: DayPlanned): string[] {
  return [
    "The best moment",
    "Something we found that wasn't on this page",
    day.brief.childAge !== undefined
      ? "The funniest thing anyone said (kids count double)"
      : "The funniest thing anyone said",
    "What took longer, or shorter, than the plan said",
    "Would we do it again? What would we change?",
  ];
}

/**
 * The adapter. The one place that knows the day came from `buildDay`. When
 * the shared Adventure/Moment contracts exist, a second adapter goes here
 * beside it.
 */
export function printableFromDay(
  day: DayPlanned,
  options: { readonly sample?: boolean } = {},
): PrintableAdventure {
  return {
    title: day.title,
    opening: day.opening,
    ...(day.brief.said ? { said: day.brief.said } : {}),
    ...(day.brief.on ? { dateLine: planDateLine(day.brief.on) } : {}),
    ...(day.brief.childAge !== undefined
      ? { childAge: day.brief.childAge }
      : {}),
    stops: day.stops.map((stop, index) => {
      const e = stop.experience;
      const where = e.geography?.locality ?? e.venue?.locality;
      const directions = directionsFor(e);
      const findBy = findByFor(e);
      return {
        id: e.id,
        number: index + 1,
        title: e.title,
        ...(where ? { where } : {}),
        minutes: stop.minutes,
        ...(stop.km !== undefined ? { km: stop.km } : {}),
        because: stop.because,
        ...(stop.cost ? { cost: stop.cost } : {}),
        ...(stop.open ? { open: stop.open } : {}),
        notes: stop.notes,
        ...(stop.challenge ? { challenge: stop.challenge } : {}),
        alsoHere: alsoHereFor(e),
        ...(directions ? { directions } : {}),
        ...(findBy ? { findBy } : {}),
      };
    }),
    prep: prepFor(day),
    time: timeFor(day),
    budget: budgetFor(day),
    sideQuests: sideQuestsFor(day),
    memoryPrompts: memoryPromptsFor(day),
    unknowns: day.unknowns,
    closing: day.closing,
    sample: options.sample ?? false,
  };
}
