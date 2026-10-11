import type { Experience } from "@/domain/experience/types";
import type { DayBrief } from "./brief";
import {
  excludesAge,
  ageLine,
  needsAdult,
} from "@/domain/discovery/suitability";
import {
  arguesAgainst,
  standsUpToRain,
  rainLine,
} from "@/domain/discovery/environment";
import { ruledOutOn } from "@/domain/discovery/recurrence";
import { distanceKm } from "@/lib/environment/geo";

/**
 * **A day, built out of things that actually exist.**
 *
 * The product promise this serves is in the doctrine (§6): *Passport succeeds
 * when people engage more deeply with their lives — not when they spend more
 * time in Passport.* So the output of this function is meant to be printed
 * and carried, and the whole design question is what it is allowed to say.
 *
 * ## The line it will not cross
 *
 * Every stop is an Atlas subject with an id. Nothing is composed, blended or
 * described into existence. And of the four things a person most wants to
 * know — *is it open, how long will it take, what does it cost, how far is
 * it* — Passport can state **none** of them reliably, so it states them only
 * where Atlas does and says so plainly everywhere else:
 *
 * ```
 * open          only from `schedule.onDate` / a stated recurrence
 * cost          only from a published practical fact that names a price
 * travel        straight-line km here; minutes only from Atlas's routes,
 *               added on screen and on paper by `lib/routing/dayLegs`
 * time at stop  the PLAN's allocation of the person's own hours — never a
 *               claim about how long the place takes
 * ```
 *
 * That last one is the subtle one. "About an hour here" is a sentence about
 * *their four hours divided by four stops*, not about the park. The guide
 * says it that way.
 */
export interface DayStop {
  readonly experience: Experience;
  /** Minutes this plan sets aside. The plan's arithmetic, not a claim. */
  readonly minutes: number;
  /** Straight-line km from the previous point, where both are placed. */
  readonly km?: number;
  /** Why this one is here, in a sentence a person would say. */
  readonly because: string;
  /** A published price, in the publisher's own words. Absent is absent. */
  readonly cost?: string;
  /** What Atlas states about the day asked about, where it states anything. */
  readonly open?: string;
  /** Rules worth knowing before you leave the house. */
  readonly notes: readonly string[];
  /** Something to do there that is not looking at a phone. */
  readonly challenge?: string;
}

/**
 * What the builder says about travel, because the builder has no routes.
 * Exported so the routing lane can retire it once Atlas has routed the day
 * (`unknownsWithTravel`), rather than matching a copy of the sentence.
 */
export const DRIVE_TIMES_UNKNOWN =
  "Drive times — distances are straight-line, not road routes.";

export interface DayPlanned {
  readonly title: string;
  readonly opening: string;
  readonly stops: readonly DayStop[];
  /** What the plan could not find out, named rather than left blank. */
  readonly unknowns: readonly string[];
  readonly brief: DayBrief;
  readonly closing: string;
}

/**
 * **How wide a circle a day of this length is planned inside.**
 *
 * Dogfooded with the acceptance sentence — *four hours, a five-year-old, near
 * Vernon* — and the first day it built was an arena, then a park 65 km away,
 * then a lake 83 km past that. Every stop was real, every distance was
 * honest, and it was three hours of driving in a four-hour day. Selection was
 * picking on evidence alone and routing was tidying the result; nothing in
 * between asked whether the day fitted inside itself.
 *
 * **This is not a drive time and is not derived from one.** Passport has no
 * routing and will not invent a speed. It is a planning radius — the circle
 * the day is drawn inside — chosen so a short day stays local and a long one
 * can reach. It is stated on screen in kilometres, and anything the person
 * actually said overrules it.
 */
const defaultRadiusKm = (hours: number | undefined): number => {
  const h = hours ?? 4;
  if (h <= 2) return 15;
  if (h <= 4) return 30;
  if (h <= 6) return 60;
  return 100;
};

/** How many stops a day of this length wants. Never more than five. */
const stopCount = (
  hours: number | undefined,
  lessDriving?: boolean,
): number => {
  const h = hours ?? 4;
  const base = h <= 2 ? 2 : h <= 4 ? 3 : h <= 6 ? 4 : 5;
  return lessDriving ? Math.max(2, base - 1) : base;
};

/** A published fact that names money, in the publisher's own words. */
function statedCost(experience: Experience): string | undefined {
  for (const fact of experience.knowledge?.practical ?? []) {
    const label = fact.label?.toLowerCase() ?? "";
    const value = fact.value ?? "";
    if (
      /admission|price|cost|fee|ticket|rate|donation/.test(label) ||
      /\$\d/.test(value)
    ) {
      const text = value.trim();
      if (text) return text;
    }
  }
  return undefined;
}

