import {
  answer,
  availableFor,
  DRIVE_REACH_KM,
  DRIVE_THEMES,
  hasPicture,
  IDENTITY,
  NOT_AN_OUTING,
  type Ask,
  type Find,
} from "./discover";
import { THEMES, themeById, type ThemeId } from "./themes";
import { addDays, newYear, presetDates } from "./when";
import { longRun } from "./ways";

/**
 * **One Christmas discovery, answered once and filtered in the hand**
 * (owner brief M1128, "One Beautiful Experience").
 *
 * The server answers _where, when and how far_ once, for every category at
 * once (`finderData`). Categories are then a filter the visitor's own phone
 * applies (`viewOf`) — several at a time, OR between them — so a tap changes
 * the results at once, with no trip back to the server and nothing lost.
 *
 * What each category holds is known before it is offered: a chip says how
 * many there are for this place, these days and this distance, and a
 * category with none is not offered as a choice. It is said apart, with the
 * next days it _is_ confirmed on, where there are any (`availability`).
 *
 * When nothing matches, the answer is a host's, not a search engine's
 * (`hostFor`): what is actually on, the next confirmed days, other things
 * on the same day, and what is a little further — each one a choice the
 * visitor makes. Passport never moves their date or their distance for them.
 */

/** What a finder can show without asking the server again. */
export interface FinderData {
  /** Everything within the radius that fits the days, every category, ranked. */
  readonly near: readonly Find[];
  /** Within the radius, but not confirmed for the days asked. */
  readonly maybe: readonly Find[];
  /** Big named Christmas outings beyond the radius, dates confirmed. */
  readonly drive: readonly Find[];
  /** A dated ask only: confirmed for those days, a little beyond the radius. */
  readonly further: readonly Find[];
  /** A dated ask only: confirmed within the radius, on later days. */
  readonly later: readonly Find[];
  /** How many each category holds for the ask, before any cap. */
  readonly counts: Readonly<Partial<Record<ThemeId, number>>>;
  /** How many `near` holds for the ask, before any cap. */
  readonly total: number;
  /** Listings with no confirmed place — counted, never called near. */
  readonly unplaced: number;
  /** Those listings themselves, only when somebody asked to see them. */
  readonly unplacedFinds: readonly Find[];
  /** Listings from earlier years — counted, never shown as this year's. */
  readonly past: number;
  /** What each rule set aside, for whoever asks how the list was made. */
  readonly removed: Readonly<Record<string, number>>;
  /** Whether New Year's Eve belongs in this view (`newYearInView`). */
  readonly newYear: boolean;
}

/** How far "a little further" reaches for a dated ask. */
export const FURTHER_KM = 60;
/** Most finds a view carries; a phone is not a database. */
export const NEAR_CAP = 90;
const PER_THEME = 8;
const LATER_PER_THEME = 3;
const FURTHER_CAP = 12;
const MAYBE_CAP = 24;

/**
 * **New Year's Eve is part of the season, not a rival to it** (owner brief
 * M1128). It is in view when the days asked touch December 31 or January 1,
 * from Boxing Day on, or when somebody asked for it by name; otherwise its
 * own listings stay out of _everything_ and its chip is not offered. It is
 * never hidden from a person who chose it.
 */
export function newYearInView(
  ask: Pick<Ask, "from" | "to" | "themes">,
  today: string,
): boolean {
  if (ask.themes.includes("newyear")) return true;
  const { eve, day } = newYear(today);
  if (ask.from || ask.to) {
    const from = ask.from ?? ask.to!;
    const to = ask.to ?? from;
    return from <= day && to >= eve;
  }
  return today >= addDays(eve, -5);
}

/** A New Year's listing and nothing else. */
const newYearOnly = (f: Find) =>
  f.reading.themes.length > 0 && f.reading.themes.every((t) => t === "newyear");

