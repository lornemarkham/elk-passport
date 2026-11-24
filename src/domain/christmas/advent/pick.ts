import { subjectHref } from "@/domain/experience/destination";
import { whereLine } from "@/domain/discovery/compose";
import { tidyWhere } from "../tidy";
import {
  answer,
  directionsOf,
  readAsk,
  statedPlace,
  type Find,
} from "../discover";
import { themeById, type ThemeId } from "../themes";
import { ADVENT_IDEAS, ideaOnDay, type AdventIdea } from "./ideas";
import {
  dayName,
  type AdventDay,
  type AdventPrefs,
  type Interest,
} from "./model";

/**
 * **What is behind a door** — a short list of options for one day, best
 * first. The door shows the first; _Swap_ moves along the list.
 *
 * The rules, every one of them a fact or a family's own choice:
 *
 * - **A real event only on a day it is happening.** An Atlas event is an
 *   option for a day only where Christmas Discovery would offer it as
 *   _confirmed_ for that day, inside this family's distance from their
 *   place (`answer`, the same rules, the same radius rule, the same
 *   "unplaced is never near"). On today's door, what has already finished
 *   is gone.
 * - **The family's own limits are limits.** Free means stated free; a
 *   stated price above the inexpensive line is out; indoors or outdoors
 *   is Atlas's exposure reading where it has one; ages are Atlas's age
 *   verdict (`excludesAge`) and the ideas' own.
 * - **What they love comes first** — interests order the list, they don't
 *   empty it.
 * - **Variety**: something chosen for an earlier door goes to the back.
 * - **Never empty**: Passport's ideas (`ideas.ts`), each said to be one,
 *   fill whatever Atlas can't.
 */

export interface AdventOption {
  /** `e:<atlas id>` or `i:<idea id>` — what progress remembers. */
  readonly key: string;
  readonly kind: "event" | "idea";
  readonly title: string;
  readonly emoji: string;
  readonly line?: string;
  /** Why it's behind this door, in a sentence. */
  readonly because: string;
  // ---- a real event
  /** The listing's own dates, as Christmas Discovery prints them. */
  readonly when?: string;
  readonly where?: string;
  readonly km?: number;
  /** The organiser's own price words. */
  readonly price?: string;
  readonly free?: boolean;
  readonly directions?: string;
  /** The Passport page with the listing's details and its source. */
  readonly details?: string;
  // ---- an idea
  readonly careful?: string;
  /** Planner sentence for an idea that goes out of the house. */
  readonly plan?: string;
  readonly lights?: true;
}

export interface DayPlan extends AdventDay {
  readonly name?: string;
  readonly options: readonly AdventOption[];
  /** How many real events near here are confirmed for the day. */
  readonly events: number;
}

/** Above this stated price (in dollars, the lowest one stated), not "inexpensive". */
export const INEXPENSIVE_MAX = 25;
const MAX_OPTIONS = 6;
const MAX_EVENTS = 4;

const THEME_INTEREST: Partial<Record<ThemeId, Interest>> = {
  lights: "lights",
  markets: "markets",
  santa: "santa",
  shows: "shows",
  food: "food",
  winter: "outdoors",
};

/** The lowest dollar amount the organiser states, if any. */
export function lowestPrice(price: string | undefined): number | undefined {
  const amounts = [...(price ?? "").matchAll(/\$\s?(\d+(?:\.\d{1,2})?)/g)].map(
    (m) => Number(m[1]),
  );
  return amounts.length ? Math.min(...amounts) : undefined;
}

function fitsBudget(f: Find, prefs: AdventPrefs): boolean {
  if (prefs.budget === "any" || f.free) return true;
  if (prefs.budget === "free") return false;
  const lowest = lowestPrice(f.price);
  return lowest === undefined || lowest <= INEXPENSIVE_MAX;
}

function fitsSetting(f: Find, prefs: AdventPrefs): boolean {
  if (prefs.setting === "either") return true;
  const exposure = f.experience.environment?.exposure?.value;
  if (exposure !== "indoor" && exposure !== "outdoor") return true;
  return exposure === prefs.setting;
}

const hasKids = (prefs: AdventPrefs) =>
  prefs.ages.length > 0 || prefs.who === "family";
const youngest = (prefs: AdventPrefs) =>
  prefs.ages.length ? Math.min(...prefs.ages) : undefined;

function ideaFits(idea: AdventIdea, prefs: AdventPrefs, date: string) {
  if (!ideaOnDay(idea, date)) return false;
  if (prefs.who && !idea.who.includes(prefs.who)) return false;
  if (idea.ages === "kids" && !hasKids(prefs)) return false;
  if (idea.ages === "grown" && (youngest(prefs) ?? 18) < 13) return false;
  if (prefs.setting !== "either" && idea.setting !== prefs.setting)
    return false;
  if (prefs.budget === "free" && idea.cost !== "free") return false;
  return true;
}

/** A small, stable number from text — the same family gets the same doors. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const interestsOf = (f: Find): Interest[] =>
  f.reading.themes.flatMap((t) => THEME_INTEREST[t] ?? []);

/** "3975 June Springs Rd., Kelowna · Kelowna" says Kelowna once. */
export function oncePerPart(line: string): string {
  const parts = line.split(" · ").filter(Boolean);
  return parts
    .filter(
      (part, i) =>
        !parts.some(
          (other, j) =>
            j !== i &&
            other.toLowerCase().includes(part.toLowerCase()) &&
            (other.length > part.length || j < i),
        ),
    )
    .join(" · ");
}

