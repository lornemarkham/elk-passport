import type { NamedPick } from "./byName";
import type { Experience } from "@/domain/experience/types";
import {
  comingUp,
  isOver,
  onNow,
  onToday,
  whenLine,
} from "@/domain/discovery/compose";
import { distanceText, distanceTo, sortKm } from "@/domain/discovery/proximity";
import { childEvidence, type Point } from "@/domain/discovery/situation";
import { ageEvidence, ageLine } from "@/domain/discovery/suitability";
import {
  arguesAgainst,
  mayNotRun,
  rainLine,
  standsUpToRain,
} from "@/domain/discovery/environment";
import { recurrenceLine } from "@/domain/discovery/recurrence";
import { areaOf } from "@/domain/discovery/area";
import { ZONE } from "@/domain/experience/eventTime";
import type { SuitabilityStatement } from "@/lib/data/types";
import { defaultRadiusKm } from "@/domain/day/build";
import {
  activitiesOf,
  activityByKey,
  activityEvidence,
  doesActivity,
  type Activity,
  type ActivityTag,
} from "@/domain/discovery/activities";
import { driveSpan, type DiscoveryAsk } from "./read";

/**
 * **An answer to a question, made only of things Atlas states.**
 *
 * `read.ts` turns the sentence into answers; the page applies them, which
 * narrows the pool exactly as tapping the rows would. This picks a handful
 * from what is left and says, for each one, **why it is here** — in facts a
 * person can check, never in a score they would have to trust.
 *
 * ## What a reason is allowed to be
 *
 * ```
 * how far        Atlas's straight-line reading. Never minutes.
 * when           a stated interval or recurrence, relative to the day asked
 * what you do    Atlas's affordances and listed features, in its own words
 * who it suits   Atlas's per-age verdict, as firmly as Atlas holds it
 * how rare       a count over what this page holds — a fact about the
 *                knowledge, not a judgement of taste
 * the rain       Atlas's environment reading, where it has one; else
 *                whether a visit is spent indoors or out
 * how long       Atlas's typical visit, and how firmly it holds it
 * who it's for   a source's own words about audience — adults only, all
 *                ages, families — never a subtype read as a person
 * what time      a start time, where the publisher stated one to the minute
 * ```
 *
 * No popularity, no ratings, no "perfect for you": none of it exists here,
 * and printing it would be invention wearing a number.
 *
 * ## Variety is a rule, not luck
 *
 * The corpus is mostly parks. Ranked on evidence alone, "something to do with
 * three hours" is four parks with playgrounds. So picks are taken one at a
 * time, and each later one pays for sharing a kind, a verb, an attraction or
 * a spot on the map with what is already in the answer.
 *
 * ## Somewhere, or not an answer
 *
 * Once there is an origin, every answer is *from* somewhere, and a pick
 * nobody can place cannot be said to be near it. Measured on 2026-10-11, a
 * quarter of all picks from Vernon and Vancouver were events Atlas holds no
 * location for at all — a Sun Peaks turkey sale led "something to do near
 * Vancouver". Those leave the answer (never the page). A thing Atlas places
 * only in this area, with no point, may fill one later slot with a caveat.
 *
 * ## What the answer cannot know, it says
 *
 * Every pick may carry one caveat — no hours published, nowhere Atlas can
 * place it — and the answer as a whole names what would make it better
 * ("how old?", "from where?") rather than guessing it.
 */
export interface AnswerContext {
  /** Today where the subjects are, `YYYY-MM-DD`. */
  readonly today: string;
  /** Where distances are measured from, once there is somewhere. */
  readonly origin?: Point;
  /** Said out loud: "Vernon", "where you are". */
  readonly originLabel?: string;
  /** The area this page is about, as Atlas names it. */
  readonly home?: string;
  /** Whether the forecast for the day asked about is wet. */
  readonly wet?: boolean;
  /**
   * What "rare" is counted against. Defaults to the pool; the page passes
   * everything it holds in `home` — saved or not, inside the radius or not —
   * because the reason says "the only one in {home}", and that has to be true
   * of the area, not of whatever circle happens to be drawn.
   */
  readonly reference?: readonly Experience[];
  /**
   * **What was already shown in this conversation**, for "show me something
   * completely different": none of these again, and less of what they were.
   */
  readonly shown?: readonly string[];
  /**
   * Varies "surprise me" from one ask to the next. The same seed gives the
   * same answer, so a refresh does not reshuffle what somebody was reading.
   */
  readonly seed?: number;
  /**
   * **Places the latest sentence named** (`findByName`). They lead the
   * answer whatever else the sentence said; when nothing else was read, they
   * are the answer.
   */
  readonly named?: readonly NamedPick[];
}

export interface AnswerPick {
  readonly experience: Experience;
  /** Up to three, each a fact. The first is the one that earned the place. */
  readonly reasons: readonly string[];
  /** The one thing it cannot tell you, where there is one. */
  readonly caveat?: string;
}

/** What would make the answer better, and which row on the page supplies it. */
export interface AnswerGap {
  readonly about: "age" | "origin";
  readonly text: string;
}

export interface Answer {
  readonly heading: string;
  /** What the answer is, honestly — including what it cannot do. */
  readonly note: string;
  readonly picks: readonly AnswerPick[];
  readonly gaps: readonly AnswerGap[];
  /** The sentence said nothing Passport could act on; the picks are generic. */
  readonly unread?: true;
}

/**
 * **How far out "worth the drive" starts.**
 *
 * A product judgement, stated on screen as one, and **not** a conversion from
 * an hour: Passport has no routing and will not invent a speed. It is the
 * line past which something stops being an errand and starts being a trip,
 * and it sits just under `NEAR_KM` so the two never describe the same card
 * differently by more than a few kilometres.
 */
export const DRIVE_FROM_KM = 40;

/** Past this a day trip becomes an overnight. Also a judgement, also stated. */
export const DRIVE_TO_KM = 200;

const NUMBER_WORDS = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

const hoursPhrase = (hours: number): string => {
  if (hours === 0.5) return "Half an hour";
  if (hours === 1) return "An hour";
  const word = Number.isInteger(hours) ? NUMBER_WORDS[hours] : undefined;
  return `${word ?? hours} hours`;
};

const verbsOf = (experience: Experience): readonly string[] => {
  const seen = new Map<string, string>();
  for (const { name } of experience.knowledge?.affordances ?? []) {
    const key = name?.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }
  return [...seen.values()];
};

const kindOf = (experience: Experience): string =>
  (experience.subtype ?? experience.kind).trim().toLowerCase();

/** A subtype that says nothing about the thing — never "rare". */
const UNSAID = new Set(["unknown", "place", "organization", "activity"]);

/**
 * **The family a subtype belongs to**, for counting rarity: its last word,
 * singular. Atlas's labels vary — `park`, `public park`, `municipal park`,
 * `regional park` — and counted as written, Stanley Park was "the only public
 * park in Metro Vancouver". Counting by family can only make a claim rarer
 * to earn, never easier.
 */
