import type { Experience } from "@/domain/experience/types";
import { statedDay } from "@/domain/experience/eventTime";
import { INTENTS, intentOf, type IntentKey } from "./intents";

/**
 * **What Discovery actually shows, as sections rather than as a stream.**
 *
 * Measured on 2026-10-10, the page rendered **2,248 rows in one list,
 * 251,104 pixels tall — 615 screens.** It opened with Pine Park, Kelowna's
 * Parks, Kalamoir Park, Otter Lake Park and Rutland: ten parks in a row,
 * alphabetised by nothing a person cares about, with no sense of what day it
 * was. That is not a product deciding what to show you. That is a table.
 *
 * This module decides. It composes the pool into a handful of sections that
 * each exist for a reason a person would recognise, caps what any one of them
 * shows, and keeps the rest reachable through search and *show more* rather
 * than through scrolling.
 *
 * ## Only facts Atlas states
 *
 * Membership is read from `kind`, `startTime`/`endTime`, `subtype` and
 * `location`. No prose is matched, nothing is scored, and nothing is written
 * back. Where Atlas is silent, the section simply does not claim the subject —
 * which is why the remainder section exists and why it is large.
 *
 * ## Claimed once
 *
 * A subject joins the first section that claims it. A card appearing in four
 * sections makes six sections feel like two.
 *
 * ## `now` is passed in
 *
 * Never read from the clock here, so a test is deterministic and the server and
 * the browser cannot disagree about what day it is halfway down the page.
 */

export interface DiscoverySection {
  readonly id: string;
  /** Passport's own words. Never a subject's, never a subtype printed back. */
  readonly title: string;
  /** One line of framing. Describes the section, never asserts about a subject. */
  readonly note: string;
  /**
   * What this section carries — a few pages' worth, not everything it claimed.
   *
   * The page shows `size` of these and reveals the rest on request. Carrying
   * three pages rather than all 447 restaurants is the compromise that makes
   * *show more* instant without serialising the corpus into the HTML, which is
   * what the previous version did: 7.7 MB, 2,248 rows, on every page view.
   */
  readonly items: readonly Experience[];
  /** How many are shown before asking for more. */
  readonly size: number;
  /** How many the section claimed in total, so the count on screen is true. */
  readonly total: number;
  /**
   * `when` sections are dated and perishable; `intent` sections are timeless.
   * The distinction is kept so presentation can treat them differently without
   * re-deriving it, and so nothing dated is ever quietly rendered as permanent.
   */
  readonly shape: "when" | "intent" | "rest";
}

/** How many a section shows before asking. Enough to browse, not enough to scroll past. */
export const SECTION_SIZE = 8;

/**
 * How many pages a section carries. Past this the search box is the honest
 * answer — a feed that keeps growing until the browser gives up is the thing
 * this composition replaced.
 */
export const SECTION_PAGES = 3;

/** How far ahead "coming up" looks. Two weeks is a plan; two months is a calendar. */
export const COMING_UP_DAYS = 14;

/**
 * The calendar day a dated subject runs from and to, as `YYYY-MM-DD`.
 *
 * `statedDay` rather than a local conversion, for the reason it documents: a
 * source that stated only a date is stored at UTC midnight, and reading that
 * through a Pacific timezone moves it to the previous evening.
 */
function interval(
  experience: Experience,
): { readonly from: string; readonly to: string } | undefined {
  if (!experience.startTime) return undefined;
  const from = statedDay(
    new Date(experience.startTime),
    experience.timePrecision,
  );
  if (!from) return undefined;
  const to = experience.endTime
    ? (statedDay(new Date(experience.endTime), experience.timePrecision) ??
      from)
    : from;
  return { from, to };
}

/** Today where the subjects are, as `YYYY-MM-DD`. */
export function dayOf(now: Date): string {
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function plusDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const at = new Date(Date.UTC(y!, m! - 1, d! + days));
  return at.toISOString().slice(0, 10);
}