function eventOption(
  f: Find,
  date: string,
  at: string,
  km: number,
): AdventOption {
  const e = f.experience;
  const theme = f.reading.themes[0];
  const where = oncePerPart(tidyWhere(whereLine(e) ?? "")) || statedPlace(e);
  const directions = directionsOf(e);
  const single = f.when.from === date && f.when.to === date;
  return {
    key: `e:${e.id}`,
    kind: "event",
    title: e.title,
    emoji: theme ? themeById(theme).emoji : "🎄",
    ...(e.description || e.shortDescription
      ? { line: (e.description || e.shortDescription).slice(0, 220) }
      : {}),
    because: single
      ? `Happening on this day, within ${km} km of ${at}.`
      : `On this day, within ${km} km of ${at} — dates confirmed by the listing.`,
    ...(f.when.line ? { when: f.when.line } : {}),
    ...(where ? { where } : {}),
    ...(f.km !== undefined ? { km: Math.round(f.km * 10) / 10 } : {}),
    ...(f.price ? { price: f.price } : {}),
    free: f.free,
    ...(directions ? { directions } : {}),
    details: subjectHref(e.kind, e.id),
  };
}

function ideaOption(idea: AdventIdea, liked: boolean): AdventOption {
  return {
    key: `i:${idea.id}`,
    kind: "idea",
    title: idea.title,
    emoji: idea.emoji,
    line: idea.line,
    because: liked
      ? "An idea, not a listing — picked for what you love."
      : "An idea, not a listing — it works anywhere.",
    ...(idea.careful ? { careful: idea.careful } : {}),
    ...(idea.plan ? { plan: idea.plan } : {}),
    ...(idea.lights ? { lights: true as const } : {}),
  };
}

/**
 * **Every open day's options**, door 1 onwards, so variety can be kept
 * across them. `finds` are Christmas finds measured from the family's
 * place (with Atlas's age verdict for their youngest, where they gave one);
 * `townName` is how the place is said.
 */
export function planDays(
  days: readonly AdventDay[],
  finds: readonly Find[],
  prefs: AdventPrefs,
  context: {
    readonly at: string;
    readonly townName: string;
    readonly today: string;
    readonly now?: Date;
  },
): DayPlan[] {
  const used = new Map<string, number>();
  const like = new Set(prefs.interests);
  const noKids = !hasKids(prefs);
  return days.map((day) => {
    const ask = {
      ...readAsk({}),
      at: context.at,
      km: prefs.km,
      from: day.date,
      to: day.date,
      ages: prefs.ages,
      budget: prefs.budget === "free" ? ("free" as const) : ("any" as const),
    };
    const near =
      answer(finds, ask, {
        today: context.today,
        ...(day.date === context.today && context.now
          ? { now: context.now }
          : {}),
      }).shelves.find((s) => s.id === "near")?.finds ?? [];
    const events = near.filter(
      (f) =>
        f.experience.kind === "Event" &&
        fitsBudget(f, prefs) &&
        fitsSetting(f, prefs),
    );
    const eventScore = (f: Find) => {
      const span =
        f.when.from && f.when.to
          ? Math.round(
              (Date.parse(f.when.to) - Date.parse(f.when.from)) / 86_400_000,
            )
          : 30;
      const loved = interestsOf(f).filter((i) => like.has(i)).length;
      return (
        (span === 0 ? -3 : span <= 3 ? -1 : span <= 14 ? 0 : 1.5) -
        2 * loved +
        5 * (used.get(`e:${f.experience.id}`) ?? 0) +
        (noKids && f.reading.themes.includes("santa") ? 3 : 0) +
        (f.reading.christmas ? 0 : 0.5) +
        hash(`${prefs.seed}:${day.date}:${f.experience.id}`)
      );
    };
    // One order for both: a real event is worth more than an idea (it is
    // the reason to open the door), a day's own idea (Christmas Eve's box,
    // a New Year's countdown) is worth more again, and whatever led an
    // earlier door goes to the back — a three-week market leads once, not
    // every day.
    const scored: { o: AdventOption; s: number }[] = [
      ...events.map((f) => ({
        o: eventOption(f, day.date, context.townName, prefs.km),
        s: eventScore(f) - 2.5,
      })),
      ...ADVENT_IDEAS.filter((i) => ideaFits(i, prefs, day.date)).map(
        (idea) => {
          const loved = idea.interests.filter((i) => like.has(i)).length;
          return {
            o: ideaOption(idea, loved > 0),
            s:
              (idea.on ? -4 : 0) -
              2 * loved +
              6 * (used.get(`i:${idea.id}`) ?? 0) +
              hash(`${prefs.seed}:${day.date}:${idea.id}`) * 2,
          };
        },
      ),
    ].sort((a, b) => a.s - b.s);
    // A few of each, so Swap always offers the other kind too.
    const options: AdventOption[] = [];
    let real = 0;
    let ideas = 0;
    for (const { o } of scored) {
      if (options.length >= MAX_OPTIONS) break;
      if (
        o.kind === "event"
          ? real >= MAX_EVENTS
          : ideas >= MAX_OPTIONS - Math.min(2, events.length)
      )
        continue;
      options.push(o);
      if (o.kind === "event") real++;
      else ideas++;
    }
    const lead = options[0];
    if (lead) used.set(lead.key, (used.get(lead.key) ?? 0) + 1);
    const name = dayName(day);
    return {
      ...day,
      ...(name ? { name } : {}),
      options,
      events: events.length,
    };
  });
}

/** What progress shows for a day: the option at the family's swap count. */
export const optionAt = (
  plan: Pick<DayPlan, "options">,
  swaps: number,
): AdventOption | undefined =>
  plan.options.length ? plan.options[swaps % plan.options.length] : undefined;
