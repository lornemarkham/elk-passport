import { daylightAt } from "@/domain/environment/daylight";
import { wallMinutes, zonedInstant } from "@/domain/date-night/conditions";
import { writeDayQuery } from "@/lib/domains/integration/dayQuery";
import type { DayOption, Mood, NightDay, Phase } from "./types";

/**
 * **Five quick answers → one day, in an order that makes sense.**
 *
 * This chooses, it doesn't plan. It picks one checked place per beat of the
 * day (START → EXPLORE → EXPERIENCE → UNWIND) from the night's own options
 * and writes the result as an ordinary `/go` day query: stops in order, the
 * minutes for each, the sentence, the town and the date. After that the day
 * belongs to the shared adventure core. The journey, the routed legs, the
 * timeline, the printable guide and "make it more adventurous" all run on
 * that query, exactly as they do for every other adventure (ADR 012).
 *
 * Why the order is chosen here. The Day Builder orders kept stops by
 * geography, so on its own it would put dinner at 11 am and the lake after
 * dark. This chooser knows what the beats are for: outdoors only while it's
 * light (sunset is arithmetic, so it's always known), a place with stated
 * hours only while it's open, and an unknown-hours finish always paired with
 * one that is sure to be open.
 */

export const PHASES: readonly Phase[] = [
  "start",
  "explore",
  "experience",
  "unwind",
];

export const PHASE_LABEL: Readonly<Record<Phase | "remember", string>> = {
  start: "Start",
  explore: "Explore",
  experience: "Experience",
  unwind: "Unwind",
  remember: "Remember",
};

export type When = "day" | "afternoon" | "evening";

export interface DayAnswers {
  readonly when: When;
  /** Road minutes either of you will drive to get anywhere. */
  readonly reach: 15 | 30 | 60;
  /** 1 $ · 2 $$ · 3 $$$. */
  readonly budget: 1 | 2 | 3;
  readonly moods: readonly Mood[];
  readonly plunge: boolean;
  readonly drinks: boolean;
  /** "Shorten the evening": no middle stop, and home earlier. */
  readonly short?: boolean;
}

export const DEFAULT_ANSWERS: DayAnswers = {
  when: "day",
  reach: 30,
  budget: 3,
  moods: ["romantic", "adventurous"],
  plunge: true,
  drinks: true,
};

export const START_AT: Readonly<Record<When, number>> = {
  day: 11 * 60 + 30,
  afternoon: 13 * 60 + 30,
  evening: 17 * 60,
};

/** The evening ends here unless somebody says otherwise. */
export const HOME_BY = 22 * 60;
/** Between stops, before routing says better. The shared timeline routes. */
const MOVE = 20;
/** How long the day will wait for somewhere to open. */
const WAIT = 45;
/** Dinner is not at three. The finish waits for this, however long. */
export const DINNER_FROM = 17 * 60;

export interface ComposedStop {
  readonly option: DayOption;
  readonly arrive: number;
  readonly leave: number;
}

export interface ComposedDay {
  readonly stops: readonly ComposedStop[];
  /** Other places that fit the same beat at the same time. Swap candidates. */
  readonly alternatives: Readonly<Partial<Record<Phase, readonly DayOption[]>>>;
  /** Beats that couldn't be filled, said plainly. */
  readonly notes: readonly string[];
  /** Minutes after midnight, local. */
  readonly sunset?: number;
  readonly startAt: number;
  /** The day query the shared adventure core saves (`/api/adventures/[id]/days`). */
  readonly query: string;
}

/** Sunset on the day where the night starts, in local minutes after midnight. */
export function sunsetOf(day: NightDay): number | undefined {
  const light = daylightAt(
    day.latitude,
    day.longitude,
    zonedInstant(day.on, 12, day.timeZone),
  );
  return light ? wallMinutes(light.sunset, day.timeZone) : undefined;
}

/** "11:30am" — the way the Day Builder's sentence reader takes a time. */
export function spokenClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/** The sentence kept with the day, so later changes read the same mood. */
export function sentenceFor(answers: DayAnswers, startAt: number): string {
  const moods = answers.moods.length > 0 ? answers.moods : ["romantic"];
  const words = [
    `a ${moods.join(", ")} date for the two of us`,
    `leave at ${spokenClock(startAt)}`,
    `within ${answers.reach} minutes`,
  ];
  if (answers.budget === 1) words.push("keep it cheap");
  return words.join(", ");
}

interface Fit {
  readonly option: DayOption;
  readonly arrive: number;
  readonly leave: number;
}

function fitAt(
  option: DayOption,
  from: number,
  first: boolean,
  sunset: number | undefined,
  homeBy: number,
): Fit | null {
  let arrive = from + (first ? option.reach : MOVE);
  if (option.phase === "unwind") {
    arrive = Math.max(arrive, DINNER_FROM, option.opens ?? 0);
  } else if (option.opens !== undefined && option.opens > arrive) {
    if (option.opens - arrive > WAIT) return null;
    arrive = option.opens;
  }
  const leave = arrive + option.minutes;
  if (option.closes !== undefined && leave > option.closes) return null;
  if (option.daylight && (sunset === undefined || leave > sunset)) return null;
  if (leave > homeBy) return null;
  return { option, arrive, leave };
}

function allowed(option: DayOption, answers: DayAnswers): boolean {
  if (option.cost > answers.budget) return false;
  if (option.reach > answers.reach) return false;
  if (option.coldWater && !answers.plunge) return false;
  if (option.drinks && !answers.drinks) return false;
  return true;
}

function score(option: DayOption, moods: readonly Mood[]): number {
  const shared = option.moods.filter((m) => moods.includes(m)).length;
  // Stated hours are worth a little: a plan that is sure to be open.
  return shared * 10 + (option.hoursSource ? 1 : 0);
}