/** Whether anything published says it is free. Never inferred from silence. */
const statedFree = (experience: Experience): boolean => {
  const cost = statedCost(experience)?.toLowerCase() ?? "";
  return /\bfree\b|no charge|no admission/.test(cost);
};

/** The verbs Atlas states, lowercased, for matching against what was asked. */
const verbsOf = (experience: Experience): readonly string[] =>
  (experience.knowledge?.affordances ?? [])
    .map((a) => a.name?.trim().toLowerCase())
    .filter((n): n is string => Boolean(n));

const point = (experience: Experience) => {
  const c = experience.geography?.coordinates;
  return c ? { latitude: c[1], longitude: c[0] } : undefined;
};

/**
 * **A score, and what it is allowed to be made of.**
 *
 * Only things Atlas states. No popularity, no editorial weighting, no
 * recency, and nothing derived from what other people did — none of which
 * exists here, and all of which would be invention wearing a number.
 */
function fitness(
  experience: Experience,
  brief: DayBrief,
  origin?: { latitude: number; longitude: number },
  radiusKm?: number,
): number {
  let score = 0;

  // **A day should fit inside itself.** Closer is better, within the circle
  // the day is drawn in — enough to break ties and to stop a four-hour
  // afternoon reaching for something eighty kilometres away, never enough to
  // bury a place somebody asked for by name.
  const here = point(experience);
  if (origin && here && radiusKm) {
    score += 6 * (1 - Math.min(distanceKm(origin, here) / radiusKm, 1));
  }
  const verbs = verbsOf(experience);

  for (const interest of brief.interests) {
    if (verbs.some((v) => v.includes(interest))) score += 6;
    else if (experience.title.toLowerCase().includes(interest)) score += 4;
    else if ((experience.subtype ?? "").toLowerCase().includes(interest))
      score += 3;
  }

  // Somewhere that says what you can do there beats somewhere that does not.
  score += Math.min(verbs.length, 4);
  // A photograph is how somebody decides they want to go.
  if (experience.heroMedia?.src) score += 2;

  if (brief.shelter === "indoor") {
    if (standsUpToRain(experience)) score += 5;
    if (arguesAgainst(experience)) score -= 6;
  }
  if (brief.shelter === "outdoor" && arguesAgainst(experience)) score += 3;

  if (brief.childAge !== undefined) {
    const line = ageLine(experience, brief.childAge);
    if (line?.startsWith("Admits")) score += 5;
    else if (line?.startsWith("Described")) score += 2;
  }

  // **"Make it weirder" is a preference for the less-described, never for the
  // invented.** A subject with an unusual subtype and few stated verbs is the
  // odd one; Passport has no other handle on strangeness and will not pretend.
  if (brief.appetite === "odd") score += verbs.length <= 1 ? 3 : -1;
  if (brief.appetite === "adventurous") {
    if (
      verbs.some((v) =>
        /hik|climb|paddl|kayak|canoe|bike|cycl|trail|snowshoe/.test(v),
      )
    )
      score += 5;
  }
  if (brief.appetite === "gentle") {
    if (verbs.some((v) => /picnic|walk|garden|beach|playground/.test(v)))
      score += 4;
  }

  if (
    brief.budget !== undefined &&
    brief.budget <= 20 &&
    statedFree(experience)
  ) {
    score += 4;
  }
  return score;
}

/** One sentence saying why this stop is in the day. Facts only. */
function reasonFor(experience: Experience, brief: DayBrief): string {
  const verbs = verbsOf(experience);
  const hit = brief.interests.find((i) => verbs.some((v) => v.includes(i)));
  if (hit) return `You asked for ${hit}, and this says it has it.`;
  if (brief.shelter === "indoor" && standsUpToRain(experience)) {
    return rainLine(experience) ?? "Somewhere to be when it is wet.";
  }
  if (brief.childAge !== undefined) {
    const line = ageLine(experience, brief.childAge);
    if (line?.startsWith("Admits"))
      return `Says a ${brief.childAge}-year-old is welcome.`;
  }
  if (verbs.length > 0) {
    return `What is on offer: ${verbs.slice(0, 3).join(", ")}.`;
  }
  return "Close to the rest of the day.";
}

/**
 * Something to do there with the phone in a pocket.
 *
 * Built from what Atlas states this place has, so it is never a generic
 * prompt bolted onto an unsuitable stop. No stated feature, no challenge.
 */
