import type { Experience } from "@/domain/experience/types";

/**
 * **A situation, not a profile.**
 *
 * The scenario this exists for, which Discovery failed in production:
 *
 * > *I've got my five-year-old niece for about seven hours. It's pissing
 * > rain. What the hell should we do?*
 *
 * Nothing in that sentence is a search query. The person does not know the
 * name of an attraction, a subtype or a category — they know their afternoon.
 * Discovery began one abstraction too low: it asked *what are you looking
 * for* when the honest input is *this is my day*.
 *
 * ## Why this is situational and deliberately forgotten
 *
 * "My niece" is true this afternoon and false tomorrow. It is **not** a
 * family profile, not a permanent demographic, and nothing here is persisted.
 * Collapsing one afternoon into a standing fact about a person is how a
 * product starts recommending playgrounds to somebody on a work trip for the
 * rest of their life.
 *
 * ## The three kinds of statement, kept apart
 *
 * The doctrine's rule (§5) applies exactly here:
 *
 * ```
 * SAID       the person told Passport — who is with them, how long they have
 * EVIDENCE   Atlas states it — an affordance, a feature, a forecast
 * UNKNOWN    nobody knows, and Passport says so rather than filling it in
 * ```
 *
 * Nothing in this module turns a subtype into a suitability. "It is a park,
 * therefore a five-year-old will like it" is the fabricated affordance the
 * doctrine forbids, and it is wrong the first time somebody takes a toddler
 * to a fenced conservation area.
 */

/** Who the day is with. The one thing Passport cannot know and must ask. */
export type Company = "alone" | "child" | "group";

/** Roughly how much day there is. Coarse on purpose — this is not a planner. */
export type Window = "an-hour" | "half-day" | "all-day";

export interface Situation {
  readonly company?: Company;
  readonly window?: Window;
}

export const EMPTY_SITUATION: Situation = {};

export const hasSituation = (situation: Situation): boolean =>
  Boolean(situation.company || situation.window);

/**
 * **Evidence that a child could actually do something here.**
 *
 * Read only from `candidate-knowledge/1` — the affordances Atlas asserts and
 * the features a publisher listed. Never from a subtype, never from a name,
 * never from prose.
 *
 * The set below is small and closed, and every entry is a string that appears
 * in the live corpus. It is a list of *things a five-year-old can do*, not a
 * taxonomy of childhood: a playground, a beach, a picnic, a short walk. It
 * deliberately excludes mountain biking and snowshoeing, which Atlas also
 * holds and which are not a Saturday with a toddler.
 *
 * **It returns the evidence, not a score.** A card says *"Playground ·
 * Swimming"* because Atlas said so, and a person can judge that for
 * themselves — which is worth more than a number they would have to trust.
 */
const CHILD_DOABLE: ReadonlySet<string> = new Set([
  "playground",
  "beach",
  "swimming",
  "picnic areas",
  "picnic shelter",
  "walking",
  "wildlife viewing",
  "basketball",
  "tennis courts",
  "softball",
  "soccer full",
  "skating",
  "sledding",
  "petting zoo",
]);

const named = (value: string): string => value.trim();

export function childEvidence(experience: Experience): readonly string[] {
  const knowledge = experience.knowledge;
  if (!knowledge) return [];

  const found = new Map<string, string>();
  for (const affordance of knowledge.affordances ?? []) {
    const name = named(affordance.name ?? "");
    if (name && CHILD_DOABLE.has(name.toLowerCase()))
      found.set(name.toLowerCase(), name);
  }
  for (const feature of knowledge.features ?? []) {
    const name = named(feature);
    if (name && CHILD_DOABLE.has(name.toLowerCase()))
      found.set(name.toLowerCase(), name);
  }
  return [...found.values()];
}

/**
 * **Everything Atlas says you can do here**, whoever you are.
 *
 * The honest answer to *what would we actually do there*, which no card could
 * answer before `candidate-knowledge/1`. Held for 224 candidates out of 2,683
 * — so most cards still say nothing, and that is the gap rather than a bug.
 */
export function doableEvidence(experience: Experience): readonly string[] {
  const knowledge = experience.knowledge;
  if (!knowledge) return [];
  const found = new Map<string, string>();
  for (const affordance of knowledge.affordances ?? []) {
    const name = named(affordance.name ?? "");
    if (name) found.set(name.toLowerCase(), name);
  }
  for (const feature of knowledge.features ?? []) {
    const name = named(feature);
    if (name) found.set(name.toLowerCase(), name);
  }
  return [...found.values()];
}

/**
 * **Can this be done in the rain?** Almost always: nobody knows.
 *
 * Atlas states no indoor/outdoor classification. What it *does* state is
 * affordances, and the ones it holds are overwhelmingly outdoor — hiking 53,
 * swimming 26, fishing 22, cycling 12, beaches, playgrounds. Measured on the
 * live corpus, **every one of the 76 candidates with child-plausible evidence
 * is outdoor**, and exactly 10 mention the word "indoor" anywhere, mostly as a
 * resort's pool.
 *
 * So this returns `outdoor` only where the evidence is unambiguously an
 * outdoor activity, and `unknown` for everything else — including every
 * museum, cinema and swimming pool in the corpus, because Atlas has not said.
 * **It never returns `indoor`.** There is no evidence that would justify it,
 * and a product that guessed would send somebody and their niece to a locked
 * door in a downpour.
 */