/** Whether a find belongs to a set of categories (none chosen: everything). */
export function inThemes(
  f: Find,
  themes: readonly ThemeId[],
  newYear: boolean,
): boolean {
  if (themes.length === 0) return newYear || !newYearOnly(f);
  return f.reading.themes.some((t) => themes.includes(t));
}

const ids = (list: readonly Find[]) =>
  new Set(list.map((f) => f.experience.id));

/**
 * The first `cap` in order, plus each category's best few beyond it, so a
 * filter never empties for want of room.
 */
function capped(list: readonly Find[], cap: number): Find[] {
  const head = list.slice(0, cap);
  const kept = ids(head);
  const extra: Find[] = [];
  for (const t of THEMES) {
    let n = head.filter((f) => f.reading.themes.includes(t.id)).length;
    for (const f of list.slice(cap)) {
      if (n >= PER_THEME) break;
      if (!f.reading.themes.includes(t.id) || kept.has(f.experience.id))
        continue;
      kept.add(f.experience.id);
      extra.push(f);
      n++;
    }
  }
  return [...head, ...extra];
}

/**
 * **The one server answer a finder needs** — every category, the ask's
 * place, days and distance. `ask.themes` is ignored here: categories are
 * the visitor's filter (`viewOf`).
 */
export function finderData(
  finds: readonly Find[],
  ask: Ask,
  context: { readonly today: string; readonly now?: Date },
): FinderData {
  const all = { ...ask, themes: [] };
  const base = answer(finds, all, context);
  const shelf = (id: string) =>
    base.shelves.find((s) => s.id === id)?.finds ?? [];
  const near = shelf("near");
  const dated = Boolean(ask.from || ask.to);
  const newYear = newYearInView(ask, context.today);

  const counts: Partial<Record<ThemeId, number>> = {};
  for (const t of THEMES)
    counts[t.id] = near.filter((f) => f.reading.themes.includes(t.id)).length;

  let further: Find[] = [];
  let later: Find[] = [];
  if (dated) {
    const inside = ids(near);
    // Confirmed for the same days, a little further out — offered, never
    // folded into "near".
    further = (
      answer(finds, { ...all, km: Math.max(FURTHER_KM, ask.km * 2) }, context)
        .shelves.find((s) => s.id === "near")
        ?.finds.filter((f) => !inside.has(f.experience.id)) ?? []
    )
      .slice()
      .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
      .slice(0, FURTHER_CAP);
    // The same radius, any day: what is confirmed after the days asked.
    const end = ask.to ?? ask.from!;
    const undated = answer(
      finds,
      { ...all, when: undefined, from: undefined, to: undefined },
      context,
    );
    const upcoming = (undated.shelves.find((s) => s.id === "near")?.finds ?? [])
      .filter(
        (f) =>
          f.when.confidence === "dated" &&
          f.when.from !== undefined &&
          nextDay(f, end) !== undefined,
      )
      .sort((a, b) => nextDay(a, end)!.localeCompare(nextDay(b, end)!));
    const kept = new Set<string>();
    for (const t of THEMES) {
      let n = 0;
      for (const f of upcoming) {
        if (n >= LATER_PER_THEME) break;
        if (!f.reading.themes.includes(t.id)) continue;
        n++;
        if (!kept.has(f.experience.id)) {
          kept.add(f.experience.id);
          later.push(f);
        }
      }
    }
    later = later.sort((a, b) =>
      nextDay(a, end)!.localeCompare(nextDay(b, end)!),
    );
  }

  return {
    near: capped(near, NEAR_CAP),
    maybe: shelf("maybe").slice(0, MAYBE_CAP),
    drive: shelf("drive"),
    further,
    later,
    counts,
    total: near.length,
    unplaced: base.unplaced,
    unplacedFinds: ask.unplaced ? shelf("unplaced").slice(0, MAYBE_CAP) : [],
    past: shelf("past").length,
    removed: base.removed,
    newYear,
  };
}

/**
 * **The next day after `after` a confirmed listing is on** — its own first
 * day if that is later, else the day after `after` while it is still
 * running. Undefined when it has ended by then.
 */