function challengeFor(experience: Experience, nth: number): string | undefined {
  const verbs = verbsOf(experience);
  const features = (experience.knowledge?.features ?? []).map((f) =>
    f.toLowerCase(),
  );
  const has = (pattern: RegExp) =>
    verbs.some((v) => pattern.test(v)) || features.some((f) => pattern.test(f));

  // **Several per category, rotated by position.** The first version had one
  // line each, and a day of three parks printed the same sentence three
  // times — which reads as a template rather than as an invitation.
  const pools: readonly (readonly [RegExp, readonly string[]])[] = [
    [
      /bird/,
      [
        "Count how many different birds you hear before anybody speaks.",
        "Whoever spots the first bird of prey picks the music home.",
      ],
    ],
    [
      /swim|beach|paddl|kayak|canoe|waterski/,
      [
        "Skip a stone. Best of three.",
        "Find the smoothest rock on the shore and take it home.",
        "Put one hand in the water and say what it reminds you of.",
      ],
    ],
    [
      /playground|tot lot/,
      [
        "Whoever goes down the slide last buys the next snack.",
        "Invent a new rule for the climbing frame. Everyone has to follow it.",
        "Hang upside down and describe what you can see.",
      ],
    ],
    [
      /hik|trail|walk|cycl|bike/,
      [
        "Find the oldest tree you can and guess its age out loud.",
        "Walk fifty paces without talking, then say the first thing you noticed.",
        "Collect one thing each. Compare at the car.",
      ],
    ],
    [
      /picnic/,
      [
        "Eat something you did not bring. Trade with somebody.",
        "Lie on your back for one full minute and find a shape in the clouds.",
      ],
    ],
    [
      /skat|hockey|ringette|arena|rink/,
      [
        "One lap without holding on. Nobody has to be good at it.",
        "Pick somebody on the ice and decide their entire life story.",
      ],
    ],
    [
      /exhibit|museum|art|gallery|history/,
      [
        "Pick the one thing you would steal. Explain yourself.",
        "Find something older than everyone here put together.",
      ],
    ],
    [
      /market|farm|pumpkin|orchard/,
      [
        "Buy the strangest thing under five dollars and eat it in the car.",
        "Ask somebody who works there what their favourite thing is.",
      ],
    ],
  ];

  for (const [pattern, lines] of pools) {
    if (has(pattern)) return lines[nth % lines.length];
  }
  return undefined;
}

export interface BuildInput {
  readonly pool: readonly Experience[];
  readonly brief: DayBrief;
  /** Ids to keep out — a stop somebody asked to replace. */
  readonly without?: readonly string[];
}

/**
 * Build the day.
 *
 * Narrowing first, and only on stated evidence: a rule that shuts the child
 * out, a stated schedule that excludes the day, a measured distance past what
 * they said. Silence removes nothing, here as everywhere else in Passport.
 */
