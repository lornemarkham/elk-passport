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
  rainLine,
  standsUpToRain,
} from "@/domain/discovery/environment";
import { recurrenceLine } from "@/domain/discovery/recurrence";
import { defaultRadiusKm } from "@/domain/day/build";
import type { DiscoveryAsk } from "./read";

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
 * the rain       Atlas's environment reading, where it has one
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
}

function rarity(reference: readonly Experience[]) {
  const kinds = new Map<string, number>();
  const verbs = new Map<string, number>();
  for (const experience of reference) {
    const kind = kindOf(experience);
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    for (const verb of verbsOf(experience)) {
      const key = verb.toLowerCase();
      verbs.set(key, (verbs.get(key) ?? 0) + 1);
    }
  }
  return {
    kind: (e: Experience) => kinds.get(kindOf(e)) ?? 0,
    verb: (v: string) => verbs.get(v.toLowerCase()) ?? 0,
  };
}

function score(
  experience: Experience,
  ask: DiscoveryAsk,
  context: AnswerContext,
  rare: ReturnType<typeof rarity>,
  timely: { today: Set<string>; now: Set<string>; soon: Set<string> },
): Scored {
  const reasons: string[] = [];
  let value = 0;
  const verbs = verbsOf(experience);
  const day = ask.on ?? context.today;

  // A picture is how somebody decides they want to go (§2.3).
  if (experience.heroMedia?.src) value += 2;
  value += Math.min(verbs.length, 4) * 0.5;
  if ((experience.containsCount ?? 0) > 0) value += 1;
  // Atlas's own verdict that the description is the title again.
  if (experience.knowledge?.descriptionAddsKnowledge === false) value -= 2;
  if (experience.knowledge?.descriptionCaveat) value -= 1;

  // **What they named, first.**
  if (ask.doing) {
    const hit = verbs.find((v) => v.toLowerCase() === ask.doing!.toLowerCase());
    if (hit) {
      value += 6;
      reasons.push(`${hit}, as Atlas lists it here`);
    }
  }

  // **Timely.** Today's news beats a long run beats something next week.
  const when = whenLine(experience, day);
  if (timely.today.has(experience.id)) {
    // Today's news, and more so when it is about to be gone: a last day
    // outranks a park that will still be there next week.
    value += 6;
    if (when && /^(Last day|Today only|Ends tomorrow)$/.test(when)) value += 2;
    if (when) reasons.push(when);
  } else if (timely.now.has(experience.id)) {
    value += 1.5;
    if (when) reasons.push(when);
  } else if (timely.soon.has(experience.id)) {
    value += 1;
    if (when) reasons.push(when);
  }
  if (!experience.startTime) {
    const recurs = recurrenceLine(experience);
    if (recurs && experience.schedule?.onDate?.reading === "on") {
      value += 2;
      reasons.push(recurs);
    }
  }

  const km = distanceTo(experience, context.origin);

  switch (ask.lens) {
    case "drive": {
      // **The most to it.** Things to do, things inside it, a photograph.
      // Distance only qualifies; it never ranks — a further place is not a
      // better one.
      value += Math.min(verbs.length, 6);
      value += Math.min(experience.containsCount ?? 0, 5);
      if (experience.heroMedia?.src) value += 3;
      const inside = experience.containsCount ?? 0;
      if (verbs.length > 0 || inside > 0) {
        const list = verbs.slice(0, 3).join(", ");
        reasons.push(
          inside > 0
            ? `${list ? `${list} — and ` : ""}${inside} ${inside === 1 ? "place" : "places"} inside it`
            : verbs.length > 3
              ? `${list}, and ${verbs.length - 3} more`
              : list,
        );
      }
      break;
    }
    case "unusual": {
      // **Rare by what Atlas holds**, which is the only handle Passport has
      // on strange. One of one beats one of two; a park is one of hundreds.
      const kind = kindOf(experience);
      const count = rare.kind(experience);
      if (!UNSAID.has(kind) && count > 0 && count <= 3) {
        value += 8 - count * 2;
        reasons.push(
          count === 1
            ? `The only ${experience.subtype ?? kind} ${context.home ? `in ${context.home} ` : ""}that Atlas knows of`
            : `One of ${count} places Atlas calls a ${experience.subtype ?? kind}${context.home ? ` in ${context.home}` : ""}`,
        );
      } else if (count > 12) {
        value -= 3;
      }
      const rareVerb = verbs.find((v) => rare.verb(v) <= 2);
      if (rareVerb) {
        value += 3;
        if (reasons.length < 2)
          reasons.push(
            rare.verb(rareVerb) === 1
              ? `The only place here listing ${rareVerb.toLowerCase()}`
              : `One of two places here listing ${rareVerb.toLowerCase()}`,
          );
      }
      break;
    }
    case "kids": {
      const things = childEvidence(experience);
      value += Math.min(things.length, 3) * 2;
      if (ask.childAge !== undefined) {
        const { verdict } = ageEvidence(experience, ask.childAge);
        if (verdict === "welcome") value += 4;
        else if (verdict === "described" || verdict === "priced") value += 2;
        const line = ageLine(experience, ask.childAge);
        if (line && verdict !== "unknown") reasons.push(line);
      }
      if (things.length > 0)
        reasons.push(`${things.slice(0, 3).join(" · ")}, as listed`);
      break;
    }
    default:
      break;
  }

  // **Close is better when somebody has a few hours, a kid, or said nearby.**
  // Never for "worth the drive", and never for anything Atlas cannot place,
  // which keeps its place rather than sinking for a fact nobody knows.
  if (km !== undefined && ask.lens !== "drive") {
    const reach = ask.withinKm ?? (ask.near ? 15 : 30);
    value += 4 * (1 - Math.min(km / reach, 1));
  }

  // **The sky**, where it is wet or they asked to stay dry.
  if (context.wet || ask.shelter === "indoor") {
    if (standsUpToRain(experience)) {
      value += 3;
      const line = rainLine(experience);
      if (line) reasons.push(line);
    } else if (arguesAgainst(experience)) value -= 4;
  } else if (ask.shelter === "outdoor" && arguesAgainst(experience)) {
    value += 2;
  }

  // A distance is always worth saying, last, once there is an origin.
  const far = distanceText(experience, context.origin);
  if (far)
    reasons.push(ask.lens === "drive" ? `${far}, in a straight line` : far);

  // Nothing specific earned it a reason: say what is on offer.
  if (reasons.length === 0 || (reasons.length === 1 && far)) {
    if (verbs.length > 0) reasons.unshift(verbs.slice(0, 3).join(", "));
    else if ((experience.containsCount ?? 0) > 0)
      reasons.unshift(
        `${experience.containsCount} ${experience.containsCount === 1 ? "place" : "places"} inside it`,
      );
  }

  return { experience, score: value, reasons: reasons.slice(0, 3) };
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
 * records on one spot, two parts of one attraction. Soft costs for the things
 * that read as samey — the same kind, the same verbs.
 */
function varied(scored: readonly Scored[], limit: number): Scored[] {
  const chosen: Scored[] = [];
  const left = [...scored];
  while (chosen.length < limit && left.length > 0) {
    let best = -1;
    let bestValue = Number.NEGATIVE_INFINITY;
    left.forEach((candidate, index) => {
      const e = candidate.experience;
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
      const value = candidate.score - sameKind * 3 - overlap * 2;
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
  if (ask.lens === "time") return 4;
  return 6;
}

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
  return defaultRadiusKm(ask.hours);
}

function framing(
  ask: DiscoveryAsk,
  context: AnswerContext,
): { heading: string; note: string } {
  // "Vernon, BC" is a picker label; a heading says "Vernon".
  const from = context.originLabel?.replace(/,\s*BC$/, "");
  const area = context.home ? ` in ${context.home}` : "";
  switch (ask.lens) {
    case "drive":
      return context.origin
        ? {
            heading: "Worth the drive",
            note: `Passport can't time a drive — there's no routing here. These are ${DRIVE_FROM_KM}+ km from ${from} in a straight line, and each has the most to it: things to do, places inside it, a photograph.`,
          }
        : {
            heading: "Worth the drive",
            note: "Worth the drive from where? Until you pick a town or share your location, these are just the places with the most to them.",
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
        note: `Almost nothing here publishes how long a visit takes, so these are close by${circleFor(ask, context) !== undefined ? ` — inside ${circleFor(ask, context)} km in a straight line —` : ""} and different from each other. The hours are yours to split. Make a day of it for an order and a printable plan.`,
      };
    }
    default:
      return {
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
  let candidates = onTheDay(pool, ask.on, context.today).filter(substantial);

  if (ask.lens === "drive" && context.origin) {
    candidates = candidates.filter((e) => {
      const km = sortKm(e);
      return km >= DRIVE_FROM_KM && km <= DRIVE_TO_KM;
    });
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

  const scored = candidates
    .map((e) => score(e, ask, context, rare, timely))
    .sort((a, b) => b.score - a.score);

  const picks = varied(scored, limitFor(ask)).map(({ experience, reasons }) => {
    const caveat = caveatFor(experience, ask, context);
    return { experience, reasons, ...(caveat ? { caveat } : {}) };
  });

  const gaps: AnswerGap[] = [];
  if (ask.company === "child" && ask.childAge === undefined)
    gaps.push({
      about: "age",
      text: "How old? Pick an age above and stated age rules get checked.",
    });
  if (
    (ask.near || ask.lens === "drive" || ask.lens === "time") &&
    !context.origin
  )
    gaps.push({
      about: "origin",
      text: "From where? Pick a town or share your location above, and distances count.",
    });

  const { heading, note } = framing(ask, context);
  return {
    heading,
    // The forecast changed the order, so the answer says so.
    note: context.wet
      ? `${note} It's wet today, so somewhere under cover comes first where Atlas knows.`
      : note,
    picks,
    gaps,
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
