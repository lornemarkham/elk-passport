import { zonedInstant } from "../conditions";
import {
  WARM_DINNER,
  type Ending,
  type Evening,
  type StopTag,
  type StopTemplate,
} from "./evenings";
import type { DayOption, NightDay } from "./types";

/**
 * **The night's one itinerary.**
 *
 * Whatever made it — choosing an adventure, the other ending, a sentence, a
 * tap on Move — the result is this list of stops, and it is stored as the
 * adventure's own day: one item per stop (`label` the title, `note` the
 * line, `starts_at` the time, `position` the order, `atlas_ref` where the
 * stop is a place Atlas holds). No new table. Both people read the same
 * rows; the owner changes them, the other person may add their own stops
 * (RLS, `20261021000000_passport_adventures.sql`).
 *
 * Times are laid out, not typed: each stop has a length and the drive
 * before it, and a stop that waits for the light (the sunset) pulls the
 * "stretch" stop before it longer or shorter so it still happens at sunset.
 * Pure, so every rule is pinned in tests without a browser.
 */

export interface PlanStop {
  /** The adventure item it is stored as, once stored. */
  readonly id?: string;
  /** The adventure's own stop it came from; absent for someone's own stop. */
  readonly key?: string;
  readonly title: string;
  readonly line: string;
  /** Minutes after local midnight. */
  readonly at: number;
  readonly minutes: number;
  /** The drive before it, in minutes. */
  readonly travel: number;
  readonly atlasRef?: string;
  readonly where?: string;
  readonly directions?: string;
  /** Who added it, when it wasn't the person who owns the plan. */
  readonly by?: string;
  readonly mine?: boolean;
}

/** What the rules know about a stop: its template, if it has one. */
export interface StopRule {
  readonly tags: readonly StopTag[];
  readonly least: number;
  readonly stretch: boolean;
  readonly beforeSunset?: number;
  readonly byAfterSunset?: number;
  readonly optional: boolean;
  readonly main: boolean;
  readonly option?: DayOption;
  readonly closesAt?: number;
  readonly romance?: StopTemplate["romance"];
}

/** Every stop template an adventure knows: its stops and both endings. */
export function templatesOf(evening: Evening): StopTemplate[] {
  return [...evening.stops, ...(evening.endings ?? []).flatMap((e) => e.stops)];
}

const optionKey = (ref: string) => `atlas:${ref}`;

/** A real Atlas place from the day, as a stop the plan can use. */
export function optionStop(
  option: DayOption,
  as: "dinner" | "fun",
  travel = option.reach,
): Omit<PlanStop, "at"> {
  return {
    key: as === "dinner" ? "dinner" : optionKey(option.atlasRef),
    title: as === "dinner" ? `Dinner at ${option.title}` : option.title,
    line: option.line,
    minutes: option.minutes,
    travel,
    atlasRef: option.atlasRef,
    where: option.title,
  };
}

export function ruleOf(
  evening: Evening | undefined,
  stop: Pick<PlanStop, "key" | "atlasRef">,
  day: NightDay,
): StopRule {
  const template = evening
    ? templatesOf(evening).find((t) => t.key === stop.key)
    : undefined;
  const option = stop.atlasRef
    ? day.options.find((o) => o.atlasRef === stop.atlasRef)
    : undefined;
  const tags: StopTag[] = template
    ? [...template.tags]
    : stop.key === "dinner"
      ? ["dinner", "food"]
      : option
        ? option.phase === "unwind"
          ? ["dinner", "food"]
          : ["fun", "explore"]
        : [];
  return {
    tags,
    least: template?.least ?? (template ? template.minutes : 15),
    stretch: Boolean(template?.stretch),
    ...(template?.beforeSunset !== undefined
      ? { beforeSunset: template.beforeSunset }
      : {}),
    ...(template?.byAfterSunset !== undefined
      ? { byAfterSunset: template.byAfterSunset }
      : option?.daylight
        ? { byAfterSunset: 0 }
        : {}),
    optional: Boolean(template?.optional),
    main: Boolean(template?.main),
    ...(option ? { option } : {}),
    ...(template?.closesAt !== undefined
      ? { closesAt: template.closesAt }
      : {}),
    ...(template?.romance ? { romance: template.romance } : {}),
  };
}