export type Shelter = "outdoor" | "unknown";

const PLAINLY_OUTDOOR: ReadonlySet<string> = new Set([
  "playground",
  "beach",
  "swimming",
  "picnic areas",
  "picnic shelter",
  "hiking",
  "walking",
  "cycling",
  "biking",
  "mountain biking",
  "snowshoeing",
  "fishing",
  "canoeing",
  "kayaking",
  "boat launch",
  "campfires",
  "dog park (off leash)",
  "wildlife viewing",
  "birdwatching",
]);

export function shelterOf(experience: Experience): Shelter {
  const evidence = doableEvidence(experience);
  return evidence.some((name) => PLAINLY_OUTDOOR.has(name.toLowerCase()))
    ? "outdoor"
    : "unknown";
}

/**
 * **What Passport can offer for this situation, and what it cannot.**
 *
 * Returns the subjects with real evidence behind them plus an honest account
 * of why the answer is thin. The second half matters more than the first: the
 * scenario that drove this mission is one Atlas cannot currently answer, and a
 * shortlist presented without that caveat would be the product lying
 * confidently.
 */
export interface SituationAnswer {
  /** Subjects with evidence that they suit the stated company. */
  readonly matches: readonly Experience[];
  /** How many of those the weather argues against, where it is known. */
  readonly weatherAgainst: number;
  /** Whether Passport can say anything at all for this situation. */
  readonly grounded: boolean;
}

export function answerFor(
  experiences: readonly Experience[],
  situation: Situation,
  options: { readonly wet?: boolean } = {},
): SituationAnswer {
  if (situation.company !== "child") {
    return { matches: [], weatherAgainst: 0, grounded: false };
  }

  const matches = experiences.filter((e) => childEvidence(e).length > 0);
  const weatherAgainst = options.wet
    ? matches.filter((e) => shelterOf(e) === "outdoor").length
    : 0;

  return { matches, weatherAgainst, grounded: matches.length > 0 };
}

/**
 * **What the day is actually going to do**, read from a real forecast.
 *
 * Passport already holds hourly readings from Environment Canada with
 * provenance (`lib/environment`), built for October and never brought to
 * generic Discovery. This is the smallest honest reading of one: is anything
 * falling out of the sky during the hours a person actually has.
 *
 * `undefined` where there is no forecast for the area, which is an ordinary
 * answer — the product says nothing about the weather rather than guessing at
 * it, and nobody is asked to type *"it is raining"* when Environment Canada
 * already said so.
 */
export interface DayWeather {
  /** Whether precipitation is expected during the window examined. */
  readonly wet: boolean;
  /** The worst hourly chance seen, where the source gave one. */
  readonly chance?: number;
  /** The source's own words for the worst hour — never re-written. */
  readonly description?: string;
  /** Who said so, so a card can be honest about where this came from. */
  readonly source: string;
}

/** A reading shaped like `HourlyConditions`, named here so this module stays portable. */
interface HourReading {
  readonly at: string;
  readonly sky: string;
  readonly description?: string;
  readonly precipitationChance?: number;
}

/**
 * The chance at which Passport will call a day wet.
 *
 * Sixty per cent, which is Environment Canada's own threshold for saying
 * "showers" rather than "chance of showers". Below it the forecast is hedging
 * and so should the product.
 */
export const WET_CHANCE = 60;

export function readWeather(
  hours: readonly HourReading[],
  source: string,
): DayWeather | undefined {
  if (hours.length === 0) return undefined;

  let worst: HourReading | undefined;
  for (const hour of hours) {
    const chance = hour.precipitationChance ?? 0;
    const falling = hour.sky === "precipitating";
    const score = falling ? Math.max(chance, 100) : chance;
    const bestSoFar = worst
      ? worst.sky === "precipitating"
        ? Math.max(worst.precipitationChance ?? 0, 100)
        : (worst.precipitationChance ?? 0)
      : -1;
    if (score > bestSoFar) worst = hour;
  }
  if (!worst) return undefined;

  const chance = worst.precipitationChance;
  const wet = worst.sky === "precipitating" || (chance ?? 0) >= WET_CHANCE;
  return {
    wet,
    ...(chance !== undefined ? { chance } : {}),
    ...(worst.description ? { description: worst.description } : {}),
    source,
  };
}