export function nextDay(f: Find, after: string): string | undefined {
  const { from, to } = f.when;
  if (!from) return undefined;
  if (from > after) return from;
  const next = addDays(after, 1);
  return to && to >= next ? next : undefined;
}

// ------------------------------------------------------------ availability

export interface Availability {
  readonly id: ThemeId;
  readonly label: string;
  readonly emoji: string;
  /** How many there are for this place, these days and this distance. */
  readonly count: number;
  /** For a category with none: the next day one is confirmed in the radius. */
  readonly next?: string;
  /** For a category with none on any day: the nearest beyond the radius, km. */
  readonly nearestKm?: number;
}

/**
 * **Every category, said with what it holds** — the ones with something
 * first, in the order Christmas lists them; New Year's Eve only in view.
 * Community lights lit on the days add to _Holiday lights_.
 */
export function availability(
  data: FinderData,
  extra: Partial<Record<ThemeId, number>> = {},
): { readonly open: Availability[]; readonly closed: Availability[] } {
  const list = THEMES.filter((t) => t.id !== "newyear" || data.newYear).map(
    (t): Availability => {
      const count = (data.counts[t.id] ?? 0) + (extra[t.id] ?? 0);
      if (count > 0) return { id: t.id, label: t.label, emoji: t.emoji, count };
      const later = data.later.find((f) => f.reading.themes.includes(t.id));
      const far = data.drive
        .concat(data.further)
        .filter((f) => f.reading.themes.includes(t.id) && f.km !== undefined)
        .sort((a, b) => a.km! - b.km!)[0];
      return {
        id: t.id,
        label: t.label,
        emoji: t.emoji,
        count,
        ...(later?.when.from ? { next: later.when.from } : {}),
        ...(far?.km !== undefined ? { nearestKm: Math.round(far.km) } : {}),
      };
    },
  );
  return {
    open: list.filter((a) => a.count > 0),
    closed: list.filter((a) => a.count === 0),
  };
}

// ---------------------------------------------------------------- the view

/**
 * **A standout** — what a host would lead with: named as a Christmas thing
 * of a big kind (a market, a festival, the lights, a show), dates
 * confirmed, an outing rather than a class or a sale, a stretch of days
 * rather than all season. Each is a fact Atlas holds; nothing is scored.
 */
export function standout(f: Find): boolean {
  return (
    f.reading.christmas &&
    IDENTITY.has(f.reading.evidence[0]?.field ?? "") &&
    f.reading.themes.some(
      (t) =>
        DRIVE_THEMES.has(t) && themeById(t).called.test(f.experience.title),
    ) &&
    !NOT_AN_OUTING.test(f.experience.title) &&
    f.when.confidence === "dated" &&
    f.when.phase !== "finished" &&
    !longRun(f)
  );
}

/** Soon: on now, or starting within this many days. */
export const SOON_DAYS = 14;

const startsBy = (f: Find, day: string) =>
  f.when.from !== undefined && f.when.from <= day;

/**
 * **The order a host would say them in** (owner brief M1128: "distance
 * matters, but nearest does not automatically mean best"): confirmed first;
 * then a standout; then soon (on now or within a fortnight); then with a
 * real picture; then nearer; then sooner. Facts in turn, never a score.
 */
export function hostOrder(today: string) {
  const soon = addDays(today, SOON_DAYS);
  return (a: Find, b: Find): number =>
    Number(a.when.confidence !== "dated") -
      Number(b.when.confidence !== "dated") ||
    Number(!standout(a)) - Number(!standout(b)) ||
    Number(!startsBy(a, soon)) - Number(!startsBy(b, soon)) ||
    Number(!hasPicture(a)) - Number(!hasPicture(b)) ||
    (a.km ?? Infinity) - (b.km ?? Infinity) ||
    (a.when.from ?? "9999").localeCompare(b.when.from ?? "9999") ||
    a.experience.title.localeCompare(b.experience.title);
}