const fromTemplate = (t: StopTemplate): Omit<PlanStop, "at"> => ({
  key: t.key,
  title: t.title,
  line: t.line,
  minutes: t.minutes,
  travel: t.travel ?? 0,
  ...(t.atlasRef ? { atlasRef: t.atlasRef } : {}),
  ...(t.where ? { where: t.where } : {}),
  ...(t.directions ? { directions: t.directions } : {}),
});

/**
 * **Times, laid out.** From the leave time, each stop starts after the one
 * before it and its drive. A stop that waits for the sunset moves the
 * stretch stop before it — longer when there's time to spare, shorter (to
 * its least) when there isn't — so it lands at sunset. With no stretch stop
 * to give, the stop before it waits.
 */
export function layOut(
  stops: readonly Omit<PlanStop, "at">[],
  leaveAt: number,
  sunset: number,
  evening: Evening | undefined,
  day: NightDay,
): PlanStop[] {
  const out = stops.map((s) => ({ ...s, at: 0 }));
  const time = () => {
    let t = leaveAt;
    for (const s of out) {
      t += s.travel;
      s.at = t;
      t += s.minutes;
    }
  };
  time();
  const anchor = out.findIndex(
    (s) => ruleOf(evening, s, day).beforeSunset !== undefined,
  );
  if (anchor > 0) {
    const want = sunset - ruleOf(evening, out[anchor]!, day).beforeSunset!;
    const diff = want - out[anchor]!.at;
    if (diff > 0 || diff < -5) {
      let j = anchor - 1;
      while (j >= 0 && !ruleOf(evening, out[j]!, day).stretch) j--;
      const giver = j >= 0 ? out[j]! : diff > 0 ? out[anchor - 1]! : null;
      if (giver) {
        const least = j >= 0 ? ruleOf(evening, giver, day).least : 0;
        giver.minutes = Math.max(least, giver.minutes + diff);
        time();
      }
    }
  }
  // A place that closes ends the stop there, never below its least; what
  // still runs over is said by `warningsFor`.
  out.forEach((s) => {
    const rule = ruleOf(evening, s, day);
    if (rule.closesAt === undefined || s.at + s.minutes <= rule.closesAt)
      return;
    s.minutes = Math.max(rule.least, rule.closesAt - s.at);
    time();
  });
  return out;
}

/** The plan an adventure starts with, laid out for the day. */
export function templatePlan(
  evening: Evening,
  sunset: number,
  day: NightDay,
  endingId?: string,
): PlanStop[] {
  const ending =
    evening.endings?.find((e) => e.id === endingId) ?? evening.endings?.[0];
  return layOut(
    [...evening.stops, ...(ending?.stops ?? [])].map(fromTemplate),
    evening.leaveAt,
    sunset,
    evening,
    day,
  );
}

/** Which ending the plan is on, read from its stops. */
export function endingOf(
  stops: readonly PlanStop[],
  evening: Evening | undefined,
): Ending | undefined {
  const keys = new Set(stops.map((s) => s.key));
  return evening?.endings?.find((e) =>
    e.stops.some((t) => t.key !== "home" && keys.has(t.key)),
  );
}

/**
 * **The other ending, the rest untouched.** Everything before the ending —
 * including anything somebody changed or added — stays as it is; only the
 * old ending's own stops go, and the new one's follow.
 */