const familyOf = (experience: Experience): string =>
  (kindOf(experience).split("/").pop() ?? "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .pop()!
    .replace(/(?<!s)s$/, "");

/**
 * Listed "affordances" that are not something you do. Every one is in the
 * corpus and each made a rarity claim on 2026-10-11 — "the only place here
 * listing community use". Kept closed; a phrase of four words or more is
 * not counted either.
 */
const NOT_A_DOING = new Set([
  "activities",
  "beach access",
  "casual use",
  "community use",
  "conventions",
  "cyclists",
  "eating",
  "events",
  "exhibits",
  "exploration",
  "exploring",
  "filming location",
  "guest services",
  "meetings",
  "outdoor fun",
  "pedestrians",
  "picnic shelter",
  "playing",
  "programs",
  "recreation",
  "relaxing",
  "shopping",
  "sight-seeing",
  "sightseeing",
  "snacking",
  "social opportunities",
  "training",
  "trade shows",
  "trails",
  "washrooms",
]);

const aDoing = (verb: string, experience: Experience): boolean => {
  const key = verb.trim().toLowerCase();
  if (NOT_A_DOING.has(key) || key.split(/\s+/).length > 3) return false;
  // "Explore O'Keefe Ranch" is rare because it names the place.
  const title = experience.title.toLowerCase();
  return !key
    .split(/\s+/)
    .some((word) => word.length > 3 && title.includes(word));
};

/** The first Atlas words that put this in an activity with this tag. */
const taggedEvidence = (
  experience: Experience,
  tag: ActivityTag,
): { activity: Activity; words: readonly string[] } | undefined => {
  for (const activity of activitiesOf(experience)) {
    if (!activity.tags.includes(tag)) continue;
    const words = activityEvidence(experience, activity);
    if (words.length > 0) return { activity, words };
  }
  return undefined;
};

/** "Kayaking, as Atlas lists it" — or "A cinema" where the subtype is the evidence. */
const evidenceLine = (
  experience: Experience,
  words: readonly string[],
): string => {
  const subtype = (experience.subtype ?? "").replace(/[_-]+/g, " ").trim();
  const listed = words.filter((w) => w.toLowerCase() !== subtype.toLowerCase());
  if (listed.length > 0)
    return `${listed.slice(0, 2).join(", ")}, as Atlas lists it`;
  // "skydiving" is a doing, not a thing: said as one.
  if (/ing$/i.test(subtype))
    return `${subtype.charAt(0).toUpperCase()}${subtype.slice(1).toLowerCase()}`;
  const article = /^[aeiou]/i.test(subtype) ? "An" : "A";
  return `${article} ${subtype.toLowerCase().replace(/\//g, " and ")}`;
};

/**
 * **What a person would pay**, only where a source said it costs nothing.
 * Atlas holds no price field for Discovery; a description that says "free
 * admission" or "by donation" is the only evidence there is — and it is
 * quoted, not paraphrased, because "free admission on Family Day" is not
 * free on a Friday. A free that comes with a condition is not claimed.
 */
const FREE_SAID =
  /\b(free (?:admission|entry|of charge|to (?:visit|enter|attend|the public)|event|public skating|skate|tours?|workshop|concert|show)|admission is free|no admission(?: fee)?|by donation|no cost|free for all)\b/i;
const CONDITION =
  /^[^.;]{0,30}\b(on|during|every|each|for members|with|until|before|after|between|first|select|some)\b/i;

export function freeLine(experience: Experience): string | undefined {
  if (/^free\b|\bfree$|\(free\)/i.test(experience.title.trim()))
    return "Free, by its own name";
  const text = `${experience.shortDescription} ${experience.description ?? ""}`;
  const match = FREE_SAID.exec(text);
  if (!match || match.index === undefined) return undefined;
  const after = text.slice(match.index + match[0].length);
  if (CONDITION.test(after)) return undefined;
  return `“${match[0].toLowerCase()}”, as its description says`;
}

export const statesFree = (experience: Experience): boolean =>
  freeLine(experience) !== undefined;

/** Not something the public goes and does, whatever its interval says. */
const NOT_AN_OUTING =
  /\b(conference|election|professional development|meeting|agm|trade show|infrastructure|road rehabilitation|sponsor|fundraising event)\b/i;

/**
 * **Somewhere that sells something** — a winery, a restaurant, a spa. Not a
 * claim about price; a reason not to offer it to somebody who asked for free.
 */
const SELLS =
  /\b(restaurant|caf[eé]|coffee|bakery|bistro|pub|bar|winery|vineyard|brewery|cidery|distillery|spa|hotel|motel|resort|lodge|shop|store|boutique|golf|tour company|guided tour company|rental|escape room|bowling|cinema|arcade|amusement|zipline|yoga studio|food truck|ice cream)\b/i;

/** Features that say something about getting around — never a promise of access. */
const ACCESS = /\b(accessib|wheelchair|elevator|step-free|ramp)\b/i;

/** Tiny deterministic hash, for a seeded shuffle that survives a refresh. */
const jitter = (id: string, seed: number): number => {
  let h = seed | 0;
  for (let i = 0; i < id.length; i++)
    h = (Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0) | 0;
  return ((h >>> 0) % 1000) / 1000;
};

/**
 * **A source's own words about who this is for** — about the whole subject,
 * not one part of it. Adults only, all ages, families, beginners: Atlas's
 * `says`, never a subtype read as a person.
 */
const audience = (
  experience: Experience,
  says: string,
): SuitabilityStatement | undefined =>
  experience.suitability?.statements?.find(
    (statement) =>
      statement.says === says && (statement.scope ?? "subject") === "subject",
  );

/** A stated rule that this is adults only — "19+/No Minors". */
const adultsOnly = (experience: Experience): boolean =>
  audience(experience, "adults-only")?.strength === "rule";

/** Said firmly where a source said it, as a reading where Atlas derived it. */
const firmly = (text: string, basis: string | undefined): string =>
  basis === "derived" ? `${text}, going by what we know` : text;

/** Whether a visit is spent indoors or out, where Atlas reads it. */
const exposureOf = (experience: Experience) => {
  const exposure = experience.environment?.exposure;
  return exposure && exposure.value !== "unknown" ? exposure : undefined;
};

const minutes = (m: number): string =>
  m < 60
    ? `${m} min`
    : `${Number.isInteger(m / 60) ? m / 60 : (m / 60).toFixed(1)} h`;

/**
 * **How long a visit usually takes, as Atlas holds it.** A source's own
 * sentence where it is short enough to read as a reason; else Atlas's range,
 * as a reading where it derived it from what the thing is.
 */
export function visitLine(experience: Experience): string | undefined {
  const visit = experience.visitDuration;
  if (!visit) return undefined;
  if (visit.basis === "explicit" && visit.text && visit.text.length <= 80)
    return visit.text.trim();
  if (!visit.minutes) return undefined;
  const [from, to] = visit.minutes;
  return firmly(
    `Usually ${from === to ? minutes(from) : `${minutes(from)}–${minutes(to)}`}`,
    visit.basis,
  );
}

/**
 * **Whether Atlas says a visit runs longer than the time there is.** Only
 * its shortest typical visit counts: a museum that takes 45 minutes to three
 * hours fits an hour; a ski hill that takes three to seven does not.
 */
const outlasts = (experience: Experience, hours: number): boolean => {
  const range = experience.visitDuration?.minutes;
  return range !== undefined && range[0] > hours * 60;
};

const CLOCK = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONE,
});
const HOUR = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: ZONE,
});

/**
 * **When a one-day event starts**, only where the publisher stated a clock
 * time (`timePrecision: "minute"`). A date-only event has no time, and its
 * midnight timestamp is not one.
 */
function startsAt(
  experience: Experience,
): { readonly clock: string; readonly hour: number } | undefined {
  if (experience.timePrecision !== "minute" || !experience.startTime)
    return undefined;
  const start = new Date(experience.startTime);
  if (Number.isNaN(start.getTime())) return undefined;
  const end = experience.endTime ? new Date(experience.endTime) : undefined;
  // A run's first evening is not tonight's.
  if (end && end.getTime() - start.getTime() > 24 * 3_600_000) return undefined;
  return { clock: CLOCK.format(start), hour: Number(HOUR.format(start)) };
}