/**
 * **PROTOTYPE (local only, not deployed).**
 *
 * *"What should we do with our day?"* is a question about **verbs**. The
 * current answer is a list of **nouns** — Stuart Park Ice Rink, Deer Park,
 * Marshall Field — which is a list of records that happen to satisfy a query,
 * and is the wrong abstraction however well it is ranked.
 *
 * Atlas now states the verbs: `candidate-knowledge/1` holds what you can
 * actually do somewhere. Clustered over the child-doable subjects in the live
 * feed they are genuinely distinct days, not synonyms:
 *
 * ```
 * swimming 33 · playground 28 · picnic 13 · wildlife 11 · walking 10
 * beach 9 · tennis 8 · basketball 7 · skating 7 · soccer 4
 * ```
 *
 * *Go skating* and *find a playground* are two different afternoons. *Stuart
 * Park Ice Rink* and *Memorial Arena* are two rows about one of them.
 *
 * So a direction is a verb plus the places that back it — **never a schedule.**
 * Composing a timeline would need opening hours (stated for 6% of the corpus,
 * and most of those are "Opened in September 1888 by Lord Stanley"), expected
 * duration (1%) and travel feasibility (11% have coordinates). A morning /
 * lunch / afternoon answer built on that is a fabrication, and the doctrine
 * puts sequencing in SHAPE rather than DISCOVER anyway.
 */
export interface Direction {
  /** The verb, in Atlas's own words — `Skating`, `Playground`, `Swimming`. */
  readonly doing: string;
  /** The subjects that state it. The evidence, not a ranking. */
  readonly places: readonly Experience[];
  /** Whether the weather already argues against every one of them. */
  readonly ruledOutByRain: boolean;
}

/**
 * The few distinct things a person could actually do, given their situation.
 *
 * Ordered by how much evidence stands behind each — not a score, a count of
 * places that said so. A direction backed by one record is still offered,
 * because one real option is an answer and an empty page is not.
 */
export function directionsFor(
  experiences: readonly Experience[],
  situation: Situation,
  options: { readonly wet?: boolean } = {},
): readonly Direction[] {
  const { matches } = answerFor(experiences, situation, options);
  if (matches.length === 0) return [];

  const byDoing = new Map<string, Experience[]>();
  for (const experience of matches) {
    for (const doing of childEvidence(experience)) {
      const key = doing.toLowerCase();
      if (!byDoing.has(key)) byDoing.set(key, []);
      byDoing.get(key)!.push(experience);
    }
  }

  return [...byDoing.entries()]
    .map(([key, places]) => ({
      doing: places[0]!.knowledge
        ? (childEvidence(places[0]!).find((d) => d.toLowerCase() === key) ??
          key)
        : key,
      places,
      ruledOutByRain: Boolean(
        options.wet && places.every((p) => shelterOf(p) === "outdoor"),
      ),
    }))
    .sort((a, b) => b.places.length - a.places.length);
}

/**
 * **Where Passport is getting its environmental context, and how it knows.**
 *
 * Until now Discovery forecast for Vernon because *the corpus* is mostly about
 * Vernon — which is a fact about Atlas, not about the person holding the
 * phone. Everything downstream inherited it: the weather was not the reader's
 * weather, and any feasibility reasoning built on top would have been reasoning
 * about somebody else's valley.
 *
 * Four states, kept apart because collapsing them is how a product starts
 * claiming to know where you are:
 *
 * ```
 * default      the area the corpus is about. Honest, and not about the reader.
 * asking       the browser prompt is open. Nothing is known yet.
 * observed     they granted permission and a forecast came back for near them.
 * unavailable  asked and got nowhere — declined, or no forecast published
 *              near them. Back to the default, and not asked again.
 * ```
 *
 * **`observed` is situational.** It is held for this visit and written nowhere:
 * not a profile, not a cookie, not a column. Somebody who shares where they
 * are this afternoon has not told Passport where they live — which is a
 * different fact, already stored under `passport_profiles.home_area`, chosen
 * deliberately in Account, and deliberately not read here.
 */
export type LocationState = "default" | "asking" | "observed" | "unavailable";

/** Why the reader is seeing the default rather than their own area. */
export type LocationLapse =
  /** They said no, or the browser said no on their behalf. */
  | "denied"
  /** The fix or the lookup failed. */
  | "failed"
  /**
   * They shared where they are and Environment Canada publishes no forecast
   * near it. The honest shape of a Canada-only weather provider.
   */
  | "no-forecast";

export interface PlaceContext {
  readonly state: LocationState;
  /**
   * The city the forecast is actually published for — never the reader's own
   * position, which Passport does not hold and would not print.
   */
  readonly area?: string;
  /** How far that city is from them, in km, where the provider said. */
  readonly km?: number;
  readonly lapse?: LocationLapse;
}

export const DEFAULT_PLACE: PlaceContext = { state: "default" };

/**
 * **Coordinates, blunted before they ever leave the browser.**
 *
 * Two decimal places is about a kilometre. The forecast lookup searches 0.6°
 * — some 65 km — for a city Environment Canada publishes, so a precise fix
 * buys nothing and costs everything: Passport would be holding somebody's
 * doorstep in order to answer a question about their valley.
 *
 * So the browser rounds, the server never receives a precise position, and
 * there is nothing precise to leak, log or persist.
 */
export const LOCATION_PRECISION = 2;

export interface Point {
  readonly latitude: number;
  readonly longitude: number;
}

export function blunt(latitude: number, longitude: number): Point {
  const factor = 10 ** LOCATION_PRECISION;
  return {
    latitude: Math.round(latitude * factor) / factor,
    longitude: Math.round(longitude * factor) / factor,
  };
}