export function switchEnding(
  stops: readonly PlanStop[],
  evening: Evening,
  to: string,
  sunset: number,
  day: NightDay,
): PlanStop[] {
  const ending = evening.endings?.find((e) => e.id === to);
  if (!ending) return [...stops];
  const endingKeys = new Set(
    (evening.endings ?? []).flatMap((e) => e.stops.map((t) => t.key)),
  );
  const kept = stops.filter((s) => !s.key || !endingKeys.has(s.key));
  return layOut(
    [...kept, ...ending.stops.map(fromTemplate)],
    stops[0]?.at ?? evening.leaveAt,
    sunset,
    evening,
    day,
  );
}

// ------------------------------------------------------------- hand edits

/** The first stop is leaving and the last is home; those two stay put. */
export const fixedAt = (stops: readonly PlanStop[], index: number): boolean =>
  index === 0 || (index === stops.length - 1 && stops[index]?.key === "home");

export function moveStop(
  stops: readonly PlanStop[],
  index: number,
  direction: -1 | 1,
  sunset: number,
  evening: Evening | undefined,
  day: NightDay,
): PlanStop[] | null {
  const to = index + direction;
  if (fixedAt(stops, index) || to < 0 || to >= stops.length) return null;
  if (fixedAt(stops, to)) return null;
  const next = [...stops];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return layOut(next, stops[0]!.at, sunset, evening, day);
}

export function removeStop(
  stops: readonly PlanStop[],
  index: number,
  sunset: number,
  evening: Evening | undefined,
  day: NightDay,
): PlanStop[] | null {
  if (fixedAt(stops, index) || !stops[index]) return null;
  return layOut(
    stops.filter((_, i) => i !== index),
    stops[0]!.at,
    sunset,
    evening,
    day,
  );
}

/** Put a stop after `after` (an index), or before home by default. */
export function addStop(
  stops: readonly PlanStop[],
  stop: Omit<PlanStop, "at">,
  after: number | undefined,
  sunset: number,
  evening: Evening | undefined,
  day: NightDay,
): PlanStop[] {
  const homeLast = stops[stops.length - 1]?.key === "home";
  const at = Math.min(
    after ?? (homeLast ? stops.length - 2 : stops.length - 1),
    homeLast ? stops.length - 2 : stops.length - 1,
  );
  const next = [...stops];
  next.splice(at + 1, 0, { ...stop, at: 0 });
  return layOut(next, stops[0]?.at ?? 17 * 60, sunset, evening, day);
}

export function changeStop(
  stops: readonly PlanStop[],
  index: number,
  patch: Partial<Pick<PlanStop, "title" | "line" | "minutes" | "where">>,
  sunset: number,
  evening: Evening | undefined,
  day: NightDay,
): PlanStop[] {
  const next = stops.map((s, i) => (i === index ? { ...s, ...patch } : s));
  return layOut(next, stops[0]!.at, sunset, evening, day);
}

/** Every stop moved so the plan leaves at `leaveAt`, sunset still honoured. */
export const leaveAtTime = (
  stops: readonly PlanStop[],
  leaveAt: number,
  sunset: number,
  evening: Evening | undefined,
  day: NightDay,
): PlanStop[] => layOut(stops, leaveAt, sunset, evening, day);

/**
 * **Home by a time**, taking minutes off what comes after the sunset —
 * latest first, never below each stop's least, never from a stop the person
 * just asked for more of. Returns what is still over, if anything.
 */
