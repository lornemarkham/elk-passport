import type { DayForecast } from "../conditions";
import { EVENINGS, type Evening } from "./evenings";
import {
  clock,
  endingOf,
  homeAt,
  homeBy,
  layOut,
  ruleOf,
  samePlan,
  switchEnding,
  templatePlan,
  templatesOf,
  warningsFor,
  type PlanStop,
  type Warning,
} from "./itinerary";
import type { NightDay } from "./types";

/**
 * **When we leave changes what the day can be.**
 *
 * Moving the leave time is not "shift every stop". A later start eats the
 * daylight the outdoors needs, pushes dinner, and brings everyone home later;
 * an earlier one gives the light back. So a new leave time is answered with a
 * few honest ways to spend it, each laid out by the same rules as every other
 * change (`itinerary.ts`: drives, each stop's least, the sunset anchor, a
 * place's closing time) and each saying what it gives up:
 *
 * - **Everything, just later** — the plan as it is, with whatever warnings
 *   that brings. Preserving it is always allowed; it's never silent.
 * - **Tighter** — optional stops dropped and the rest at their least before
 *   the sunset, so the sunset still happens.
 * - **All the light for the main thing** — the stops between it and the
 *   sunset go, and it runs until the light does.
 * - **The other ending** — dinner moves (into town, or to the fire).
 * - **A closer adventure** — another of the night's adventures that fits
 *   the time without a warning, at its own leave time if that's later.
 *
 * Nothing here knows a drive Passport didn't already have: drives are the
 * plan's own estimates, and a closer place for something (a closer place to
 * hunt) is never invented — it says so instead. Pure, so every rule is pinned
 * in tests.
 */

export interface DepartureOption {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly stops: readonly PlanStop[];
  /** The adventure it's on: another one for a closer choice. */
  readonly evening: Evening | undefined;
  readonly home: number;
  readonly warnings: readonly Warning[];
  /** What it gives up or moves, said plainly. */
  readonly trades: readonly Trade[];
  readonly recommended: boolean;
}

/** One thing an option changes: a stop gone (−), added (+) or changed (~). */
export interface Trade {
  readonly sign: "+" | "-" | "~";
  readonly text: string;
}

export interface Departure {
  readonly leaveAt: number;
  /** The leave time the plan has now. */
  readonly was: number;
  /** Daylight at the main stop, when it needs it. */
  readonly light: string | null;
  /** The forecast's say, when the server read one. */
  readonly weather: string | null;
  readonly options: readonly DepartureOption[];
  /** What Passport doesn't know, said so nobody reads it as checked. */
  readonly honest: readonly string[];
}

