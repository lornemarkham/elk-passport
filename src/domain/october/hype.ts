import type { Experience } from "@/domain/experience/types";
import type { Environment } from "@/domain/environment/types";
import { moonIllumination } from "@/domain/environment/daylight";
import { editorialHypeFor } from "@/lib/passport/curation/octoberHype";
import { conditionsFor } from "./conditions";
import { daysOn } from "./calendar";
import type { SubjectKind } from "./subjectKind";

/**
 * **Hype: October noticing something before you asked.**
 *
 * The three October signals are deliberately about different things, and the
 * boundaries between them are the whole design:
 *
 * ```
 * Anticipate   something YOU chose is getting close
 * Don't Miss   a window is CLOSING
 * Hype         a window is OPENING or PEAKING, and October has a view about it
 * ```
 *
 * Hype is the only one that speaks first. That makes it the one most able to
 * become noise, so it is the one with the strictest evidence rules.
 *
 * ## What the corpus taught, before any rule was written
 *
 * The most-photographed subject in the whole corpus is **Japan Tours 2027**,
 * with 75 media on a year-long 2027 tour. *Free Family Photo at The Apple
 * Orchard* has 43, for one day in September. The Draconids have **seven**.
 *
 * Media count tracks how many photographs an organisation has uploaded, not
 * whether anything is worth caring about — so it is not an input here, and
 * neither is anything else that could be mistaken for popularity. There is no
 * attendance, no trending, no "people are going", because Passport holds none
 * of that and inventing it is the one thing this must never do.
 *
 * ## What is an input
 *
 * Only this, and all of it is checkable:
 *
 * ```
 * the shape of its window     short and rare, or substantial and just opening
 * where today sits in it      approaching, or underway and not yet closing
 * what kind of thing it is    one October has a reason to care about
 * what the sky is doing       for a subject the sky actually decides
 * ```
 *
 * ## Strength is creative permission, not prominence
 *
 * `level` says how much October is allowed to express itself — **not**
 * how big the card is, how high it ranks, or how much orange it gets. A
 * `takeover` is October being allowed to let the sky onto the page. A
 * `mention` is one line. Neither is a score and neither is ever shown as one.
 */

/**
 * **The Hypometer.** Five intensities, and each one is a grant of creative
 * permission rather than a claim about the world.
 *
 * ```
 * 0  NORMAL    nothing
 * 1  NUDGE     it feels chosen; you could not say why
 * 2  HYPED     clearly more alive than the cards around it
 * 3  HOT       October is excited — richer motion, light, its own photograph
 * 4  TAKEOVER  rare; the subject may transform part of the product
 * ```
 *
 * **Never shown as a number.** A user sees a card that breathes or a sky that
 * arrives; they never see "level 3", a percentage, or the word hype. The
 * level decides what October is *allowed to do*, not what it asserts.
 */
export type HypeLevel = 0 | 1 | 2 | 3 | 4;

export interface Hype {
  readonly subject: Experience;
  /** Why October is excited, in October's voice. Grounded, never hyperbole. */
  readonly because: string;
  /** Why *now* — the temporal fact that makes today the day to say it. */
  readonly now: string;
  readonly level: HypeLevel;
  /** The kind, so a surface can choose an expression that suits the subject. */
  readonly kind: SubjectKind;
  /** The day the expression should talk about. */
  readonly day: string;
}

/** A window this short is rare enough to be an event in itself. */
const RARE_WINDOW_DAYS = 7;
/** A run this long opening is a season starting, not an event happening. */
const SEASON_DAYS = 7;
/** How far ahead October is allowed to get excited. */
const LOOK_AHEAD_DAYS = 2;

const DAY_MS = 86_400_000;
const between = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS,
  );

/** October cares about these. An indoor concert is not a seasonal signal. */
const OCTOBER_KINDS: readonly SubjectKind[] = [
  "astronomy",
  "outdoor-night",
  "outdoor-day",
];

export interface HypeContext {
  readonly today: string;
  readonly now: Date;
  readonly kind: SubjectKind;
  /** The forecast at this subject's own place, where one reaches it. */
  readonly environment?: Environment;
  /** Entity ids already in this person's October. Those are Anticipate's. */
  readonly saved: ReadonlySet<string>;
}

/**
 * Whether October should say something about this, unprompted.
 *
 * Returns nothing far more often than it returns something. Most of the
 * corpus can never qualify: an indoor subject cannot, a subject with no
 * stated days cannot, anything outside October cannot, and anything the
 * person has already saved cannot — that has stopped being a recommendation
 * and become a plan.
 */