export function homeBy(
  stops: readonly PlanStop[],
  by: number,
  sunset: number,
  evening: Evening | undefined,
  day: NightDay,
  protect: ReadonlySet<number> = new Set(),
): { stops: PlanStop[]; over: number; trimmed: string[] } {
  let next = stops.map((s) => ({ ...s }));
  const end = () => next[next.length - 1]!.at + next[next.length - 1]!.minutes;
  let over = end() - by;
  const trimmed: string[] = [];
  if (over <= 0) return { stops: next, over: 0, trimmed };
  const anchor = next.findIndex(
    (s) => ruleOf(evening, s, day).beforeSunset !== undefined,
  );
  for (let i = next.length - 1; i > Math.max(anchor, 0) && over > 0; i--) {
    if (fixedAt(next, i) || protect.has(i)) continue;
    const rule = ruleOf(evening, next[i]!, day);
    const give = Math.min(over, next[i]!.minutes - rule.least);
    if (give <= 0) continue;
    next[i] = { ...next[i]!, minutes: next[i]!.minutes - give };
    trimmed.push(next[i]!.title);
    next = layOut(next, next[0]!.at, sunset, evening, day);
    over = end() - by;
  }
  return { stops: next, over: Math.max(0, over), trimmed: trimmed.reverse() };
}

// ---------------------------------------------------------------- reading

/** A stored item, as much of it as the itinerary needs. */
export interface StoredStop {
  readonly id: string;
  readonly label: string | null;
  readonly note: string | null;
  readonly atlasRef: string | null;
  /** Minutes after local midnight, or null when it has no time. */
  readonly at: number | null;
  readonly position: number;
  readonly by?: string | null;
  readonly mine?: boolean;
}

/**
 * **The stored day, back as an itinerary.** `null` when the day isn't one
 * this itinerary wrote (no times: the earlier shape, a list of Atlas
 * places), so the page shows the adventure's own plan until it is saved
 * in this shape.
 */
export function planFromItems(
  items: readonly StoredStop[],
  evening: Evening | undefined,
  day: NightDay,
): PlanStop[] | null {
  if (items.length === 0 || items.some((i) => i.at === null)) return null;
  const sorted = [...items].sort(
    (a, b) => a.at! - b.at! || a.position - b.position,
  );
  // "Home" is in both endings, with a different drive before it: read the
  // ending from the stops only it has, and look there first.
  const titles = new Set(sorted.map((i) => i.label));
  const ending = evening?.endings?.find((e) =>
    e.stops.some((t) => t.key !== "home" && titles.has(t.title)),
  );
  const templates = evening
    ? [...evening.stops, ...(ending?.stops ?? []), ...templatesOf(evening)]
    : [];
  const keyed = sorted.map((item) => {
    const template =
      templates.find((t) => t.title === item.label) ??
      (item.label?.startsWith("Dinner at ") && item.atlasRef
        ? { ...WARM_DINNER, title: item.label }
        : undefined);
    const option = item.atlasRef
      ? day.options.find((o) => o.atlasRef === item.atlasRef)
      : undefined;
    const key =
      template?.key ?? (option ? optionKey(option.atlasRef) : undefined);
    return { item, template, key };
  });
  return keyed.map(({ item, template, key }, i) => {
    const next = keyed[i + 1];
    const nextTravel = next?.template?.travel ?? 0;
    // A stop somebody added in between keeps a sensible length until the
    // owner's next change lays the night out again.
    const minutes = next
      ? Math.max(
          template || i === 0 ? 0 : 15,
          next.item.at! - item.at! - nextTravel,
        )
      : (template?.minutes ?? 0);
    const previous = keyed[i - 1];
    return {
      id: item.id,
      ...(key ? { key } : {}),
      title: item.label ?? "A stop",
      line: template?.title === item.label ? template.line : (item.note ?? ""),
      at: item.at!,
      minutes,
      travel: previous ? (template?.travel ?? 0) : 0,
      ...(item.atlasRef ? { atlasRef: item.atlasRef } : {}),
      ...(template?.where ? { where: template.where } : {}),
      ...(template?.directions ? { directions: template.directions } : {}),
      ...(item.by ? { by: item.by } : {}),
      ...(item.mine !== undefined ? { mine: item.mine } : {}),
    };
  });
}

// ---------------------------------------------------------------- honesty

export interface Warning {
  readonly stop?: number;
  readonly line: string;
}