/**
 * The day for these answers. `swap` replaces the pick for one beat with a
 * named option where it still fits, which is how "show me another" works
 * without re-asking anything.
 */
export function composeDay(
  day: NightDay,
  answers: DayAnswers,
  swap: Readonly<Partial<Record<Phase, string>>> = {},
): ComposedDay {
  const sunset = sunsetOf(day);
  const homeBy = answers.short ? 20 * 60 + 30 : HOME_BY;
  const startAt = START_AT[answers.when];
  const stops: ComposedStop[] = [];
  const alternatives: Partial<Record<Phase, DayOption[]>> = {};
  const notes: string[] = [];
  let clock = startAt;

  for (const phase of PHASES) {
    if (answers.short && phase === "experience") continue;
    const fits = day.options
      .filter((o) => o.phase === phase && allowed(o, answers))
      .map((o) => fitAt(o, clock, stops.length === 0, sunset, homeBy))
      .filter((f): f is Fit => f !== null)
      .sort(
        (a, b) =>
          score(b.option, answers.moods) - score(a.option, answers.moods),
      );
    const wanted = swap[phase];
    const chosen = fits.find((f) => f.option.atlasRef === wanted) ?? fits[0];
    if (!chosen) {
      notes.push(missing(phase, sunset, clock));
      continue;
    }
    stops.push({
      option: chosen.option,
      arrive: chosen.arrive,
      leave: chosen.leave,
    });
    // A place sure to be open comes first among the alternatives: it is the
    // way out when an unknown-hours pick turns out to be closed.
    alternatives[phase] = fits
      .filter((f) => f !== chosen)
      .map((f) => f.option)
      .sort(
        (a, b) =>
          Number(Boolean(b.hoursSource)) - Number(Boolean(a.hoursSource)),
      );
    if (!chosen.option.hoursSource && !chosen.option.daylight) {
      const sure = alternatives[phase]![0];
      if (phase === "unwind")
        notes.push(
          sure?.hoursSource
            ? `${chosen.option.title} hasn't published its hours. Check first. ${sure.title} is open for sure, one tap away.`
            : `${chosen.option.title} hasn't published its hours. Check before you go.`,
        );
    }
    const free = chosen.arrive - (clock + MOVE);
    if (phase === "unwind" && stops.length > 1 && free >= 45)
      notes.push(
        `${minutesSaid(free)} free before ${chosen.option.title}. Go home, warm up, change into something nice.`,
      );
    clock = chosen.leave;
  }

  const query = writeDayQuery({
    stops: stops.map((s) => s.option.atlasRef),
    say: sentenceFor(answers, startAt),
    at: day.townId,
    on: day.on,
    mins: Object.fromEntries(
      stops.map((s) => [s.option.atlasRef, s.option.minutes]),
    ),
    rain: {},
  });
  // The answers ride along with the day (the core keeps every key but the
  // stops), so the next change starts from them instead of asking again.
  const kept = `${query}&night=${encodeURIComponent(writeAnswers(answers))}`;
  return {
    stops,
    alternatives,
    notes,
    ...(sunset !== undefined ? { sunset } : {}),
    startAt,
    query: kept,
  };
}

const MOODS: readonly Mood[] = ["romantic", "adventurous", "cozy", "playful"];

/** `day.30.3.romantic+adventurous.1.1.0` — compact, and read back strictly. */
export function writeAnswers(a: DayAnswers): string {
  return [
    a.when,
    a.reach,
    a.budget,
    a.moods.join("+"),
    a.plunge ? 1 : 0,
    a.drinks ? 1 : 0,
    a.short ? 1 : 0,
  ].join(".");
}

/** The answers a saved day was made from, or `null` if it wasn't made here. */
export function readAnswers(ask: string | null | undefined): DayAnswers | null {
  if (!ask) return null;
  const raw = new URLSearchParams(ask).get("night");
  if (!raw) return null;
  const [when, reach, budget, moods, plunge, drinks, short] = raw.split(".");
  if (!(when === "day" || when === "afternoon" || when === "evening"))
    return null;
  const r = Number(reach);
  const b = Number(budget);
  if (!(r === 15 || r === 30 || r === 60) || !(b === 1 || b === 2 || b === 3))
    return null;
  return {
    when,
    reach: r,
    budget: b,
    moods: (moods ?? "")
      .split("+")
      .filter((m): m is Mood => MOODS.includes(m as Mood)),
    plunge: plunge === "1",
    drinks: drinks === "1",
    ...(short === "1" ? { short: true } : {}),
  };
}

/** Which option holds each beat of a saved day — so a change keeps the rest. */
export function swapsOf(
  day: NightDay,
  stops: readonly string[],
): Partial<Record<Phase, string>> {
  const out: Partial<Record<Phase, string>> = {};
  for (const ref of stops) {
    const option = day.options.find((o) => o.atlasRef === ref);
    if (option && !out[option.phase]) out[option.phase] = ref;
  }
  return out;
}

function minutesSaid(minutes: number): string {
  const h = Math.round((minutes / 60) * 2) / 2;
  return h < 1 ? `${minutes} minutes` : h === 1 ? "An hour" : `${h} hours`;
}

function missing(phase: Phase, sunset: number | undefined, at: number): string {
  if (phase === "explore" && sunset !== undefined && at + 45 > sunset)
    return `It's dark by ${spokenClock(sunset)}, so the day skips the outdoor part.`;
  return `Nothing checked fits the ${PHASE_LABEL[phase].toLowerCase()} beat with these answers, so the day goes without one.`;
}