/**
 * **Somewhere you would go to do something** — a place, a listed doing, or a
 * visit Atlas holds a typical length for. A hostel and an outfitter are rare
 * in the corpus and neither is an afternoon.
 */
const somethingToDo = (experience: Experience): boolean =>
  experience.kind === "Place" ||
  experience.visitDuration !== undefined ||
  verbsOf(experience).some((verb) => aDoing(verb, experience));

const plural = (noun: string): string =>
  /[^aeiou]y$/.test(noun) ? `${noun.slice(0, -1)}ies` : `${noun}s`;

/** Whether there is anywhere to measure this from `origin`. */
const placed = (experience: Experience, origin: Point | undefined) =>
  distanceTo(experience, origin) !== undefined ||
  experience.distance?.state === "bounded";

/**
 * **Enough here to put in front of somebody as an answer.**
 *
 * The default feed has already removed the parking lots; this is the stricter
 * bar for a handful of named picks. A photograph, something you can do, things
 * inside it, or a description Atlas has not flagged as restating the title.
 * Any one is enough. A thing with none of them stays on the page below — it
 * just does not get offered as *the* answer.
 */
export function substantial(experience: Experience): boolean {
  // **Being on is substance.** A festival on its last day with no photograph
  // and one short line is still today's best answer — found by using it.
  if (experience.startTime) return true;
  if (experience.heroMedia?.src) return true;
  if (verbsOf(experience).length > 0) return true;
  if ((experience.containsCount ?? 0) > 0) return true;
  if ((experience.knowledge?.features?.length ?? 0) > 0) return true;
  const adds = experience.knowledge?.descriptionAddsKnowledge;
  return adds !== false && experience.shortDescription.trim().length >= 80;
}

/**
 * **Dated things answer only the day they are on.** An event next week is not
 * an answer to "this afternoon"; one that is over is not an answer to anything.
 */
function onTheDay(
  pool: readonly Experience[],
  day: string | undefined,
  today: string,
): Experience[] {
  const live = pool.filter((e) => !isOver(e, today));
  if (!day) return live;
  const covering = new Set([
    ...onToday(live, day).map((e) => e.id),
    ...onNow(live, day).map((e) => e.id),
  ]);
  return live.filter((e) => !e.startTime || covering.has(e.id));
}

interface Scored {
  readonly experience: Experience;
  readonly score: number;
  readonly reasons: readonly string[];
  /** Whether it answers what was asked; `undefined` where nothing tests it. */
  readonly fits?: boolean;
}

function rarity(reference: readonly Experience[]) {
  const kinds = new Map<string, number>();
  const families = new Map<string, number>();
  const verbs = new Map<string, number>();
  for (const experience of reference) {
    const kind = kindOf(experience);
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    const family = familyOf(experience);
    families.set(family, (families.get(family) ?? 0) + 1);
    for (const verb of verbsOf(experience)) {
      const key = verb.toLowerCase();
      verbs.set(key, (verbs.get(key) ?? 0) + 1);
    }
  }
  return {
    kind: (e: Experience) => kinds.get(kindOf(e)) ?? 0,
    family: (e: Experience) => families.get(familyOf(e)) ?? 0,
    verb: (v: string) => verbs.get(v.toLowerCase()) ?? 0,
  };
}

interface Scoring extends AnswerContext {
  /** Whether anything in the pool does the activity they named. */
  readonly doingHere?: boolean;
  readonly shownKinds?: ReadonlySet<string>;
  readonly shownActivities?: ReadonlySet<string>;
}