/**
 * How long a dated thing can run and still be *news today*.
 *
 * Measured on the live corpus: "Happening today" filled up with a Halloween
 * trail stated as `Oct 31 2023 – Oct 31 2026` and a museum exhibition running
 * `Mar 2026 – Jan 2027`. Both genuinely cover today. Neither is a reason to
 * look at a page today, and putting them at the top of one buries the three
 * things that are. A month is the line: a festival week is today's news, a
 * ten-month exhibition is somewhere you can go whenever.
 */
export const TODAY_RUN_MAX_DAYS = 31;

function spanDays(from: string, to: string): number {
  const at = (day: string) => Date.parse(`${day}T00:00:00Z`);
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/** Dated, covering today, and short enough that today is the point. */
export function onToday(
  experiences: readonly Experience[],
  today: string,
): Experience[] {
  return experiences
    .filter((experience) => {
      const span = interval(experience);
      return Boolean(
        span &&
        span.from <= today &&
        today <= span.to &&
        spanDays(span.from, span.to) <= TODAY_RUN_MAX_DAYS,
      );
    })
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

/**
 * Dated, covering today, and running far longer than a month.
 *
 * An exhibition, a season, a months-long installation. Real, open, and worth
 * showing — just not as *today's* news, and not as something that will be gone
 * by tomorrow. Ordered by what finishes soonest, because the only urgency a
 * long run has is its ending.
 */
export function onNow(
  experiences: readonly Experience[],
  today: string,
): Experience[] {
  return experiences
    .filter((experience) => {
      const span = interval(experience);
      return Boolean(
        span &&
        span.from <= today &&
        today <= span.to &&
        spanDays(span.from, span.to) > TODAY_RUN_MAX_DAYS,
      );
    })
    .sort((a, b) => (a.endTime ?? "").localeCompare(b.endTime ?? ""));
}

/** Dated, not started yet, and starting inside the window. Soonest first. */
export function comingUp(
  experiences: readonly Experience[],
  today: string,
  days: number = COMING_UP_DAYS,
): Experience[] {
  const until = plusDays(today, days);
  return experiences
    .filter((experience) => {
      const span = interval(experience);
      return Boolean(span && span.from > today && span.from <= until);
    })
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

/**
 * Anything dated whose last day is already behind us.
 *
 * Excluded from every section. A finished event is not a possibility, and
 * leaving it in the feed is the single most obvious way a discovery surface
 * tells somebody it is not paying attention. 234 of the 367 dated subjects in
 * the live corpus are already over.
 */
export function isOver(experience: Experience, today: string): boolean {
  const span = interval(experience);
  return Boolean(span && span.to < today);
}

/**
 * **A picture sells the possibility, so a section leads with one.**
 *
 * Stable and total: media first, then the order the pool arrived in. Not a
 * quality score — a subject with no photograph is never excluded, only shown
 * after the ones that can show you what they are. Nineteen per cent of the
 * corpus has a vouched-for lead image, so a section of eight that ignored this
 * would usually be eight grey boxes.
 */
export function pictureFirst(experiences: readonly Experience[]): Experience[] {
  return experiences
    .map((experience, index) => ({ experience, index }))
    .sort(
      (a, b) =>
        Number(Boolean(b.experience.heroMedia)) -
          Number(Boolean(a.experience.heroMedia)) || a.index - b.index,
    )
    .map((entry) => entry.experience);
}

const section = (
  id: string,
  title: string,
  note: string,
  shape: DiscoverySection["shape"],
  claimed: readonly Experience[],
  size: number,
): DiscoverySection | undefined =>
  claimed.length === 0
    ? undefined
    : {
        id,
        title,
        note,
        items: claimed.slice(0, size * SECTION_PAGES),
        size,
        total: claimed.length,
        shape,
      };

export interface ComposeOptions {
  /** Injected. See the note at the top of this file. */
  readonly now: Date;
  /** How many each section shows before offering more. */
  readonly size?: number;
  /** Where Passport is looking, for the remainder section's wording only. */
  readonly where?: string;
}

/**
 * Compose the default Discovery view.
 *
 * Order is deliberate and is the product's answer to *"what could I actually
 * do?"*:
 *
 * 1. **what is on today** — perishable, and the only thing that is true for a
 *    few hours rather than forever;
 * 2. **what is coming up** — enough warning to make a plan around;
 * 3. **the intents** — timeless possibilities grouped the way somebody would
 *    ask for them (`intents.ts`);
 * 4. **the remainder** — everything real that no intent claims, so nothing
 *    Atlas knows becomes unreachable by browsing.
 *
 * A section that would be empty is not returned. Several strong sections beat
 * fifteen weak ones, and an empty heading is a promise the page cannot keep.
 */
export function composeDiscovery(
  experiences: readonly Experience[],
  { now, size = SECTION_SIZE, where }: ComposeOptions,
): readonly DiscoverySection[] {
  const today = dayOf(now);
  const live = experiences.filter((experience) => !isOver(experience, today));

  const claimed = new Set<string>();
  const take = (chosen: readonly Experience[]): Experience[] => {
    const fresh = chosen.filter((experience) => !claimed.has(experience.id));
    for (const experience of fresh) claimed.add(experience.id);
    return fresh;
  };

  const sections: DiscoverySection[] = [];
  const add = (made: DiscoverySection | undefined) => {
    if (made) sections.push(made);
  };

  add(
    section(
      "today",
      "Happening today",
      "Dated, running now, and over by tomorrow for some of it.",
      "when",
      take(onToday(live, today)),
      size,
    ),
  );

  add(
    section(
      "on-now",
      "On for a while",
      "Running now and for longer than a month — go whenever suits.",
      "when",
      pictureFirst(take(onNow(live, today))),
      size,
    ),
  );

  add(
    section(
      "coming-up",
      "Coming up",
      `Starting within the next ${COMING_UP_DAYS} days — soonest first.`,
      "when",
      take(comingUp(live, today)),
      size,
    ),
  );

  for (const intent of INTENTS) {
    add(
      section(
        intent.key,
        intent.section,
        intent.note,
        "intent",
        pictureFirst(take(live.filter((e) => intentOf(e) === intent.key))),
        size,
      ),
    );
  }

  add(
    section(
      "rest",
      where ? `More in ${where}` : "More to explore",
      "Everything else Atlas holds here that no heading above claimed.",
      "rest",
      pictureFirst(take(live)),
      size,
    ),
  );

  return sections;
}

/** Re-exported so presentation imports one module rather than two. */
export { INTENTS, intentOf, type IntentKey };

/**
 * **Where this is, in the words Atlas actually stated.**
 *
 * Discovery's cards rendered `experience.context`, which the live feed holds
 * for **5 of 2,681** subjects — so in practice no card ever said where it was.
 * `venue` (Atlas's `location`) is held for 137, with a named locality on 69,
 * and was not rendered at all. A feed that mixes Vernon, Kelowna, Peachland and
 * Lake Country without saying which is which is the geography complaint in the
 * brief, and most of it was this.
 *
 * **Nothing is derived.** No distance — only 11% of the corpus has coordinates,
 * so a kilometre figure would be invented for nine subjects in ten. No region
 * inference from a name. Where Atlas is silent this returns `undefined` and the
 * card says nothing, which is the honest answer and reads better than a guess.
 */
export function whereLine(experience: Experience): string | undefined {
  const locality = experience.venue?.locality?.trim();
  const venue = experience.venue?.name?.trim();
  const context = experience.context?.name?.trim();

  // The venue and the locality are different facts and both are worth saying:
  // "The Balsam School · Vernon" tells somebody more than either half.
  if (venue && locality && venue !== locality) return `${venue} · ${locality}`;
  return locality || venue || context || undefined;
}