export function buildDay({
  pool,
  brief,
  without = [],
}: BuildInput): DayPlanned {
  const excluded = new Set(without);
  const origin = brief.town
    ? { latitude: brief.town.latitude, longitude: brief.town.longitude }
    : undefined;
  // What they said, or the circle a day this long is drawn inside.
  const radiusKm =
    brief.withinKm ?? (origin ? defaultRadiusKm(brief.hours) : undefined);

  const eligible = pool.filter((experience) => {
    if (excluded.has(experience.id)) return false;
    if (brief.childAge !== undefined && excludesAge(experience, brief.childAge))
      return false;
    if (brief.on && ruledOutOn(experience, brief.on)) return false;
    if (brief.on && experience.schedule?.onDate?.reading === "not-on")
      return false;
    if (radiusKm !== undefined && origin) {
      const here = point(experience);
      // Unmeasured is not excluded — but it cannot lead a day either, so it
      // sorts below everything that was measured (see `ranked`).
      if (here && distanceKm(origin, here) > radiusKm) return false;
    }
    return true;
  });

  const ranked = [...eligible].sort((a, b) => {
    const measured = (e: Experience) => (point(e) ? 1 : 0);
    const byMeasured = measured(b) - measured(a);
    if (byMeasured !== 0) return byMeasured;
    return (
      fitness(b, brief, origin, radiusKm) - fitness(a, brief, origin, radiusKm)
    );
  });

  const wanted = stopCount(brief.hours, brief.lessDriving);

  /**
   * **Variety is a preference, and it was built as a wall.**
   *
   * The first version refused a third subject of the same subtype outright.
   * In this corpus most things are parks, so an eight-hour day asking for
   * five stops came back with **two** — a true answer, an empty afternoon,
   * and the strictness was doing the damage rather than the data.
   *
   * So it relaxes in order: prefer a new verb and a new kind; then settle for
   * a new kind; then take the best of what is left. A day of three parks that
   * are genuinely different places beats a day of one.
   */
  const chosen: Experience[] = [];
  const seenVerbs = new Set<string>();
  const kindCount = new Map<string, number>();

  const take = (candidate: Experience) => {
    chosen.push(candidate);
    for (const verb of verbsOf(candidate)) seenVerbs.add(verb);
    const kind = candidate.subtype ?? candidate.kind;
    kindCount.set(kind, (kindCount.get(kind) ?? 0) + 1);
  };
  const sameKindAtCap = (candidate: Experience, cap: number) =>
    (kindCount.get(candidate.subtype ?? candidate.kind) ?? 0) >= cap;

  for (const candidate of ranked) {
    if (chosen.length >= wanted) break;
    const verbs = verbsOf(candidate);
    const freshVerb =
      verbs.length === 0 || verbs.some((v) => !seenVerbs.has(v));
    if (freshVerb && !sameKindAtCap(candidate, 2)) take(candidate);
  }
  for (const candidate of ranked) {
    if (chosen.length >= wanted) break;
    if (!chosen.includes(candidate) && !sameKindAtCap(candidate, 2)) {
      take(candidate);
    }
  }
  for (const candidate of ranked) {
    if (chosen.length >= wanted) break;
    if (!chosen.includes(candidate)) take(candidate);
  }

  // Nearest-first from where they start, so the day is a route rather than a
  // list. Straight-line only; this is not a routing engine and does not claim
  // to be one.
  const ordered: Experience[] = [];
  let from = origin;
  const remaining = [...chosen];
  while (remaining.length > 0) {
    let bestIndex = 0;
    let best = Infinity;
    remaining.forEach((candidate, index) => {
      const here = point(candidate);
      const d = from && here ? distanceKm(from, here) : Infinity;
      if (d < best) {
        best = d;
        bestIndex = index;
      }
    });
    const next = remaining.splice(bestIndex, 1)[0]!;
    ordered.push(next);
    from = point(next) ?? from;
  }

  const minutesEach = Math.max(
    30,
    Math.round(((brief.hours ?? 4) * 60) / Math.max(ordered.length, 1) / 15) *
      15,
  );

  let previous = origin;
  const stops: DayStop[] = ordered.map((experience, nth) => {
    const here = point(experience);
    const km = previous && here ? distanceKm(previous, here) : undefined;
    previous = here ?? previous;
    const notes: string[] = [];
    for (const condition of experience.knowledge?.conditions ?? []) {
      const text = condition.trim();
      if (text) notes.push(text);
    }
    const adult = needsAdult(experience, brief.childAge);
    if (adult && !notes.includes(adult)) notes.push(adult);
    const schedule = experience.schedule?.onDate;
    const challenge = challengeFor(experience, nth);
    const cost = statedCost(experience);
    return {
      experience,
      minutes: minutesEach,
      ...(km !== undefined ? { km: Math.round(km * 10) / 10 } : {}),
      because: reasonFor(experience, brief),
      ...(cost ? { cost } : {}),
      ...(schedule && schedule.reading === "on"
        ? { open: `Published as open on ${schedule.date}.` }
        : {}),
      notes,
      ...(challenge ? { challenge } : {}),
    };
  });

  const unknowns: string[] = [];
  if (stops.some((s) => !s.open))
    unknowns.push("Opening hours — most places here have not published them.");
  if (stops.some((s) => !s.cost))
    unknowns.push("Prices — only published where a place has said.");
  unknowns.push(DRIVE_TIMES_UNKNOWN);

  return {
    title: titleFor(stops, brief),
    opening: openingFor(stops, brief, radiusKm),
    stops,
    unknowns,
    brief,
    closing:
      "Put this in your pocket and your phone in the glovebox. Come back and tell us what actually happened.",
  };
}

/** A name for the day, made of the places in it. Never a generic headline. */
function titleFor(stops: readonly DayStop[], brief: DayBrief): string {
  if (stops.length === 0) return "A day we could not fill";
  const first = stops[0]!.experience.title;
  const last = stops[stops.length - 1]!.experience.title;
  if (stops.length === 1) return first;
  const where = brief.town?.name.replace(/,\s*BC$/, "");
  return where ? `${first} to ${last}, out of ${where}` : `${first} to ${last}`;
}

function openingFor(
  stops: readonly DayStop[],
  brief: DayBrief,
  radiusKm?: number,
): string {
  if (stops.length === 0) {
    return "Nothing here matched that. Try fewer constraints, or a wider circle.";
  }
  const hours = brief.hours ? `${brief.hours} hours` : "a day";
  const who =
    brief.childAge !== undefined ? ` with a ${brief.childAge}-year-old` : "";
  const count = stops.length === 1 ? "one stop" : `${stops.length} stops`;
  // The circle is stated, because it is a choice the plan made on somebody's
  // behalf and they may well want a different one.
  const circle =
    radiusKm !== undefined && brief.town
      ? ` inside ${radiusKm} km of ${brief.town.name.replace(/,\s*BC$/, "")}`
      : "";
  return `${hours}${who}, ${count}${circle}, and a plan loose enough to abandon.`;
}