function score(
  experience: Experience,
  ask: DiscoveryAsk,
  context: Scoring,
  rare: ReturnType<typeof rarity>,
  timely: { today: Set<string>; now: Set<string>; soon: Set<string> },
): Scored {
  // What earned the place, then when, then how long, then the sky. The
  // distance is kept apart and always said, last.
  const reasons: string[] = [];
  let value = 0;
  const verbs = verbsOf(experience);
  // What Atlas lists that is something to do — "Conventions, Trade Shows,
  // Meetings" made a convention centre worth the drive.
  const doings = verbs.filter((v) => aDoing(v, experience));
  const day = ask.on ?? context.today;

  // A picture is how somebody decides they want to go (§2.3).
  if (experience.heroMedia?.src) value += 2;
  value += Math.min(doings.length, 4) * 0.5;
  if ((experience.containsCount ?? 0) > 0) value += 1;
  // Atlas's own verdict that the description is the title again.
  if (experience.knowledge?.descriptionAddsKnowledge === false) value -= 2;
  if (experience.knowledge?.descriptionCaveat) value -= 1;

  // **What they named, first** — an activity, evidenced by Atlas's words.
  if (ask.doing) {
    const activity = activityByKey(ask.doing);
    const words = activity ? activityEvidence(experience, activity) : [];
    if (words.length > 0) {
      value += 6;
      reasons.push(evidenceLine(experience, words));
    }
  }

  // **The lens.** Each says what it found, in Atlas's words, and whether
  // this answers it at all (`fits`) — `undefined` where the lens has no
  // test to apply.
  let fits: boolean | undefined;
  switch (ask.lens) {
    case "drive": {
      // **The most to it.** Things to do, things inside it, a photograph.
      // Distance only qualifies; it never ranks — a further place is not a
      // better one.
      value += Math.min(doings.length, 6);
      value += Math.min(experience.containsCount ?? 0, 5);
      if (experience.heroMedia?.src) value += 3;
      const inside = experience.containsCount ?? 0;
      if (doings.length > 0 || inside > 0) {
        const list = doings.slice(0, 3).join(", ");
        reasons.push(
          inside > 0
            ? `${list ? `${list} — and ` : ""}${inside} ${inside === 1 ? "place" : "places"} inside it`
            : doings.length > 3
              ? `${list}, and ${doings.length - 3} more`
              : list,
        );
      }
      fits = doings.length > 0 || inside > 0;
      break;
    }
    case "unusual": {
      // **Rare by what Atlas holds**, which is the only handle Passport has
      // on strange. One of one beats one of two; a park is one of hundreds.
      // Counted by family, so a label's spelling cannot make a thing rare,
      // and never for an event: "Special Events", "Community Event" and
      // "Retail Event" are a publisher's filing, not a kind of thing.
      fits = false;
      const kind = kindOf(experience);
      const count = rare.family(experience);
      const exact = rare.kind(experience);
      const where = context.home ? ` in ${context.home}` : "";
      if (
        experience.kind !== "Event" &&
        !UNSAID.has(kind) &&
        somethingToDo(experience) &&
        count > 0 &&
        count <= 3
      ) {
        value += 8 - count * 2;
        fits = true;
        reasons.push(
          count === 1
            ? `The only ${experience.subtype ?? kind}${where} that Atlas knows of`
            : exact > 1
              ? `One of ${exact} places Atlas calls a ${experience.subtype ?? kind}${where}`
              : `One of ${count} ${plural(familyOf(experience))} Atlas knows of${where}`,
        );
      } else if (count > 12) {
        value -= 3;
      }
      const rareVerb = verbs.find(
        (v) => rare.verb(v) <= 2 && aDoing(v, experience),
      );
      if (rareVerb) {
        value += 3;
        fits = true;
        if (reasons.length < 2)
          reasons.push(
            rare.verb(rareVerb) === 1
              ? `The only place here listing ${rareVerb.toLowerCase()}`
              : `One of two places here listing ${rareVerb.toLowerCase()}`,
          );
      }
      break;
    }
    case "surprise": {
      // **Nothing asked, so a good spread.** A photograph and things to do
      // count; a seeded jitter keeps two asks from being identical, and the
      // variety rule below does the rest. No claim is made about why — the
      // reasons are the same facts any pick carries.
      if (experience.heroMedia?.src) value += 2;
      value += Math.min(doings.length, 3) * 0.5;
      value += jitter(experience.id, context.seed ?? 0) * 4;
      const kind = rare.family(experience);
      if (kind > 0 && kind <= 6 && experience.kind !== "Event") value += 1.5;
      break;
    }
    case "adventure": {
      // **Atlas's words for a thrill**: climbing, ziplines, paddling,
      // mountain biking, skiing. The activity is Passport's grouping; the
      // word on the card is Atlas's.
      const thrill = taggedEvidence(experience, "adventure");
      fits = thrill !== undefined;
      if (thrill) {
        value += 7;
        reasons.push(evidenceLine(experience, thrill.words));
      } else value -= 4;
      break;
    }
    case "kids": {
      // **Evidence a child could do something here**, or a source saying it
      // is for families — or it does not lead, however soon it is on. A
      // party ending tonight once led "somewhere to take my 6 year old".
      const things = childEvidence(experience);
      value += Math.min(things.length, 3) * 2;
      const verdict =
        ask.childAge !== undefined
          ? ageEvidence(experience, ask.childAge).verdict
          : "unknown";
      if (verdict === "welcome") value += 4;
      else if (verdict === "described" || verdict === "priced") value += 2;
      const line =
        ask.childAge !== undefined
          ? ageLine(experience, ask.childAge)
          : undefined;
      if (line && verdict !== "unknown") reasons.push(line);
      const described =
        audience(experience, "children") ??
        audience(experience, "families") ??
        audience(experience, "all-ages");
      if (described) value += 2;
      if (things.length > 0)
        reasons.push(`${things.slice(0, 3).join(" · ")}, as listed`);
      else if (described && reasons.length === 0)
        reasons.push(
          described.says === "all-ages"
            ? "Described as for all ages"
            : "Described as for families",
        );
      // A farm, a museum, animals: an activity Passport groups as one a
      // child does, evidenced by Atlas's own word for it.
      const childish =
        things.length === 0 ? taggedEvidence(experience, "kids") : undefined;
      if (childish) {
        value += 3;
        if (reasons.length < 2)
          reasons.push(evidenceLine(experience, childish.words));
      }
      fits =
        things.length > 0 ||
        childish !== undefined ||
        described !== undefined ||
        verdict === "welcome" ||
        verdict === "described" ||
        verdict === "priced";
      if (!fits) value -= 8;
      break;
    }
    case "couple": {
      // **An evening, or a place that says it is for grown-ups.** Atlas
      // does not say what makes a good date; it does say "19+/No Minors",
      // and a publisher says when the doors open. Places a source describes
      // as for families go down, not out.
      if (adultsOnly(experience)) {
        value += 4;
        reasons.push("Adults only, as stated");
      }
      const start = startsAt(experience);
      // "An afternoon" is the afternoon: a 7:30 concert is not an answer to it.
      const byDay =
        ask.partOfDay === "afternoon" || ask.partOfDay === "morning";
      if (start && start.hour >= 17) value += byDay ? -9 : 3;
      // **By day, somewhere for two** — a winery, a gallery, a view, a spa:
      // activities Passport groups that way, by Atlas's word for each.
      const together =
        ask.partOfDay !== "evening"
          ? taggedEvidence(experience, "date")
          : undefined;
      if (together && together.activity.key !== "eat") {
        value += 4;
        if (reasons.length < 2)
          reasons.push(evidenceLine(experience, together.words));
      }
      fits =
        adultsOnly(experience) ||
        (!byDay && start !== undefined && start.hour >= 17) ||
        (together !== undefined && together.activity.key !== "eat");
      if (audience(experience, "families") || audience(experience, "children"))
        value -= 2;
      break;
    }
    case "group": {
      // **More than one thing to do, and nobody left out.** A source
      // saying all ages or beginners is the evidence; the count of things
      // to do is Atlas's own list.
      if (verbs.length >= 3) value += 2;
      const everyone =
        audience(experience, "all-ages") ?? audience(experience, "beginner");
      if (everyone) {
        value += 2;
        reasons.push(
          everyone.says === "beginner"
            ? "Suits beginners, as described"
            : "Described as for all ages",
        );
      }
      fits =
        verbs.length >= 3 ||
        everyone !== undefined ||
        experience.kind === "Event";
      break;
    }
    default:
      break;
  }

  // **Easy going.** Gentle things up, thrills and long hikes down, and a
  // listed accessibility feature said as listed — never as a promise.
  if (ask.gentle) {
    if (taggedEvidence(experience, "gentle")) value += 2;
    if (taggedEvidence(experience, "adventure")) value -= 4;
    const access = (experience.knowledge?.features ?? []).find((f) =>
      ACCESS.test(f),
    );
    if (access) {
      value += 2;
      if (reasons.length < 2) reasons.push(`${access}, as listed`);
    }
  }

  // **Free, where a source said so** — and nowhere else is it claimed. A
  // ticketed event or a place that sells something goes down, not out.
  if (ask.free) {
    const free = freeLine(experience);
    if (free) {
      value += 6;
      reasons.unshift(free);
    } else if (SELLS.test(experience.subtype ?? "")) value -= 8;
    else if (experience.kind === "Event") value -= 5;
  }

  // **They named an activity.** Something that is not it does not lead, however
  // soon it is on.
  if (ask.doing && context.doingHere) {
    const activity = activityByKey(ask.doing);
    if (activity && activityEvidence(experience, activity).length === 0)
      value -= 9;
  }

  // **Different from what was just shown**: less of the same kinds and
  // activities, whichever lens is asked.
  if (context.shownKinds?.has(kindOf(experience))) value -= 3;
  if (
    context.shownActivities &&
    activitiesOf(experience).some((a) => context.shownActivities!.has(a.key))
  )
    value -= 2;

  // **The sky**, read once: it can decide whether this fits at all.
  const exposure = exposureOf(experience);
  const dry = standsUpToRain(experience) || exposure?.value === "indoor";
  if (ask.shelter === "indoor") fits = fits !== false && dry;
  if (ask.shelter === "outdoor")
    fits =
      fits !== false &&
      (arguesAgainst(experience) ||
        exposure?.value === "outdoor" ||
        exposure?.value === "sheltered-outdoor");

  // **Timely.** Today's news beats a long run beats something next week —
  // among things that answer the question. A party ending tonight is not
  // "somewhere inside" or "something unusual" for being on, so what does
  // not fit what was asked counts its timeliness for half; "worth the
  // drive" counts it for half regardless.
  const weight = (ask.lens === "drive" ? 0.5 : 1) * (fits === false ? 0.5 : 1);
  // And it costs: offered at all, it is offered after what does fit. (A
  // child's answer already paid more, above.)
  if (fits === false && ask.lens !== "kids") value -= 4;
  const when = whenLine(experience, day);
  const start = startsAt(experience);
  const at = (line: string) => (start ? `${line} · ${start.clock}` : line);
  if (timely.today.has(experience.id)) {
    // Today's news, and more so when it is about to be gone: a last day
    // outranks a park that will still be there next week.
    value += 6 * weight;
    if (when && /^(Last day|Today only|Ends tomorrow)$/.test(when))
      value += 2 * weight;
    if (when) reasons.push(at(when));
    // "Tonight" is the evening: a matinee is not an answer to it.
    if (ask.partOfDay === "evening" && start && start.hour < 16) value -= 4;
  } else if (timely.now.has(experience.id)) {
    value += 1.5 * weight;
    if (when) reasons.push(when);
  } else if (timely.soon.has(experience.id)) {
    value += 1 * weight;
    if (when) reasons.push(at(when));
  }
  if (!experience.startTime) {
    const recurs = recurrenceLine(experience);
    if (recurs && experience.schedule?.onDate?.reading === "on") {
      value += 2;
      reasons.push(recurs);
    } else if (ask.lens === "on") {
      // **"What's on" is about things that are on.** A place with no
      // published hours for the day is an answer only once nothing is.
      value -= 5;
    }
  }

  // **How long it usually takes**, once they have said how long they have.
  if (ask.hours !== undefined) {
    const range = experience.visitDuration?.minutes;
    if (range && range[1] <= ask.hours * 60) value += 2;
    else if (range) value += 1;
    const line = visitLine(experience);
    if (line) reasons.push(line);
  }

  // **The sky**, where it is wet or they asked to stay dry — Atlas's rain
  // reading first, then whether a visit is spent indoors at all.
  if (ask.shelter === "indoor") {
    // **Asked to stay dry**: a museum, a rink, a cinema — an activity that is
    // spent indoors, by Atlas's word for it — before a park with a shelter.
    const inside = taggedEvidence(experience, "indoor");
    if (inside) {
      value += 3;
      if (reasons.length < 2)
        reasons.push(evidenceLine(experience, inside.words));
    }
    if (exposure?.value === "indoor") value += 2;
  }
  if (context.wet || ask.shelter === "indoor") {
    if (standsUpToRain(experience)) {
      value += ask.shelter === "indoor" ? 1 : 3;
      const line = rainLine(experience);
      if (line) reasons.push(line);
    } else if (arguesAgainst(experience)) value -= 4;
    else if (exposure?.value === "indoor") {
      value += 3;
      reasons.push(firmly("Indoors", exposure.basis));
    } else if (exposure?.value === "sheltered-outdoor") value += 1;
    else if (
      exposure?.value === "outdoor" ||
      exposure?.value === "weather-dependent" ||
      mayNotRun(experience)
    )
      value -= ask.shelter === "indoor" ? 5 : 3;
  } else if (ask.shelter === "outdoor") {
    if (
      arguesAgainst(experience) ||
      exposure?.value === "outdoor" ||
      exposure?.value === "sheltered-outdoor"
    ) {
      value += 2;
      if (exposure) reasons.push(firmly("Outdoors", exposure.basis));
    } else if (exposure?.value === "indoor") value -= 3;
  }

  // **Close is better when somebody has a few hours, a kid, or said nearby**
  // — and past the reach it costs, so an event 50 km away does not lead
  // "today" for being on. Never for "worth the drive", and never for
  // anything Atlas cannot place, which keeps its place rather than sinking
  // for a fact nobody knows.
  const km = distanceTo(experience, context.origin);
  if (km !== undefined && ask.lens !== "drive") {
    const reach =
      ask.withinKm ??
      (ask.driveMinutes !== undefined
        ? Math.max(5, ask.driveMinutes * 0.8)
        : ask.near
          ? 15
          : 30);
    const pull = ask.lens === "on" ? 6 : 4;
    value += pull * (1 - Math.min(km / reach, 1));
    if (km > reach) value -= 3 * Math.min((km - reach) / reach, 1);
  }

  // Nothing specific earned it a reason: say what is on offer.
  if (reasons.length === 0) {
    if (verbs.length > 0) reasons.push(verbs.slice(0, 3).join(", "));
    else if ((experience.containsCount ?? 0) > 0)
      reasons.push(
        `${experience.containsCount} ${experience.containsCount === 1 ? "place" : "places"} inside it`,
      );
  }

  // A distance is always worth saying, last, once there is an origin.
  const far = distanceText(experience, context.origin);
  const kept = reasons.slice(0, far ? 2 : 3);
  if (far) kept.push(ask.lens === "drive" ? `${far}, in a straight line` : far);

  return {
    experience,
    score: value,
    reasons: kept,
    ...(fits !== undefined ? { fits } : {}),
  };
}