export interface View {
  /** The one thing to lead with, pictured and a standout, or none. */
  readonly spotlight?: Find;
  /** Something on this weekend (an undated ask only). */
  readonly weekend: readonly Find[];
  /** The rest of what is confirmed, in a host's order. */
  readonly around: readonly Find[];
  /** Seasonal places and activities whose days aren't listed (undated ask). */
  readonly seasonal: readonly Find[];
  readonly maybe: readonly Find[];
  readonly drive: readonly Find[];
  /** How many confirmed things the view holds. */
  readonly count: number;
  /**
   * Nothing for these categories, days and distance — confirmed or
   * seasonal. The same things a chip counts, so a chip that says 2 never
   * opens on "nothing".
   */
  readonly empty: boolean;
}

const WEEKEND_CARDS = 4;

/** What a set of categories shows, from one `FinderData`. */
export function viewOf(
  data: FinderData,
  themes: readonly ThemeId[],
  ask: Pick<Ask, "from" | "to">,
  today: string,
): View {
  const keep = (f: Find) => inThemes(f, themes, data.newYear);
  const dated = Boolean(ask.from || ask.to);
  const near = data.near.filter(keep);
  const confirmed = near
    .filter((f) => dated || f.when.confidence === "dated")
    .sort(hostOrder(today));
  const seasonal = dated
    ? []
    : near.filter((f) => f.when.confidence !== "dated");
  const spotlight = confirmed.find((f) => standout(f) && hasPicture(f));
  let rest = confirmed.filter((f) => f !== spotlight);
  let weekend: Find[] = [];
  if (!dated) {
    const { from, to } = presetDates("weekend", today);
    weekend = rest
      .filter((f) => availableFor(f, from, to) === "yes")
      .slice(0, WEEKEND_CARDS);
    const shown = ids(weekend);
    rest = rest.filter((f) => !shown.has(f.experience.id));
  }
  return {
    ...(spotlight ? { spotlight } : {}),
    weekend,
    around: rest,
    seasonal,
    maybe: data.maybe.filter(keep),
    drive: data.drive.filter(keep),
    count: confirmed.length,
    empty: confirmed.length === 0 && seasonal.length === 0,
  };
}

// ---------------------------------------------------------------- the host

export interface Host {
  /** The next confirmed days for what was asked, in the radius. */
  readonly next: readonly { readonly day: string; readonly find: Find }[];
  /** Other things confirmed for the same days, in the radius. */
  readonly sameDay: readonly Find[];
  /** What was asked, confirmed for the same days, a little further out. */
  readonly further: readonly Find[];
}

const HOST_CARDS = 3;

/**
 * **A good host makes suggestions** (owner brief M1128): when nothing is
 * confirmed for what was asked, say what is — the next days it is on, what
 * else is on that day, what is a little further — and change nothing.
 */
export function hostFor(
  data: FinderData,
  themes: readonly ThemeId[],
  ask: Pick<Ask, "from" | "to">,
  today: string,
): Host {
  const keep = (f: Find) => inThemes(f, themes, data.newYear);
  const end = ask.to ?? ask.from;
  const next = end
    ? data.later
        .filter(keep)
        .flatMap((find) => {
          const day = nextDay(find, end);
          return day ? [{ day, find }] : [];
        })
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(0, HOST_CARDS)
    : [];
  const sameDay =
    themes.length > 0
      ? data.near
          .filter((f) => !keep(f) && inThemes(f, [], data.newYear))
          .filter(
            (f) => Boolean(ask.from || ask.to) || f.when.confidence === "dated",
          )
          .sort(hostOrder(today))
          .slice(0, HOST_CARDS)
      : [];
  const further = data.further.filter(keep).slice(0, HOST_CARDS);
  return { next, sameDay, further };
}

/** Why a listing is beyond the radius: within reach for a longer drive. */
export const reachOf = (km: number) => Math.max(DRIVE_REACH_KM, km * 2);