export function hypeFor(
  experience: Experience,
  context: HypeContext,
): Hype | undefined {
  const { today, now, kind, environment, saved } = context;

  // Already chosen. October does not pitch somebody a thing they picked.
  if (saved.has(experience.id)) return undefined;

  const days = daysOn(experience);
  if (days.length === 0) return undefined;
  const first = days[0]!;
  const last = days[days.length - 1]!;
  if (last < today) return undefined;
  // It has to be an October thing. Japan Tours 2027 is not, whatever its
  // photo count says.
  //
  // **Any day, not the endpoints.** Checking only `first` and `last` rejected
  // Field of Screams, which runs 25 September to 1 November and therefore has
  // neither end inside the month — the valley's main haunt, excluded from
  // October for spanning it.
  if (!days.some((d) => d.startsWith("2026-10"))) return undefined;

  const remaining = days.filter((day) => day >= today);
  const startsIn = between(today, first);
  const day = remaining[0] ?? first;

  // **Editorial is its own route in.** An algorithm cannot work out what is
  // worth caring about, so an editor may simply say so — and then a subject
  // that context would never surface (a haunt in the middle of a 38-night
  // run) can still be treated. Context still has a veto: a rained-out sky
  // pulls the Draconids to nothing however high an editor set them.
  const editorial = editorialHypeFor(experience.id);

  if (!editorial) {
    if (!OCTOBER_KINDS.includes(kind)) return undefined;
    if (startsIn > LOOK_AHEAD_DAYS) return undefined;
    // Closing belongs to Don't Miss. Two signals shouting about one subject
    // on one screen is how a product stops being believed.
    if (remaining.length <= 2 && between(today, last) <= 3) return undefined;
    const rare = days.length <= RARE_WINDOW_DAYS;
    const season = days.length >= SEASON_DAYS;
    const opening = startsIn >= 0 && startsIn <= LOOK_AHEAD_DAYS;
    if (!rare && !(season && opening)) return undefined;
  } else {
    // Editorially chosen things still have to be on, and still hand over to
    // Don't Miss when they are closing.
    if (startsIn > LOOK_AHEAD_DAYS) return undefined;
    if (remaining.length <= 2 && between(today, last) <= 3) return undefined;
  }

  const ceiling: HypeLevel = editorial?.level ?? 4;

  // ---------------------------------------------------------- the sky case
  //
  // For a subject the sky decides, the forecast is not decoration — it is
  // whether there is anything to be excited about at all. A clouded-out
  // meteor shower is not hype, it is a disappointment with a countdown.
  if (kind === "astronomy") {
    const sky = conditionsFor(kind, day, environment, now);
    if (sky?.weight === "warning") return undefined;
    if (!sky) {
      return {
        subject: experience,
        because: "A meteor shower, and the moon is nearly out of the way.",
        now: whenLine(startsIn, remaining.length),
        level: atMost(2, ceiling),
        kind,
        day,
      };
    }
    const lit = moonIllumination(new Date(`${day}T22:00:00-07:00`));
    const dark = lit < 0.25;
    return {
      subject: experience,
      because: dark
        ? "Clear sky forecast, and almost no moon."
        : "Clear sky forecast.",
      now: whenLine(startsIn, remaining.length),
      // Everything lines up: the one case October may let the sky onto the
      // page for.
      level: atMost(sky.weight === "good" && dark ? 4 : 2, ceiling),
      kind,
      day,
    };
  }

  // ------------------------------------------------------- everything else
  const season = days.length >= SEASON_DAYS;
  return {
    subject: experience,
    because: editorial
      ? "October reckons this one is worth your evening."
      : season
        ? "An October season opening."
        : "A short window, and it is this week.",
    now: whenLine(startsIn, remaining.length),
    level: atMost(editorial ? ceiling : season ? 2 : 1, ceiling),
    kind,
    day,
  };
}

/** What context earned, never above what an editor allowed. */
function atMost(earned: HypeLevel, ceiling: HypeLevel): HypeLevel {
  return Math.min(earned, ceiling) as HypeLevel;
}

function whenLine(startsIn: number, remaining: number): string {
  if (startsIn === 1) return "It starts tomorrow.";
  if (startsIn === 2) return "It starts in two days.";
  if (startsIn === 0) return "It starts tonight.";
  if (remaining === 1) return "Tonight.";
  return `${remaining} nights of it, starting tonight.`;
}

/**
 * **At most one.** October gets to be excited about one thing at a time, or
 * it is not excitement, it is a list.
 */
export function strongestHype(candidates: readonly Hype[]): Hype | undefined {
  return [...candidates].sort((a, b) => b.level - a.level)[0];
}

const NOBODY_HAS_CHOSEN_ANYTHING: ReadonlySet<string> = new Set();

/**
 * **What a surface should tell `hypeFor` about what has been saved.**
 *
 * Hype refuses anything already in somebody's October — that is the
 * Hype→Anticipate handoff and it is not negotiable. But a dev scenario exists
 * to show what a *first encounter* looks like, and a row created last week
 * while testing something else silently defeats it: the takeover vanishes,
 * the curated feature returns in its place, and the page looks exactly like a
 * broken build. That happened, and the refusal was indistinguishable from a
 * bug because a correct refusal renders nothing at all.
 *
 * So under a scenario the simulated context includes *not having chosen it*,
 * in the same way it includes a simulated sky. The rule is untouched, the
 * real row is neither read nor written, and outside a scenario this is the
 * person's genuine saved set.
 *
 * It lives here, exported and tested, rather than as a ternary inside a
 * server component — because the ternary inside the server component is the
 * part nobody can run.
 */
export function savedContextFor(
  simulated: boolean,
  kept: ReadonlySet<string>,
): ReadonlySet<string> {
  return simulated ? NOBODY_HAS_CHOSEN_ANYTHING : kept;
}