/** The one thing a pick cannot tell you, where there is one. */
function caveatFor(
  experience: Experience,
  ask: DiscoveryAsk,
  context: AnswerContext,
): string | undefined {
  if (context.origin && distanceTo(experience, context.origin) === undefined) {
    return experience.distance?.state === "bounded"
      ? undefined
      : "Atlas can't place this, so we can't say how far";
  }
  if (ask.free && !statesFree(experience))
    return "No price stated — check before you go";
  if (experience.schedule?.onDate?.reading === "conflicting")
    return "Its stated hours disagree — check before you go";
  if (
    ask.on &&
    !experience.startTime &&
    experience.schedule?.onDate?.reading !== "on"
  )
    return "No hours published — check before you go";
  return undefined;
}

const point = (experience: Experience) => {
  const c = experience.geography?.coordinates;
  return c ? { lng: c[0], lat: c[1] } : undefined;
};

/** Close enough on the map to be the same spot held twice. ~200 m. */
const sameSpot = (a: Experience, b: Experience): boolean => {
  const p = point(a);
  const q = point(b);
  if (!p || !q) return false;
  return Math.abs(p.lat - q.lat) < 0.002 && Math.abs(p.lng - q.lng) < 0.003;
};

const titleKey = (experience: Experience): string =>
  experience.title
    .toLowerCase()
    .replace(/\b(the|and|society|association|inc|ltd)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(" ");

/**
 * **One at a time, each paying for what it repeats.**
 *
 * Hard rules for the things that read as broken — the same name twice, two
 * records on one spot, two parts of one attraction, or more than one thing
 * nobody can say how far away is (and never that one first). Soft costs for
 * the things that read as samey — the same kind, the same family of kind,
 * the same verbs.
 */
function varied(
  scored: readonly Scored[],
  limit: number,
  isPlaced: (experience: Experience) => boolean = () => true,
): Scored[] {
  const chosen: Scored[] = [];
  const left = [...scored];
  while (chosen.length < limit && left.length > 0) {
    let best = -1;
    let bestValue = Number.NEGATIVE_INFINITY;
    left.forEach((candidate, index) => {
      const e = candidate.experience;
      if (
        !isPlaced(e) &&
        (chosen.some(({ experience: c }) => !isPlaced(c)) ||
          (chosen.length === 0 &&
            left.some(({ experience: x }) => isPlaced(x))))
      )
        return;
      const clash = chosen.some(({ experience: c }) => {
        if (titleKey(c) === titleKey(e)) return true;
        if (sameSpot(c, e)) return true;
        const group = (x: Experience) => x.partOf?.id ?? x.context?.id;
        return (
          (group(e) && (group(e) === c.id || group(e) === group(c))) ||
          group(c) === e.id
        );
      });
      if (clash) return;
      const sameKind = chosen.filter(
        ({ experience: c }) => kindOf(c) === kindOf(e),
      ).length;
      // "park", "public park", "municipal park": the same thing to a person.
      const sameFamily = chosen.filter(
        ({ experience: c }) =>
          familyOf(c) === familyOf(e) && kindOf(c) !== kindOf(e),
      ).length;
      const seen = new Set(
        chosen.flatMap(({ experience: c }) =>
          verbsOf(c).map((v) => v.toLowerCase()),
        ),
      );
      const verbs = verbsOf(e).map((v) => v.toLowerCase());
      const overlap =
        verbs.length > 0
          ? verbs.filter((v) => seen.has(v)).length / verbs.length
          : 0;
      const value =
        candidate.score - sameKind * 3 - sameFamily * 2 - overlap * 2;
      if (value > bestValue) {
        bestValue = value;
        best = index;
      }
    });
    if (best < 0) break;
    chosen.push(left.splice(best, 1)[0]!);
  }
  return chosen;
}

/** How many picks. A short window is a short answer. */
function limitFor(ask: DiscoveryAsk): number {
  if (ask.hours !== undefined && ask.hours <= 2) return 3;
  if (ask.lens === "time" || ask.lens === "couple") return 4;
  return 6;
}

/**
 * **Questions that are about being close.** For these, a pick Atlas places
 * only somewhere in the area — which is up to 200 km of valley — is not an
 * answer either.
 */
const aboutClose = (ask: DiscoveryAsk): boolean =>
  ask.near === true ||
  ask.driveMinutes !== undefined ||
  ask.hours !== undefined ||
  ask.lens === "time" ||
  ask.lens === "on" ||
  ask.lens === "drive";

const dayWord = (day: string, today: string): string => {
  if (day === today) return "today";
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (day === tomorrow) return "tomorrow";
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
};

/**
 * The planning circle, where somebody said how long they have and has
 * somewhere to measure from — and did not state a distance themselves,
 * which the radius row already applies.
 */
function circleFor(
  ask: DiscoveryAsk,
  context: AnswerContext,
): number | undefined {
  if (ask.hours === undefined || ask.lens === "drive") return undefined;
  if (!context.origin || ask.withinKm !== undefined) return undefined;
  if (ask.driveMinutes !== undefined) return undefined;
  return defaultRadiusKm(ask.hours);
}

/**
 * Atlas's routed driving minutes for a place; 0 where it has none, which never
 * reads as over anything — a missing estimate is not a long one.
 */
function routedMinutes(e: Experience): number {
  return e.travel?.kind === "routed" ? e.travel.minutes : 0;
}

/** A trail is hiking; a park that also lists hiking is still a park. */
function onlyWhatTheyRefused(e: Experience, avoid: readonly string[]): boolean {
  const avoided = new Set(avoid);
  const all = activitiesOf(e);
  if (all.length === 0) return false;
  const subtype = (e.subtype ?? "").toLowerCase();
  const isIt = all.some((a) => avoided.has(a.key) && a.subtype?.test(subtype));
  return isIt || all.every((a) => avoided.has(a.key));
}

/**
 * **What the rest of the page may show, once somebody has said something.**
 *
 * The answer picks a handful; the editorial sections under it (*Happening
 * today*, *Get outside*, …) used to carry on as though nothing had been said,
 * so "somewhere indoors" sat above a full *Get outside* shelf. This is the
 * same set of hard answers `answerAsk` removes by — a stated drive, a stated
 * length of visit, an adults-only rule with a child, what they said no to,
 * the planning circle — plus the sky they asked for, where Atlas states
 * which side of a wall a visit is on. Silence removes nothing: a place Atlas
 * says nothing about stays, as it does everywhere else on the page.
 */
export function fitsConversation(
  ask: DiscoveryAsk,
  context: Pick<AnswerContext, "origin">,
): (experience: Experience) => boolean {
  const limit =
    ask.driveMinutes !== undefined && context.origin && ask.lens !== "drive"
      ? ask.driveMinutes
      : undefined;
  const circle = circleFor(ask, { today: "", ...context });
  return (e) => {
    if (ask.avoid?.length && onlyWhatTheyRefused(e, ask.avoid)) return false;
    if (ask.company === "child" && adultsOnly(e)) return false;
    if (
      ask.hours !== undefined &&
      ask.lens !== "drive" &&
      outlasts(e, ask.hours)
    )
      return false;
    if (limit !== undefined) {
      const routed = e.travel?.kind === "routed" ? e.travel.minutes : undefined;
      const km = distanceTo(e, context.origin);
      if (
        routed !== undefined
          ? routed > limit
          : km !== undefined && km > (limit / 60) * 100
      )
        return false;
    }
    if (circle !== undefined && (distanceTo(e, context.origin) ?? 0) > circle)
      return false;
    const exposure = exposureOf(e);
    if (ask.shelter === "indoor") {
      if (standsUpToRain(e) || exposure?.value === "indoor") return true;
      if (taggedEvidence(e, "indoor")) return true;
      if (
        arguesAgainst(e) ||
        exposure?.value === "outdoor" ||
        exposure?.value === "weather-dependent"
      )
        return false;
    }
    if (ask.shelter === "outdoor" && exposure?.value === "indoor") return false;
    return true;
  };
}

/** Whether the reading found nothing at all beyond the words themselves. */
export function readNothing(ask: DiscoveryAsk): boolean {
  return Object.keys(ask).every((key) => key === "said");
}

/**
 * What a sentence nothing was read from is told. Passport can only offer
 * places Atlas holds, so a name it cannot match is said to be one, rather than
 * answered with something near it.
 */
export const UNREAD_NOTE =
  "Nothing in that matched a length of time, who's coming, a day, a town or something to do, so these are only a starting point, not an answer to it. Try “three hours with my kid on Saturday”, “something unusual near Vernon”, or the name of a place. Passport only offers places Atlas knows about, so a place it doesn't hold won't be made up.";

function framing(
  ask: DiscoveryAsk,
  context: AnswerContext,
  overSpan = 0,
): { heading: string; note: string } {
  // "Vernon, BC" is a picker label; a heading says "Vernon".
  const from = context.originLabel?.replace(/,\s*BC$/, "");
  const near = from === "where you are" ? "you" : from;
  const area = context.home ? ` in ${context.home}` : "";
  switch (ask.lens) {
    case "drive":
      if (context.origin && ask.driveHours !== undefined)
        return {
          heading: `Worth ${driveSpan(ask.driveHours)} of driving`,
          note: `You said ${driveSpan(ask.driveHours)}. Passport can't time a drive itself: a card shows Atlas's drive estimate where Atlas has one${overSpan > 0 ? ` (${overSpan} over ${driveSpan(ask.driveHours)} ${overSpan === 1 ? "was" : "were"} left out)` : ""}, and every other distance is a straight line from ${from}, ${DRIVE_FROM_KM}+ km out, nearest first. Check the drive before you go.`,
        };
      return context.origin
        ? {
            heading: "Worth the drive",
            note: `Passport can't time a drive — there's no routing here. These are ${DRIVE_FROM_KM}+ km from ${from} in a straight line, and each has the most to it: things to do, places inside it, a photograph.`,
          }
        : {
            heading: "Worth the drive",
            note: "Worth the drive from where? Until you pick a town or share your location, these are just the places with the most to them.",
          };
    case "surprise":
      return {
        heading: near
          ? `A few ideas, close to ${near}`
          : "A few ideas to start",
        note: "A spread of real places and things on, each different from the last — tap one, or tell me more and it'll sharpen.",
      };
    case "adventure":
      return {
        heading: near
          ? `Something adventurous, near ${near}`
          : "Something adventurous",
        note: "Climbing, ziplines, paddling, mountain biking and the like — Passport's grouping of what Atlas lists at each place.",
      };
    case "unusual":
      return {
        heading: ask.near
          ? "Something unusual, close by"
          : "Something you didn't know was here",
        note: `Unusual by what Atlas holds${area}: the rarest kinds of place and the rarest things to do, not a judgement of taste.`,
      };
    case "kids": {
      const when = ask.partOfDay ? ` this ${ask.partOfDay}` : "";
      return {
        heading: `Somewhere to take a kid${when}`,
        note:
          ask.childAge === undefined
            ? "Places that list a playground, a beach, a picnic spot or animals come first. Pick an age and places that state an age rule are checked against it."
            : `Places that state they don't admit a ${ask.childAge}-year-old are out, and places that welcome one come first. Most say nothing about age, and stay.`,
      };
    }
    case "time": {
      const hours = hoursPhrase(ask.hours!);
      return {
        heading: from
          ? `${hours}, close to ${from === "where you are" ? "you" : from}`
          : `${hours} — where I'd start`,
        note: `Close by${circleFor(ask, context) !== undefined ? ` — inside ${circleFor(ask, context)} km in a straight line —` : ""} and different from each other. How long each usually takes is Atlas's reading where it has one, and anything it says runs longer than ${hours.toLowerCase()} is left out. Make a day of it for an order and a printable plan.`,
      };
    }
    case "on": {
      const when = dayWord(ask.on ?? context.today, context.today);
      const tonight = ask.partOfDay === "evening" && when === "today";
      return {
        heading: `What's on ${tonight ? "tonight" : when}${near ? `, close to ${near}` : ""}`,
        note: `Things Atlas holds a date for on that day come first, closest first, with a start time where the publisher gave one. Places follow only where nothing else is on — and where their hours aren't published, say so.`,
      };
    }
    case "couple":
      if (ask.partOfDay === "afternoon" || ask.partOfDay === "morning")
        return {
          heading: `For the two of you, this ${ask.partOfDay}`,
          note: "Wineries, galleries, views, spas and shows by day come first — by Atlas's word for each place — and nothing that starts in the evening. That ordering is Passport's; Atlas doesn't say what makes a good date.",
        };
      return {
        heading:
          ask.partOfDay === "evening"
            ? "For the two of you, tonight"
            : "For the two of you",
        note: "What's on in the evening, and anything stated as adults only, comes first; places described as being for families go down. That ordering is Passport's — Atlas doesn't say what makes a good date.",
      };
    case "group":
      return {
        heading: "With friends",
        note: "Places with several things to do, what's on, and anywhere described as suiting all ages or beginners come first. Atlas doesn't say what suits a group — that ordering is Passport's.",
      };
    default:
      // **Nothing was read, and the page says so.** A sentence with no length
      // of time, company, day, town, activity or way of looking used to get
      // "Here's where I'd start — picked from what fits your answers", which
      // claimed an understanding nobody had. The picks are the same real
      // Atlas subjects; what changes is that they are no longer dressed up as
      // an answer, and the way forward is named. Nothing here echoes the
      // sentence back or guesses what a place name meant.
      if (ask.different)
        return {
          heading: "Something completely different",
          note: "Away from what was just on screen, keeping who, when and how far.",
        };
      if (readNothing(ask))
        return {
          heading: "I didn't catch what you're after",
          note: UNREAD_NOTE,
        };
      if (ask.shelter === "indoor")
        return {
          heading: near ? `Somewhere dry, near ${near}` : "Somewhere dry",
          note: "Things spent indoors come first — museums, rinks, cinemas, galleries — by what Atlas says each place is; where Atlas reads the weather, that decides.",
        };
      if (ask.shelter === "outdoor" && !ask.doing)
        return {
          heading: near
            ? `Out in the fresh air, near ${near}`
            : "Out in the fresh air",
          note: "Outdoors by Atlas's reading of each place, and different from each other.",
        };
      return ask.company === "alone"
        ? {
            heading: "On your own — where I'd start",
            note: "Atlas doesn't say what suits one person, so being on your own doesn't change these picks — they fit your other answers, each for a reason you can check.",
          }
        : {
            heading: "Here's where I'd start",
            note: "Picked from what fits your answers, each for a reason you can check.",
          };
  }
}

/**
 * Answer the question.
 *
 * `pool` is what the page's answers leave — the hard rules (age, day,
 * radius) are already applied, so nothing here removes for them again.
 */
export function answerAsk(
  pool: readonly Experience[],
  ask: DiscoveryAsk,
  context: AnswerContext,
): Answer {
  const day = ask.on ?? context.today;
  let candidates = onTheDay(pool, ask.on, context.today)
    .filter(substantial)
    .filter((e) => !NOT_AN_OUTING.test(e.subtype ?? ""));

  if (ask.lens === "drive" && context.origin) {
    candidates = candidates.filter((e) => {
      const km = sortKm(e);
      return km >= DRIVE_FROM_KM && km <= DRIVE_TO_KM;
    });
  }
  // **A drive somebody said they would make is a limit, where Atlas can
  // check it.** Passport has no speed of its own, so only Atlas's routed
  // estimate can say a place is over it — and then it leaves. A place with no
  // routed time stays and says so; it is never assumed to fit.
  const spanMinutes =
    ask.lens === "drive" && ask.driveHours !== undefined
      ? ask.driveHours * 60
      : undefined;
  let overSpan = 0;
  if (spanMinutes !== undefined) {
    candidates = candidates.filter((e) => {
      const over = routedMinutes(e) > spanMinutes;
      if (over) overSpan += 1;
      return !over;
    });
  }
  // **A drive they will make, at most.** Atlas's routed estimate decides
  // where it has one. Where it has none, only physics may: a place further
  // in a straight line than a car covers at 100 km/h in that time cannot be
  // inside it. That bound removes; it is never printed as a drive time.
  const limit = ask.driveMinutes;
  let overLimit = 0;
  if (limit !== undefined && context.origin && ask.lens !== "drive") {
    candidates = candidates.filter((e) => {
      const routed = e.travel?.kind === "routed" ? e.travel.minutes : undefined;
      const km = distanceTo(e, context.origin);
      const over =
        routed !== undefined
          ? routed > limit
          : km !== undefined && km > (limit / 60) * 100;
      if (over) overLimit += 1;
      return !over;
    });
  }
  // **What they said no to.** A trail is hiking; a park that also lists
  // hiking is still a park with other things in it, and stays.
  if (ask.avoid?.length) {
    const avoided = ask.avoid;
    candidates = candidates.filter((e) => !onlyWhatTheyRefused(e, avoided));
  }
  // **Something completely different**: nothing already shown.
  const shown = new Set(ask.different ? (context.shown ?? []) : []);
  const shownBefore = (context.reference ?? pool).filter((e) =>
    shown.has(e.id),
  );
  if (shown.size > 0) candidates = candidates.filter((e) => !shown.has(e.id));
  // **Somewhere, or not an answer** (see the top of this file). With an
  // origin, a pick needs a distance — or, for a question that is not about
  // being close, an area Atlas places it in that is this one.
  // **An activity they named is answered even where Atlas cannot place it**
  // — five cinemas with no location are still the honest answer to "movies",
  // each saying it cannot be placed — rather than replaced by something
  // that can be measured and is not a film.
  const named = activityByKey(ask.doing);
  const doer = (e: Experience) =>
    named !== undefined && activityEvidence(e, named).length > 0;
  const isPlaced = (e: Experience) => placed(e, context.origin) || doer(e);
  if (context.origin) {
    const close = aboutClose(ask);
    candidates = candidates.filter(
      (e) =>
        isPlaced(e) ||
        (!close && context.home !== undefined && areaOf(e) === context.home),
    );
    // Past a day trip is not an answer to anything but "worth the drive".
    if (ask.lens !== "drive")
      candidates = candidates.filter(
        (e) => (distanceTo(e, context.origin) ?? 0) <= DRIVE_TO_KM,
      );
  }
  // **A stated adults-only rule is not somewhere to take a child**, whatever
  // age they are — the age row only checks the ages Atlas was asked about.
  if (ask.company === "child")
    candidates = candidates.filter((e) => !adultsOnly(e));
  // **Atlas says it takes longer than there is.** Its shortest usual visit,
  // past the hours somebody said they have.
  if (ask.hours !== undefined && ask.lens !== "drive") {
    const hours = ask.hours;
    candidates = candidates.filter((e) => !outlasts(e, hours));
  }

  // **A few hours should fit inside themselves** — the same stated circle
  // `/go` plans a day of that length inside, so the two pages agree. Only
  // what Atlas measured past it leaves; what it could not place stays.
  const circle = circleFor(ask, context);
  if (circle !== undefined) {
    candidates = candidates.filter(
      (e) => (distanceTo(e, context.origin) ?? 0) <= circle,
    );
  }

  const reference = context.reference ?? pool;
  const rare = rarity(reference);
  const timely = {
    today: new Set(onToday(candidates, day).map((e) => e.id)),
    now: new Set(onNow(candidates, day).map((e) => e.id)),
    soon: new Set(
      ask.on ? [] : comingUp(candidates, context.today, 7).map((e) => e.id),
    ),
  };

  const scoring: Scoring = {
    ...context,
    doingHere: candidates.some(doer),
    ...(shownBefore.length > 0
      ? {
          shownKinds: new Set(shownBefore.map(kindOf)),
          shownActivities: new Set(
            shownBefore.flatMap((e) => activitiesOf(e).map((a) => a.key)),
          ),
        }
      : {}),
  };
  const scored = candidates
    .map((e) => score(e, ask, scoring, rare, timely))
    .sort((a, b) => b.score - a.score);

  let chosen = varied(scored, limitFor(ask), (e) =>
    context.origin ? placed(e, context.origin) || doer(e) : true,
  );
  // **An activity they named, and enough of it:** nothing else is offered
  // beside it. One cinema and four concerts is not an answer to "movies".
  if (named && chosen.filter(({ experience }) => doer(experience)).length >= 2)
    chosen = chosen.filter(({ experience }) => doer(experience));
  // **Nothing answered it — say so**, rather than pass the nearest things
  // off as an answer to a question they do not answer.
  const missed =
    chosen.length > 0 && chosen.every(({ fits }) => fits === false);
  // **A stated length of drive puts the nearest first.** Relevance still
  // decides *which* places are offered; once somebody has said how long they
  // will drive, the order they meet them in is how far each is.
  const ordered =
    spanMinutes !== undefined
      ? [...chosen].sort((a, b) => sortKm(a.experience) - sortKm(b.experience))
      : chosen;
  // **What they named comes first** — and when nothing else in the sentence
  // could be read, it is the whole answer, not a starting point beside it.
  const byName = context.named ?? [];
  const unread = readNothing(ask);
  const namedIds = new Set(byName.map((n) => n.experience.id));
  const merged = [
    ...byName.map(({ experience, reason }) => ({
      experience,
      reasons: [reason],
    })),
    ...(unread && byName.length > 0
      ? []
      : ordered.filter(({ experience }) => !namedIds.has(experience.id))),
  ].slice(0, Math.max(limitFor(ask), byName.length));
  const picks = merged.map(({ experience, reasons }) => {
    const caveat = caveatFor(experience, ask, context);
    return { experience, reasons, ...(caveat ? { caveat } : {}) };
  });

  const gaps: AnswerGap[] = [];
  if (ask.company === "child" && ask.childAge === undefined)
    gaps.push({
      about: "age",
      text: "How old? Say it — “she's 6” — and stated age rules get checked.",
    });
  if (
    (ask.near ||
      ask.driveMinutes !== undefined ||
      ask.lens === "drive" ||
      ask.lens === "time" ||
      ask.lens === "on") &&
    !context.origin
  )
    gaps.push({
      about: "origin",
      text: "From where? Pick a town or share your location, and distances count.",
    });

  const framed = framing(ask, context, overSpan);
  const activity = activityByKey(ask.doing);
  const doingFound =
    !activity ||
    chosen.some(({ experience }) => doesActivity(experience, activity.key));
  const heading =
    activity && doingFound && !ask.lens
      ? `${activity.label}${context.originLabel ? `, from ${context.originLabel.replace(/,\s*BC$/, "")}` : ""}`
      : framed.heading;
  const extras: string[] = [];
  if (activity && !doingFound)
    extras.push(
      `Atlas doesn't list anywhere for ${activity.label.toLowerCase()} that fits the rest of this, so these are the nearest things to it.`,
    );
  // Without an origin the "From where?" gap below says it once.
  if (limit !== undefined && ask.lens !== "drive" && context.origin)
    extras.push(
      `Up to ${limit} minutes away: Atlas's drive estimate decides where it has one${overLimit > 0 ? ` (${overLimit} ${overLimit === 1 ? "was" : "were"} left out as further)` : ""}; anywhere it has none is shown with its straight-line distance.`,
    );
  if (ask.free)
    extras.push(
      "Atlas rarely states prices. Where a description says free, the card says so; places that sell things are left down, and everything else says no price is stated.",
    );
  if (ask.avoid?.length)
    extras.push(
      `No ${ask.avoid
        .map((k) => activityByKey(k)?.label.toLowerCase() ?? k)
        .join(" or ")} — places that are only that are left out.`,
    );
  if (ask.different && shown.size > 0)
    extras.push("None of what you were just shown, and less of its kind.");
  // **An empty drive says which wall it hit**, so the next move is obvious:
  // the span, or the band, or there being nowhere to measure from.
  const note =
    picks.length === 0 && ask.lens === "drive" && context.origin
      ? overSpan > 0 && ask.driveHours !== undefined
        ? `Atlas's drive estimates put everything it could offer past ${driveSpan(ask.driveHours)} from ${context.originLabel ?? "here"}. Try a longer drive, or a different starting town.`
        : `Nothing Atlas can place and say something about sits ${DRIVE_FROM_KM}–${DRIVE_TO_KM} km from ${context.originLabel ?? "here"}. Try another starting town — or ask for something close.`
      : framed.note;
  const answered = missed
    ? `${note} Nothing Atlas holds here clearly answers that${ask.on ? ` for ${dayWord(ask.on, context.today)}` : ""}, so these are the nearest things to it.`
    : note;
  const said =
    unread && byName.length > 0
      ? `Found by name in what Atlas holds${byName.length > 1 ? ", best match first" : ""}. Say more — who's coming, how long, when — and the rest of the page answers around it.`
      : [answered, ...extras].join(" ");
  return {
    heading:
      unread && byName.length > 0
        ? byName.length === 1
          ? byName[0]!.experience.title
          : `Matching “${ask.said.trim()}”`
        : heading,
    // The forecast changed the order, so the answer says so.
    note: context.wet
      ? `${said} It's wet today, so somewhere under cover comes first where Atlas knows.`
      : said,
    picks,
    gaps,
    ...(unread && byName.length === 0 ? { unread: true as const } : {}),
  };
}

/**
 * **The way into *Go have a day*, carrying what was already decided.**
 *
 * The sentence, so `/go` reads it the same way (it shares `readBrief`); the
 * town, age and day the page already holds, so nobody retypes them; and the
 * ids somebody chose, so the day is built **around** them rather than from
 * scratch. Never a coordinate — a shared position stays in the browser
 * (ADR 002), and `/go` measures from the town or says it cannot.
 */
export function dayHref(options: {
  readonly say?: string;
  readonly with?: readonly string[];
  readonly at?: string;
  readonly age?: number;
  readonly on?: string;
}): string {
  const params = new URLSearchParams();
  if (options.say?.trim()) params.set("say", options.say.trim());
  if (options.with?.length) params.set("with", options.with.join(","));
  if (options.at) params.set("at", options.at);
  if (options.age !== undefined) params.set("age", String(options.age));
  if (options.on) params.set("on", options.on);
  const query = params.toString();
  return query ? `/go?${query}` : "/go";
}