/**
 * **What the plan, as laid out, gets wrong** — said on the stop, never
 * fixed behind anyone's back: hunting after legal hours, a dip after dark,
 * a place outside its stated hours, a sunset missed.
 */
export function warningsFor(
  stops: readonly PlanStop[],
  sunset: number,
  evening: Evening | undefined,
  day: NightDay,
): Warning[] {
  const out: Warning[] = [];
  stops.forEach((s, i) => {
    const rule = ruleOf(evening, s, day);
    const end = s.at + s.minutes;
    if (rule.tags.includes("hunt")) {
      if (end > sunset + 60)
        out.push({
          stop: i,
          line: `Legal hunting ends at ${clock(sunset + 60)}, an hour after sunset.`,
        });
      else if (s.at >= sunset - 15)
        out.push({
          stop: i,
          line: "That's too late in the day to hunt well. Leave earlier, or call it scouting.",
        });
    }
    if (
      rule.tags.includes("swim") &&
      !rule.tags.includes("pools") &&
      end > sunset
    )
      out.push({
        stop: i,
        line: "That's a dip after sunset. Move it earlier or skip it.",
      });
    if (
      rule.byAfterSunset !== undefined &&
      !rule.tags.includes("hunt") &&
      !rule.tags.includes("swim") &&
      s.at > sunset + rule.byAfterSunset
    )
      out.push({ stop: i, line: "This one needs daylight." });
    if (rule.closesAt !== undefined && end > rule.closesAt)
      out.push({
        stop: i,
        line: `${s.title} closes at ${clock(rule.closesAt)}.`,
      });
    if (rule.beforeSunset !== undefined && s.at > sunset + 5)
      out.push({
        stop: i,
        line: `Sunset's at ${clock(sunset)}. This misses it.`,
      });
    const option = rule.option;
    if (option) {
      if (option.opens !== undefined && option.closes !== undefined) {
        if (s.at < option.opens)
          out.push({
            stop: i,
            line: `${option.title} opens at ${clock(option.opens)}.`,
          });
        else if (end > option.closes)
          out.push({
            stop: i,
            line: `${option.title} closes at ${clock(option.closes)}.`,
          });
      } else if (option.caution && option.phase === "unwind")
        // A dinner with no stated hours says so; other cautions are the
        // adventure's own Before-you-go list.
        out.push({ stop: i, line: option.caution });
    }
  });
  const last = stops[stops.length - 1];
  if (last && last.at > 23 * 60)
    out.push({ line: `Home after ${clock(23 * 60)}. Long night.` });
  return out;
}

/** "5:35 pm" — on the screen, to five minutes. */
export function clock(minutes: number): string {
  const m = Math.round(minutes / 5) * 5;
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** When the plan ends: the last stop's time. */
export const homeAt = (stops: readonly PlanStop[]): number | undefined =>
  stops.length
    ? stops[stops.length - 1]!.at + stops[stops.length - 1]!.minutes
    : undefined;

/** Same plan? Compared the way a person would: titles and times. */
export function samePlan(
  a: readonly PlanStop[],
  b: readonly PlanStop[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (s, i) =>
        s.title === b[i]!.title &&
        Math.abs(s.at - b[i]!.at) < 5 &&
        s.line === b[i]!.line,
    )
  );
}

/** The adventure's own plan, untouched — the only one a new choice may replace without asking. */
export function untouched(
  stops: readonly PlanStop[],
  evening: Evening | undefined,
  sunset: number,
  day: NightDay,
): boolean {
  if (!evening || evening.composed) return true;
  return (evening.endings ?? [undefined]).some((e) =>
    samePlan(stops, templatePlan(evening, sunset, day, e?.id)),
  );
}

/** Minutes after local midnight on the day, as the instant it falls on. */
export function instantOf(day: NightDay, at: number): string {
  const hour = zonedInstant(day.on, Math.floor(at / 60), day.timeZone);
  return new Date(hour.getTime() + (at % 60) * 60_000).toISOString();
}