/** "1 h 40", "45 min". */
export function span(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60}` : `${h} h`;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const identity = (s: PlanStop) => s.key ?? s.id ?? s.title;

/** Drop stops; the drive to a dropped stop still has to happen. */
function without(
  stops: readonly PlanStop[],
  drop: ReadonlySet<number>,
): PlanStop[] {
  const out: PlanStop[] = [];
  let carry = 0;
  stops.forEach((s, i) => {
    if (drop.has(i)) {
      carry += s.travel;
      return;
    }
    out.push(carry ? { ...s, travel: s.travel + carry } : s);
    carry = 0;
  });
  return out;
}

/** What a person calls the main thing: "the hunt". */
function shortOf(
  evening: Evening | undefined,
  stop: PlanStop | undefined,
): string {
  const template = evening
    ? templatesOf(evening).find((t) => t.key === stop?.key)
    : undefined;
  return template?.short ?? (stop ? lowerFirst(stop.title) : "the main thing");
}

/** What changed between two plans, as a person would say it. */
export function tradesOf(
  before: readonly PlanStop[],
  after: readonly PlanStop[],
  evening: Evening | undefined,
  day: NightDay,
): Trade[] {
  const was = new Map(before.map((s) => [identity(s), s]));
  const out: Trade[] = [];
  for (const s of after) {
    const old = was.get(identity(s));
    if (!old) {
      if (s.key !== "home") out.push({ sign: "+", text: s.title });
      continue;
    }
    const food = ruleOf(evening, s, day).tags.includes("dinner");
    if (food && Math.abs(s.at - old.at) >= 10)
      out.push({
        sign: "~",
        text: `${s.title} at ${clock(s.at)}, not ${clock(old.at)}`,
      });
    else if (
      s.key !== "leave" &&
      s.key !== "home" &&
      Math.abs(s.minutes - old.minutes) >= 5
    )
      out.push({
        sign: "~",
        text: `${s.title}: ${span(s.minutes)}${old.minutes ? `, not ${span(old.minutes)}` : ""}`,
      });
  }
  const kept = new Set(after.map(identity));
  for (const s of before)
    if (!kept.has(identity(s))) out.push({ sign: "-", text: s.title });
  return out;
}

/** The warnings that say the day doesn't work as laid out. */
const misses = (warnings: readonly Warning[]) => warnings.length;

/**
 * **Tighter**: optional stops before the sunset go first, then everything
 * before it (but the main thing) comes down to its least, then the stops
 * between the main thing and the sunset go one by one, latest first — until
 * the day works or there's nothing left to give.
 */
function tighter(
  stops: readonly PlanStop[],
  leaveAt: number,
  sunset: number,
  evening: Evening | undefined,
  day: NightDay,
): PlanStop[] {
  const lay = (s: readonly PlanStop[]) =>
    layOut(s, leaveAt, sunset, evening, day);
  const anchorOf = (s: readonly PlanStop[]) =>
    s.findIndex((x) => ruleOf(evening, x, day).beforeSunset !== undefined);
  const ok = (s: readonly PlanStop[]) =>
    misses(warningsFor(s, sunset, evening, day)) === 0;

  let next = lay(stops);
  if (ok(next)) return next;
  const anchor = anchorOf(next);
  const until = anchor >= 0 ? anchor : next.length - 1;

  // 1. Optional stops before the sunset (a dip) go.
  next = lay(
    without(
      next,
      new Set(
        next.flatMap((s, i) =>
          i > 0 && i < until && ruleOf(evening, s, day).optional ? [i] : [],
        ),
      ),
    ),
  );
  if (ok(next)) return next;

  // 2. Everything before the sunset comes down to its least.
  const a2 = anchorOf(next);
  next = lay(
    next.map((s, i) => {
      if (i === 0 || (a2 >= 0 && i >= a2) || s.key === "home") return s;
      if (ruleOf(evening, s, day).main) return s;
      return { ...s, minutes: ruleOf(evening, s, day).least };
    }),
  );
  if (ok(next)) return next;

  // 3. The stops between the main thing and the sunset go, latest first.
  for (;;) {
    const a = anchorOf(next);
    if (a < 0) break;
    const main = next.findIndex((s) => ruleOf(evening, s, day).main);
    let drop = -1;
    for (let i = a - 1; i > Math.max(main, 0); i--)
      if (!ruleOf(evening, next[i]!, day).main) {
        drop = i;
        break;
      }
    if (drop < 0) break;
    next = lay(without(next, new Set([drop])));
    if (ok(next)) return next;
  }
  return next;
}

/**
 * **All the light for the main thing**: when the main stop needs daylight
 * and there's a sunset stop after it, drop what's between (and the sunset
 * stop) and let the main thing run until the light goes.
 */
function mainFirst(
  stops: readonly PlanStop[],
  leaveAt: number,
  sunset: number,
  evening: Evening | undefined,
  day: NightDay,
): PlanStop[] | null {
  const main = stops.findIndex((s) => ruleOf(evening, s, day).main);
  const anchor = stops.findIndex(
    (s) => ruleOf(evening, s, day).beforeSunset !== undefined,
  );
  if (main <= 0 || anchor <= main) return null;
  const rule = ruleOf(evening, stops[main]!, day);
  if (rule.byAfterSunset === undefined) return null;
  // A cold dip is never lengthened.
  if (rule.tags.includes("swim") && !rule.tags.includes("pools")) return null;
  const drop = new Set<number>();
  for (let i = main + 1; i <= anchor; i++) drop.add(i);
  const laid = layOut(without(stops, drop), leaveAt, sunset, evening, day);
  const m = laid.findIndex((s) => ruleOf(evening, s, day).main);
  const until = sunset + rule.byAfterSunset;
  const minutes = Math.max(rule.least, until - laid[m]!.at);
  return layOut(
    laid.map((s, i) => (i === m ? { ...s, minutes } : s)),
    leaveAt,
    sunset,
    evening,
    day,
  );
}

function weatherSaid(forecast: DayForecast | undefined): string | null {
  if (!forecast) return null;
  const words = forecast.words.slice(0, 2).join(", ");
  const wet =
    (forecast.wettestChance ?? 0) >= 60 ||
    /rain|snow|showers|flurries|freezing|sleet/i.test(forecast.words.join(" "));
  const chance =
    forecast.wettestChance !== undefined
      ? `, ${forecast.wettestChance}% chance of precipitation`
      : "";
  return `${forecast.source} for ${forecast.city ?? "town"}: ${words || "no words"}${chance}.${
    wet
      ? " Wetter and colder up high; the outdoor stops may be shorter than planned."
      : ""
  }`;
}

/**
 * **The ways to leave at `leaveAt`.** `stops` is the plan as it is now.
 * `evenings` are the night's other adventures, for a closer choice.
 */
export function departure({
  stops,
  leaveAt,
  sunset,
  evening,
  day,
  evenings = EVENINGS,
  forecast,
}: {
  stops: readonly PlanStop[];
  leaveAt: number;
  sunset: number;
  evening: Evening | undefined;
  day: NightDay;
  evenings?: readonly Evening[];
  forecast?: DayForecast | undefined;
}): Departure {
  const was = stops[0]?.at ?? leaveAt;
  const options: DepartureOption[] = [];
  const add = (
    o: Omit<DepartureOption, "home" | "warnings" | "recommended">,
  ) => {
    const on = o.evening;
    if (
      options.some(
        (x) => x.evening?.id === on?.id && samePlan(x.stops, o.stops),
      )
    )
      return;
    const warnings = warningsFor(o.stops, sunset, on, day);
    // Only the plan as it is may come with a warning: an alternative is
    // offered because it works.
    if (o.id !== "keep" && warnings.length > 0) return;
    options.push({
      ...o,
      home: homeAt(o.stops) ?? leaveAt,
      warnings,
      recommended: false,
    });
  };

  const main = stops.find((s) => ruleOf(evening, s, day).main);
  const short = shortOf(evening, main);

  // 1. Everything, just later (or earlier).
  const kept = layOut(stops, leaveAt, sunset, evening, day);
  const later = leaveAt > was;
  add({
    id: "keep",
    title: later ? "Everything, just later" : "Everything, just earlier",
    line: `Every stop stays, ${span(Math.abs(leaveAt - was))} ${later ? "later" : "earlier"}.`,
    stops: kept,
    evening,
    trades: tradesOf(stops, kept, evening, day),
  });

  // 2. Tighter.
  const tight = tighter(stops, leaveAt, sunset, evening, day);
  const keepsSunset = tight.some(
    (s) => ruleOf(evening, s, day).beforeSunset !== undefined,
  );
  add({
    id: "tighter",
    title: keepsSunset
      ? `Shorter ${short.replace(/^the /, "")}, still the sunset`
      : "Tighter",
    line: keepsSunset
      ? `Less of ${short} and the extras, so you're there when the sun goes.`
      : "The extras go so the rest fits.",
    stops: tight,
    evening,
    trades: tradesOf(stops, tight, evening, day),
  });

  // 3. All the light for the main thing.
  const first = mainFirst(stops, leaveAt, sunset, evening, day);
  if (first) {
    const m = first.find((s) => ruleOf(evening, s, day).main);
    const tm = tight.find((s) => ruleOf(evening, s, day).main);
    if (m && (!tm || m.minutes >= tm.minutes + 5))
      add({
        id: "main-first",
        title: `All the light for ${short}`,
        line: `${main?.title ?? "The main thing"} until the light goes, then straight on. The sunset stop goes.`,
        stops: first,
        evening,
        trades: tradesOf(stops, first, evening, day),
      });
  }

  // 4. Home at a sensible hour, when "just later" runs long.
  const LATE = 23 * 60;
  if ((homeAt(kept) ?? 0) > LATE) {
    const by = homeBy(kept, LATE, sunset, evening, day);
    if (by.trimmed.length > 0)
      add({
        id: "home-by",
        title: `Home by ${clock(LATE)}`,
        line:
          by.over > 0
            ? `As much as gives, and still ${span(by.over)} past ${clock(LATE)}.`
            : `${by.trimmed.join(" and ")} shorter, home by ${clock(LATE)}.`,
        stops: by.stops,
        evening,
        trades: tradesOf(stops, by.stops, evening, day),
      });
  }

  // 5. The other ending: dinner moves.
  const on = endingOf(stops, evening);
  const base =
    misses(warningsFor(tight, sunset, evening, day)) === 0 ? tight : kept;
  for (const ending of evening?.endings ?? []) {
    if (ending.id === on?.id) continue;
    const other = switchEnding(base, evening!, ending.id, sunset, day);
    const food = other.find((s) =>
      ruleOf(evening, s, day).tags.includes("dinner"),
    );
    add({
      id: `ending:${ending.id}`,
      title: food
        ? `${ending.title}: ${lowerFirst(food.title)} at ${clock(food.at)}`
        : ending.title,
      line: ending.line,
      stops: other,
      evening,
      trades: tradesOf(stops, other, evening, day),
    });
  }

  // 6. A closer adventure that fits without a warning.
  // How far the main thing is: every drive up to and including it.
  const driveTo = (s: readonly PlanStop[], e: Evening | undefined) => {
    const i = s.findIndex((x) => ruleOf(e, x, day).main);
    return i > 0 ? s.slice(1, i + 1).reduce((t, x) => t + x.travel, 0) : 0;
  };
  const ours = driveTo(kept, evening);
  for (const e of evenings) {
    if (e.composed || e.id === evening?.id) continue;
    const plan = templatePlan(e, sunset, day);
    const from = Math.max(leaveAt, e.leaveAt);
    const laid = layOut(plan, from, sunset, e, day);
    if (driveTo(laid, e) >= ours) continue;
    if (misses(warningsFor(laid, sunset, e, day)) > 0) continue;
    const theirs = laid.find((s) => ruleOf(e, s, day).main);
    add({
      id: `evening:${e.id}`,
      title: `Closer: ${e.title}`,
      line: `${e.drive}. Leaves ${clock(from)}${from > leaveAt ? ", its own time" : ""}.${
        main &&
        ruleOf(evening, main, day).tags.includes("hunt") &&
        !(theirs && ruleOf(e, theirs, day).tags.includes("hunt"))
          ? " No hunting on this one."
          : ""
      }`,
      stops: laid,
      evening: e,
      trades: [],
    });
  }

  // The first one that works is the suggestion; none, and none is.
  const best = options.find((o) => o.warnings.length === 0);
  const ranked = options.map((o) => ({ ...o, recommended: o === best }));

  const laidMain = kept.find((s) => ruleOf(evening, s, day).main);
  const mainRule = laidMain ? ruleOf(evening, laidMain, day) : undefined;
  let light: string | null = null;
  if (laidMain && mainRule?.byAfterSunset !== undefined) {
    const left = sunset - laidMain.at;
    const where = laidMain.where ?? laidMain.title;
    light =
      left > 0
        ? `At ${where} about ${clock(laidMain.at)}: ${span(left)} of daylight before sunset at ${clock(sunset)}.`
        : `At ${where} about ${clock(laidMain.at)}, after sunset at ${clock(sunset)}.`;
    if (mainRule.tags.includes("hunt"))
      light += ` Legal hunting ends at ${clock(sunset + 60)}, an hour after sunset.`;
  }

  const honest = [
    "Drive times are the plan's own estimates from route maps, not live traffic or road conditions.",
    ...(mainRule?.tags.includes("hunt")
      ? [
          "Passport doesn't know a closer place to hunt that anyone has checked, so it won't suggest one. Access, closures and No Shooting Areas are yours to check.",
        ]
      : []),
  ];

  return {
    leaveAt,
    was,
    light,
    weather: weatherSaid(forecast),
    options: ranked,
    honest,
  };
}
