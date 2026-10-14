import type { Experience } from "@/domain/experience/types";
import type { DayWeather } from "@/domain/discovery/situation";
import {
  clockLabel,
  partyPhrase,
  stem,
  travelPhrase,
  type DayBrief,
  type Party,
} from "./brief";
import {
  excludesAge,
  ageLine,
  needsAdult,
} from "@/domain/discovery/suitability";
import {
  arguesAgainst,
  mayNotRun,
  standsUpToRain,
  rainLine,
} from "@/domain/discovery/environment";
import { ruledOutOn } from "@/domain/discovery/recurrence";
import { PART_OF_DAY_END } from "./intent";

/**
 * **Indoors, as Atlas says it.** A stated indoor setting, a sheltered rain
 * reading, or `exposure: indoor` (`candidate-environment/2`, the reading
 * Discovery's answers already use).
 *
 * "Keep us indoors" used to be answered by `standsUpToRain`, which also counts
 * *partly sheltered* and *runs in the rain*. On the real corpus that made a
 * two-hour indoor day for a five-year-old out of Polson Park (a picnic
 * shelter) and Rutland Lions Park (open-air forest), and the day then said
 * "every stop here is one Atlas says stands up to rain", while the Okanagan
 * Science Centre and the Vernon Public Art Gallery, both `exposure: indoor`,
 * were in range.
 */
const indoors = (e: Experience): boolean =>
  // The rain reading wins over `exposure` (see `CandidateEnvironment`): a
  // place Atlas says is out in the open is not indoors, whatever its kind.
  !arguesAgainst(e) &&
  (e.environment?.setting === "indoor" ||
    e.environment?.rain?.reading === "sheltered" ||
    e.environment?.exposure?.value === "indoor");

/** Whether Atlas says a visit is spent outside, and nothing says indoors. */
const outdoorsByAtlas = (e: Experience): boolean =>
  !indoors(e) &&
  (arguesAgainst(e) ||
    e.environment?.setting === "outdoor" ||
    e.environment?.exposure?.value === "outdoor" ||
    e.environment?.exposure?.value === "sheltered-outdoor");
import { distanceKm } from "@/lib/environment/geo";
import { activitiesIn, offers, unmetIn, type Unmet } from "./intent";

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
 * open          only from `schedule.onDate` / a stated recurrence, or a
 *               published "hours" fact quoted in the publisher's words
 * cost          only from a published practical fact that names a price
 * travel        straight-line km here; minutes only from Atlas's routes,
 *               added on screen and on paper by `lib/routing/dayLegs`
 * time at stop  the PLAN's allocation of the person's own hours — never a
 *               claim about how long the place takes
 * moving        a flat buffer the plan sets aside per move, stated as a
 *               buffer — never a drive time
 * ```
 *
 * That last pair is the subtle one. "About an hour here" is a sentence about
 * *their four hours divided by four stops*, not about the park, and "15 min
 * to move" is the plan keeping some of their day back for getting between
 * places, not a claim about the road. The screen and the paper say both that
 * way.
 *
 * ## What the person decides
 *
 * The builder proposes; the person disposes (§2.5). A stop they **kept**
 * survives every revision, an **order** they set is the order, and a stop they
 * gave **more time** keeps it while the rest share what is left. Nothing they
 * chose is re-chosen for them.
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
  /** Published hours, in the publisher's own words. Never parsed or checked. */
  readonly hours?: string;
  /** Rules worth knowing before you leave the house. */
  readonly notes: readonly string[];
  /** Something to do there that is not looking at a phone. */
  readonly challenge?: string;
  /**
   * **Passport's suggestion about who this suits.** Ranking, labelled as
   * ranking: built from the verbs Atlas states, never a claim the place made.
   */
  readonly fit?: string;
  /** The person kept this one, so revisions leave it alone. */
  readonly kept?: boolean;
  /** The person set this stop's time themselves. */
  readonly timeSet?: boolean;
  /** What Atlas says the rain does here — only where it says anything. */
  readonly rain?: "stands" | "exposed" | "may-not-run";
  /** Somewhere under cover near this stop, if the weather turns. */
  readonly rainPlan?: RainPlan;
  /** A move long enough that a flat buffer will not cover it. */
  readonly longMove?: boolean;
}

/**
 * **The rain plan for one stop.** A real subject Atlas says stands up to rain
 * — sheltered, partly sheltered, or running anyway — and the straight-line km
 * from the stop it would replace. Never a guess that somewhere is "probably
 * indoors".
 */
export interface RainPlan {
  readonly experience: Experience;
  readonly km?: number;
  readonly because: string;
}

/** The person's hours, and where the plan put them. */
export interface DayBudget {
  readonly totalMinutes: number;
  /** Set aside across the stops. */
  readonly stopMinutes: number;
  /** Set aside for getting between them — a buffer, never a drive time. */
  readonly moveMinutes: number;
  readonly moves: number;
  readonly perMove: number;
  /** How far past their hours the plan runs, where it does. */
  readonly overBy: number;
  /** Nobody said how long, so four hours was assumed — and said. */
  readonly hoursAssumed: boolean;
}

/** What is published about money, and nothing that is not. */
export interface DayMoney {
  readonly budget?: number;
  /** Stops whose published price says free. */
  readonly free: readonly string[];
  /** Stops with a published price, in the publisher's words. Never summed. */
  readonly priced: readonly { readonly title: string; readonly cost: string }[];
  /** Stops that publish nothing about money. */
  readonly unpublished: number;
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
  /**
   * **Places the person chose that the day could not keep, and why** — a
   * place that states it is not on that day, or does not admit that age.
   * Also in `unknowns` (the paper prints them); here so the screen can say it
   * first rather than last.
   */
  readonly leftOut?: readonly string[];
  readonly brief: DayBrief;
  readonly closing: string;
  readonly budget?: DayBudget;
  readonly money?: DayMoney;
  /** Straight-line km from the last stop back to the start, where placed. */
  readonly homeKm?: number;
  /** The forecast this day was built against, with its source. */
  readonly weather?: PlanWeather;
  /**
   * The circle the day was drawn inside, in km — what they said, or the
   * plan's own choice for a day this long (`radiusAssumed`).
   */
  readonly radiusKm?: number;
  readonly radiusAssumed?: boolean;
  /**
   * **What they asked for that nothing Atlas holds offers**, within the
   * circle they asked for. When this is not empty the day contains only what
   * the person kept: the plan will not stand a different kind of day in for
   * the one they described. Said first on screen, with the nearest place that
   * does offer it where one is known.
   */
  readonly unmet?: readonly Unmet[];
}

/** A forecast, with whose forecast it is. */
export interface PlanWeather extends DayWeather {
  /** The city Environment Canada publishes this for. */
  readonly area?: string;
}

/**
 * **What the plan keeps back for each move.**
 *
 * A flat fifteen minutes, said out loud as a buffer. It is not derived from
 * distance and it is not a drive time — Passport has no road routes and will
 * not invent a speed. Without it a four-hour day of four stops was four
 * back-to-back hours with no time to get anywhere, which no real day is.
 */
export const MOVE_MINUTES = 15;

/** Past this many straight-line km, a flat buffer is plainly not enough. */
export const LONG_MOVE_KM = 20;

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
export const defaultRadiusKm = (hours: number | undefined): number => {
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

/** The most stops a person can ask for. Past this a day is a checklist. */
export const MAX_STOPS = 6;

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

/** A published fact about opening hours, quoted. Never parsed into a claim. */
function statedHours(experience: Experience): string | undefined {
  for (const fact of experience.knowledge?.practical ?? []) {
    const label = fact.label?.toLowerCase() ?? "";
    if (/\bhours\b|opening|open\b/.test(label)) {
      const text = fact.value?.trim();
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

/**
 * **The cheapest dollar figure a published price names.** Used only to ask
 * one question: does even the lowest published price exceed the person's whole
 * budget? "$12 for adults, $8 for children" is 8. No figure, no answer.
 */
const lowestStatedDollars = (experience: Experience): number | undefined => {
  const cost = statedCost(experience);
  if (!cost) return undefined;
  const figures = [...cost.matchAll(/\$\s*(\d+(?:\.\d+)?)/g)].map((m) =>
    Number(m[1]),
  );
  return figures.length > 0 ? Math.min(...figures) : undefined;
};

/** The verbs Atlas states, lowercased, for matching against what was asked. */
const verbsOf = (experience: Experience): readonly string[] =>
  (experience.knowledge?.affordances ?? [])
    .map((a) => a.name?.trim().toLowerCase())
    .filter((n): n is string => Boolean(n));

/** Everything Atlas says a place is or has, as one list of words to match. */
const statedWords = (experience: Experience): readonly string[] => [
  ...verbsOf(experience),
  ...(experience.knowledge?.features ?? []).map((f) => f.toLowerCase()),
  (experience.subtype ?? "").toLowerCase(),
  experience.title.toLowerCase(),
];

const point = (experience: Experience) => {
  const c = experience.geography?.coordinates;
  return c ? { latitude: c[1], longitude: c[0] } : undefined;
};

/**
 * **Who a stated verb tends to suit.** This is Passport's taste, and it is
 * labelled as such on screen — a suggestion built from what a place says it
 * has, never a claim that the place is "for couples". Atlas says nothing about
 * couples, solo travellers or groups of friends, and nothing here pretends it
 * does.
 */
const PARTY_LEANS: Readonly<Record<Party, RegExp>> = {
  family:
    /playground|picnic|splash|spray|beach|swim|farm|petting|zoo|science|tot lot|interactive|mini golf|pumpkin/,
  couple:
    /winery|wine|garden|viewpoint|lookout|gallery|beach|cafe|coffee|restaurant|sunset|spa|art/,
  friends:
    /brewery|pub|climb|kayak|paddl|bowling|golf|games|market|beach|bike|cycl|axe|escape/,
  solo: /trail|hik|walk|museum|gallery|librar|book|cafe|coffee|garden|viewpoint|bird/,
};

const leanFor = (experience: Experience, party: Party): string | undefined => {
  const pattern = PARTY_LEANS[party];
  return statedWords(experience).find((w) => w && pattern.test(w));
};

/**
 * **A score, and what it is allowed to be made of.**
 *
 * Only things Atlas states, the forecast, and what the person said. No
 * popularity, no editorial weighting, no recency, and nothing derived from
 * what other people did — none of which exists here, and all of which would
 * be invention wearing a number.
 */
function fitness(
  experience: Experience,
  brief: DayBrief,
  origin?: { latitude: number; longitude: number },
  radiusKm?: number,
  weather?: PlanWeather,
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
    if (indoors(experience)) score += 6;
    else if (standsUpToRain(experience)) score += 2;
  }
  if (brief.shelter === "outdoor" && arguesAgainst(experience)) score += 3;

  // **The forecast reorders; it never removes.** The same soft rule
  // Discovery applies: a place Atlas reads as out in the open sinks when rain
  // is forecast, somewhere under cover rises, and the 95% Atlas says nothing
  // about stay exactly where they were.
  if (weather?.wet && brief.shelter !== "outdoor") {
    if (arguesAgainst(experience)) score -= 6;
    if (mayNotRun(experience)) score -= 3;
    if (standsUpToRain(experience)) score += 3;
  }

  if (brief.childAge !== undefined) {
    const line = ageLine(experience, brief.childAge);
    if (line?.startsWith("Admits")) score += 5;
    else if (line?.startsWith("Described")) score += 2;
  }

  if (brief.party && leanFor(experience, brief.party)) score += 4;

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
function reasonFor(
  experience: Experience,
  brief: DayBrief,
  weather?: PlanWeather,
): string {
  const verbs = verbsOf(experience);
  const hit = brief.interests.find((i) => verbs.some((v) => v.includes(i)));
  if (hit) return `You asked for ${hit}, and this says it has it.`;
  if (brief.shelter === "indoor" && indoors(experience)) {
    return (
      (experience.environment?.rain?.reading === "sheltered"
        ? rainLine(experience)
        : undefined) ?? "Indoors, going by what Atlas holds."
    );
  }
  if (weather?.wet && standsUpToRain(experience)) {
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

/** Passport's suggestion about the party, said as a suggestion. */
function fitFor(experience: Experience, brief: DayBrief): string | undefined {
  if (!brief.party) return undefined;
  const lean = leanFor(experience, brief.party);
  if (!lean) return undefined;
  const who = {
    family: "A family pick",
    couple: "A pick for two",
    friends: "A pick for a group",
    solo: "A pick for going solo",
  }[brief.party];
  return `${who} — it lists ${lean}.`;
}

/**
 * Something to do there with the phone in a pocket.
 *
 * Built from what Atlas states this place has, so it is never a generic
 * prompt bolted onto an unsuitable stop. No stated feature, no challenge.
 *
 * **The same place asks different things of different people.** Two people
 * on a date at a beach and a five-year-old at the same beach want different
 * invitations, so the line is chosen for the party when one was said and the
 * place has something to hang it on.
 */
function challengeFor(
  experience: Experience,
  nth: number,
  party?: Party,
  used: ReadonlySet<string> = new Set(),
): string | undefined {
  const verbs = verbsOf(experience);
  const features = (experience.knowledge?.features ?? []).map((f) =>
    f.toLowerCase(),
  );
  const has = (pattern: RegExp) =>
    verbs.some((v) => pattern.test(v)) || features.some((f) => pattern.test(f));

  type Pool = readonly [RegExp, readonly string[]];
  const BY_PARTY: Readonly<Record<Party, readonly Pool[]>> = {
    family: [],
    couple: [
      [
        /swim|beach|paddl|kayak|canoe|lake/,
        [
          "Find the best spot on the shore. Sit there until one of you says something true.",
          "Each pick a stone. Whoever skips further chooses dinner.",
        ],
      ],
      [
        /hik|trail|walk|viewpoint|lookout/,
        [
          "Stop at the best view and each describe it without using the word 'beautiful'.",
          "Walk ten minutes without talking. Then say the one thing you noticed.",
        ],
      ],
      [
        /garden|picnic/,
        ["Pick the one plant you'd take home. Defend your choice."],
      ],
      [
        /exhibit|museum|art|gallery|history/,
        [
          "Split up. Meet in fifteen minutes with the one thing the other person has to see.",
        ],
      ],
      [/wine|winery|brew|cafe|coffee/, ["Order for each other. No vetoes."]],
    ],
    friends: [
      [
        /swim|beach|paddl|kayak|canoe|lake/,
        [
          "Stone-skipping tournament. Last place carries everybody's stuff back to the car.",
          "Everyone finds one perfect flat rock. Best rock wins. Arguments are encouraged.",
        ],
      ],
      [
        /hik|trail|walk|cycl|bike/,
        [
          "First person to spot wildlife picks the music on the way home.",
          "Whoever's at the back at the top tells the group an embarrassing story.",
        ],
      ],
      [
        /exhibit|museum|art|gallery|history/,
        [
          "Everyone picks the one thing they'd steal. Group votes on the best heist.",
        ],
      ],
      [
        /market|farm|brew|pub|cafe/,
        [
          "Everyone buys one thing under five dollars for somebody else. Open them together.",
        ],
      ],
    ],
    solo: [
      [
        /hik|trail|walk|viewpoint|lookout|garden/,
        [
          "Find somewhere to sit. Ten minutes. Write down three things you can hear.",
          "Take the turn you'd normally skip.",
        ],
      ],
      [
        /swim|beach|lake|paddl/,
        [
          "Put your feet in the water and stay until you stop thinking about your phone.",
        ],
      ],
      [
        /exhibit|museum|art|gallery|history|book|librar/,
        [
          "Find one thing nobody else is looking at. Stay with it for five minutes.",
        ],
      ],
      [
        /market|cafe|coffee/,
        [
          "Ask somebody who works here what you shouldn't leave without trying.",
        ],
      ],
    ],
  };

  // **Several per category, rotated by position.** The first version had one
  // line each, and a day of three parks printed the same sentence three
  // times — which reads as a template rather than as an invitation.
  const pools: readonly Pool[] = [
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

  // Rotated by position, and never the same line twice in one day while
  // the pool has another.
  const pick = (lines: readonly string[]) => {
    for (let k = 0; k < lines.length; k++) {
      const line = lines[(nth + k) % lines.length]!;
      if (!used.has(line)) return line;
    }
    return lines[nth % lines.length];
  };
  for (const [pattern, lines] of party ? BY_PARTY[party] : []) {
    if (has(pattern)) return pick(lines);
  }
  for (const [pattern, lines] of pools) {
    if (has(pattern)) return pick(lines);
  }
  return undefined;
}

export interface BuildInput {
  readonly pool: readonly Experience[];
  readonly brief: DayBrief;
  /** Ids to keep out — a stop somebody asked to replace or removed. */
  readonly without?: readonly string[];
  /**
   * **Ids the person chose**: kept on `/go`, or picked in Discovery
   * (`/go?with=`). One meaning for both.
   *
   * Taken first and past every soft filter — the planning circle, interests,
   * the weather, the budget — because the person picked it, so it is not this
   * plan's to second-guess. The hard rules still apply: a stated rule against
   * the child's age, or a stated schedule that leaves the day out, drops it,
   * and the plan **says so** rather than quietly building a day without it.
   * `without` wins over `keep`, so "swap the first one" works on a chosen stop
   * too.
   */
  readonly keep?: readonly string[];
  /**
   * Of `keep`, the ids picked in Discovery — only so the stop can say where
   * it came from. Changes nothing else.
   */
  readonly picked?: readonly string[];
  /**
   * The order the person set. Ids in it come first, in this order; anything
   * new is routed nearest-first after them.
   */
  readonly order?: readonly string[];
  /** Minutes the person set for a stop, by id. The rest share what is left. */
  readonly minutes?: Readonly<Record<string, number>>;
  /** How many stops the person asked for, overriding the day's length. */
  readonly count?: number;
  /** Today's forecast where the day is, when the day is today. */
  readonly weather?: PlanWeather;
  /**
   * Rain plans already chosen, by stop id — so the paper carries the same
   * alternatives the screen showed, rather than re-choosing them.
   */
  readonly rainPlans?: Readonly<Record<string, string>>;
  /**
   * **Everything the day was chosen from**, when `pool` is only a replay of
   * the stops already chosen (the paper, Go Offline). What is *missing* is
   * judged against this, not against the stops on the page — otherwise a
   * one-stop paper says Atlas has nothing for every interest that stop does
   * not cover. Choosing still draws only from `pool`.
   */
  readonly catalogue?: readonly Experience[];
}

interface Ranking {
  readonly ranked: readonly Experience[];
  readonly origin?: { latitude: number; longitude: number };
  readonly radiusKm?: number;
}

/**
 * Narrowing first, and only on stated evidence: a rule that shuts the child
 * out, a stated schedule that excludes the day, a measured distance past what
 * they said, a published price past their whole budget, a thing they said no
 * to. Silence removes nothing, here as everywhere else in Passport.
 */
function rank(
  pool: readonly Experience[],
  brief: DayBrief,
  without: readonly string[],
  weather?: PlanWeather,
): Ranking {
  const excluded = new Set(without);
  const origin = brief.town
    ? { latitude: brief.town.latitude, longitude: brief.town.longitude }
    : undefined;
  // What they said, or the circle a day this long is drawn inside.
  const radiusKm =
    brief.withinKm ?? (origin ? defaultRadiusKm(brief.hours) : undefined);
  const avoided = (brief.avoid ?? []).map(stem);
  const avoidedLabels = (brief.avoid ?? []).flatMap((a) => activitiesIn(a));

  const eligible = pool.filter((experience) => {
    if (excluded.has(experience.id)) return false;
    if (brief.childAge !== undefined && excludesAge(experience, brief.childAge))
      return false;
    if (brief.on && ruledOutOn(experience, brief.on)) return false;
    if (brief.on && experience.schedule?.onDate?.reading === "not-on")
      return false;
    // **"Keep us indoors" is a request, not a mood.** A place Atlas says is
    // spent outside (`outdoorsByAtlas`) is left out; one that states nothing
    // stays, and the plan says how many of its stops it can vouch for.
    if (brief.shelter === "indoor" && outdoorsByAtlas(experience)) return false;
    if (radiusKm !== undefined && origin) {
      const here = point(experience);
      // Unmeasured is not excluded — but it cannot lead a day either, so it
      // sorts below everything that was measured (see `ranked`).
      if (here && distanceKm(origin, here) > radiusKm) return false;
    }
    if (avoided.length > 0) {
      const words = statedWords(experience);
      if (avoided.some((a) => words.some((w) => w.includes(a)))) return false;
      // "no wineries", "no concerts": the word they typed may not be a
      // substring of anything Atlas says, but it names an activity.
      if (avoidedLabels.some((label) => offers(experience, label)))
        return false;
    }
    if (brief.budget !== undefined) {
      const lowest = lowestStatedDollars(experience);
      if (lowest !== undefined && lowest > brief.budget) return false;
    }
    return true;
  });

  const ranked = [...eligible].sort((a, b) => {
    const measured = (e: Experience) => (point(e) ? 1 : 0);
    const byMeasured = measured(b) - measured(a);
    if (byMeasured !== 0) return byMeasured;
    return (
      fitness(b, brief, origin, radiusKm, weather) -
      fitness(a, brief, origin, radiusKm, weather)
    );
  });
  return {
    ranked,
    ...(origin ? { origin } : {}),
    ...(radiusKm !== undefined ? { radiusKm } : {}),
  };
}

/** Nearest-first from a starting point. Straight-line; not a routing engine. */
function route(
  stops: readonly Experience[],
  from?: { latitude: number; longitude: number },
): Experience[] {
  const ordered: Experience[] = [];
  const remaining = [...stops];
  let at = from;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let best = Infinity;
    remaining.forEach((candidate, index) => {
      const here = point(candidate);
      const d = at && here ? distanceKm(at, here) : Infinity;
      if (d < best) {
        best = d;
        bestIndex = index;
      }
    });
    const next = remaining.splice(bestIndex, 1)[0]!;
    ordered.push(next);
    at = point(next) ?? at;
  }
  return ordered;
}

const roundKm = (km: number) => Math.round(km * 10) / 10;

/**
 * **What the person chose, after the hard rules.** Stated rules only — an age
 * the place says it doesn't admit, a schedule that leaves the day out — and
 * each one that drops a chosen stop is said, never silent.
 */
function keptStops(
  pool: readonly Experience[],
  brief: DayBrief,
  without: readonly string[],
  keep: readonly string[],
): { kept: Experience[]; keptOut: string[] } {
  const excluded = new Set(without);
  const kept: Experience[] = [];
  const keptOut: string[] = [];
  for (const id of keep) {
    if (excluded.has(id)) continue;
    const experience = pool.find((e) => e.id === id);
    if (!experience) {
      keptOut.push("One place you picked is no longer offered here.");
      continue;
    }
    if (brief.childAge !== undefined && excludesAge(experience, brief.childAge))
      keptOut.push(
        `${experience.title} is left out — it states it doesn't admit a ${brief.childAge}-year-old.`,
      );
    else if (
      brief.on &&
      (ruledOutOn(experience, brief.on) ||
        experience.schedule?.onDate?.reading === "not-on")
    )
      keptOut.push(
        `${experience.title} is left out — what is published says it isn't on that day.`,
      );
    else if (!kept.includes(experience) && kept.length < MAX_STOPS)
      kept.push(experience);
  }
  return { kept, keptOut };
}

/**
 * Build the day.
 */
export function buildDay({
  pool,
  brief,
  without = [],
  keep = [],
  picked = [],
  order,
  minutes: setMinutes = {},
  count,
  weather,
  rainPlans,
  catalogue,
}: BuildInput): DayPlanned {
  const { ranked, origin, radiusKm } = rank(pool, brief, without, weather);
  const byId = new Map(pool.map((e) => [e.id, e]));
  const { kept: keptExperiences, keptOut } = keptStops(
    pool,
    brief,
    without,
    keep,
  );

  const wanted = Math.min(
    MAX_STOPS,
    Math.max(
      1,
      count ?? stopCount(brief.hours, brief.lessDriving),
      keptExperiences.length,
    ),
  );

  // **Does anything offer what they asked for?** If not, the plan says so and
  // builds nothing around it — a different kind of day is not the one they
  // described. What they kept stays.
  // A subject with no coordinates cannot be placed inside anybody's circle,
  // so on its own it cannot make "near here" true — unless Atlas says it is
  // in the very town the day starts from, which is a stated fact, not a guess.
  const startsIn = brief.town?.name.replace(/,\s*BC$/i, "").toLowerCase();
  const inStartTown = (e: Experience) =>
    startsIn !== undefined &&
    (e.geography?.locality ?? "").toLowerCase() === startsIn;
  const placeableIn = (from: readonly Experience[]) =>
    origin ? from.filter((e) => point(e) || inStartTown(e)) : from;
  const placeable = placeableIn(ranked);
  const unmet = unmetIn(
    brief.interests,
    catalogue
      ? placeableIn(rank(catalogue, brief, without, weather).ranked)
      : placeable,
    (catalogue ?? pool).filter((e) => !without.includes(e.id)),
    origin
      ? (e) => {
          const here = point(e);
          return here ? distanceKm(origin, here) : undefined;
        }
      : undefined,
    (e) =>
      !brief.town ||
      !e.geography?.area?.name ||
      e.geography.area.name === brief.town.area ||
      inStartTown(e),
  );

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
   *
   * What the person **kept** goes in first, whatever the soft filters now say
   * (the hard rules are in `keptStops`): a
   * revision is an instruction to change the rest and leave that alone.
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

  const kept = new Set(keptExperiences.map((e) => e.id));
  for (const experience of keptExperiences) take(experience);
  // **Only when nothing they asked for exists is there no day.** If some of
  // it does, the day is built around that and the rest is said beside it.
  const open =
    unmet.length === 0 || unmet.length < new Set(brief.interests).size;
  // **Each thing they asked for gets a stop** before variety is considered:
  // the best-fitting place that states it, if none is already in the day.
  if (open) {
    for (const interest of brief.interests) {
      if (chosen.length >= wanted) break;
      if (chosen.some((c) => offers(c, interest))) continue;
      const match = placeable.find(
        (c) => !chosen.includes(c) && offers(c, interest),
      );
      if (match) take(match);
    }
  }
  for (const candidate of open ? ranked : []) {
    if (chosen.length >= wanted) break;
    if (chosen.includes(candidate)) continue;
    const verbs = verbsOf(candidate);
    const freshVerb =
      verbs.length === 0 || verbs.some((v) => !seenVerbs.has(v));
    if (freshVerb && !sameKindAtCap(candidate, 2)) take(candidate);
  }
  for (const candidate of open ? ranked : []) {
    if (chosen.length >= wanted) break;
    if (!chosen.includes(candidate) && !sameKindAtCap(candidate, 2)) {
      take(candidate);
    }
  }
  for (const candidate of open ? ranked : []) {
    if (chosen.length >= wanted) break;
    if (!chosen.includes(candidate)) take(candidate);
  }

  // Nearest-first from where they start, so the day is a route rather than a
  // list — unless the person set the order, in which case it is theirs, and
  // anything new is routed on from the last of their stops.
  const ordered = (() => {
    if (!order || order.length === 0) return route(chosen, origin);
    const placed = order
      .map((id) => chosen.find((e) => e.id === id))
      .filter((e): e is Experience => Boolean(e));
    const rest = chosen.filter((e) => !placed.includes(e));
    const last = placed.length > 0 ? point(placed[placed.length - 1]!) : origin;
    return [...placed, ...route(rest, last ?? origin)];
  })();

  // **The time budget.** Their hours, less a stated buffer per move, less
  // whatever they set by hand, shared across the rest in quarter hours.
  const hoursAssumed = brief.hours === undefined;
  const totalMinutes = Math.round((brief.hours ?? 4) * 60);
  const moves =
    ordered.length === 0
      ? 0
      : origin
        ? ordered.length + 1
        : Math.max(0, ordered.length - 1);
  const moveMinutes = moves * MOVE_MINUTES;
  const fixed = ordered.reduce(
    (sum, e) => sum + (setMinutes[e.id] !== undefined ? setMinutes[e.id]! : 0),
    0,
  );
  const flexible = ordered.filter((e) => setMinutes[e.id] === undefined).length;
  const share =
    flexible > 0
      ? Math.max(
          30,
          Math.floor((totalMinutes - moveMinutes - fixed) / flexible / 15) * 15,
        )
      : 0;
  // Rounding every share down to a quarter hour threw away up to fifteen
  // minutes a stop — 45 minutes of a five-hour day. What is left goes back,
  // a quarter hour at a time, to the stops in order.
  let spare = Math.max(
    0,
    Math.floor((totalMinutes - moveMinutes - fixed - share * flexible) / 15),
  );
  const flexMinutes = new Map<string, number>();
  for (const e of ordered) {
    if (setMinutes[e.id] !== undefined) continue;
    flexMinutes.set(e.id, share + (spare > 0 ? 15 : 0));
    if (spare > 0) spare -= 1;
  }
  // A long day with few stops can have more spare than one round covers.
  while (spare > 0 && flexMinutes.size > 0) {
    for (const [id, m] of flexMinutes) {
      if (spare === 0) break;
      flexMinutes.set(id, m + 15);
      spare -= 1;
    }
  }

  const { plans: rainFor } = rainPlansFor(
    ordered,
    ranked,
    weather,
    rainPlans,
    byId,
  );

  let previous = origin;
  const usedChallenges = new Set<string>();
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
    const challenge = challengeFor(
      experience,
      nth,
      brief.party,
      usedChallenges,
    );
    if (challenge) usedChallenges.add(challenge);
    const cost = statedCost(experience);
    const hours = statedHours(experience);
    const fit = fitFor(experience, brief);
    const rain = standsUpToRain(experience)
      ? ("stands" as const)
      : arguesAgainst(experience)
        ? ("exposed" as const)
        : mayNotRun(experience)
          ? ("may-not-run" as const)
          : undefined;
    const rainPlan = rainFor.get(experience.id);
    return {
      experience,
      minutes:
        setMinutes[experience.id] ?? flexMinutes.get(experience.id) ?? share,
      ...(km !== undefined ? { km: roundKm(km) } : {}),
      because: picked.includes(experience.id)
        ? "You picked this in Discovery."
        : reasonFor(experience, brief, weather),
      ...(cost ? { cost } : {}),
      ...(schedule && schedule.reading === "on"
        ? { open: `Published as open on ${schedule.date}.` }
        : {}),
      ...(hours ? { hours } : {}),
      notes,
      ...(challenge ? { challenge } : {}),
      ...(fit ? { fit } : {}),
      ...(kept.has(experience.id) ? { kept: true } : {}),
      ...(setMinutes[experience.id] !== undefined ? { timeSet: true } : {}),
      ...(rain ? { rain } : {}),
      ...(rainPlan ? { rainPlan } : {}),
      ...(km !== undefined && km > LONG_MOVE_KM ? { longMove: true } : {}),
    };
  });

  const last = stops[stops.length - 1];
  const lastPoint = last ? point(last.experience) : undefined;
  const homeKm =
    origin && lastPoint ? roundKm(distanceKm(lastPoint, origin)) : undefined;

  const stopMinutes = stops.reduce((sum, s) => sum + s.minutes, 0);
  const budget: DayBudget = {
    totalMinutes,
    stopMinutes,
    moveMinutes,
    moves,
    perMove: MOVE_MINUTES,
    overBy: Math.max(0, stopMinutes + moveMinutes - totalMinutes),
    hoursAssumed,
  };

  const money: DayMoney = {
    ...(brief.budget !== undefined ? { budget: brief.budget } : {}),
    free: stops
      .filter((s) => statedFree(s.experience))
      .map((s) => s.experience.title),
    priced: stops
      .filter((s) => s.cost && !statedFree(s.experience))
      .map((s) => ({ title: s.experience.title, cost: s.cost! })),
    unpublished: stops.filter((s) => !s.cost).length,
  };

  const unknowns: string[] = [...keptOut];
  // Set aside by the person, not dropped by the plan: said wherever the day
  // goes, so the paper never reads as if it was what they asked for.
  for (const aside of brief.setAside ?? [])
    unknowns.push(
      `Not in this day: ${aside} — nothing Atlas holds offered it, and you said to plan without it.`,
    );
  for (const caution of brief.cautions ?? []) unknowns.push(caution);
  for (const note of keptAgainst(keptExperiences, brief)) unknowns.push(note);
  const unfit = brief.interests.filter(
    (i) =>
      open &&
      !unmet.some((u) => u.activity === i) &&
      !stops.some((s) => offers(s.experience, i)),
  );
  if (unfit.length > 0)
    unknowns.push(
      `Not in this day: ${unfit.join(", ")}. It asked for more than ${stops.length === 1 ? "one stop" : `${stops.length} stops`} holds — say “add a stop” to make room.`,
    );
  if (brief.withinMinutes !== undefined && brief.hours === undefined)
    unknowns.push(
      `You said you would travel up to ${travelPhrase(brief.withinMinutes)}, but not how long you have — this is a ${budget.totalMinutes / 60}-hour day (assumed). Say “all day” to make room for the drive.`,
    );
  // **A part of the day that is over.** "This afternoon", said at 6:45 pm,
  // starts the day at 6:45 pm (never earlier than the clock). It is still the
  // person's day, but it is not the afternoon they named, and nothing here
  // knows what is open at that hour — so say so rather than hand a five-year-old
  // a 9 pm beach park without a word.
  const partEnds = brief.when ? PART_OF_DAY_END[brief.when] : undefined;
  if (
    brief.startFromWhen &&
    brief.startAt !== undefined &&
    partEnds !== undefined &&
    brief.startAt >= partEnds
  )
    unknowns.push(
      `It is already ${clockLabel(brief.startAt)}, so this ${brief.when} is over — this day starts now. Atlas does not say what is still open at this hour, so check before you go.`,
    );
  if (brief.shelter === "indoor" && stops.length > 0) {
    const covered = stops.filter((s) => indoors(s.experience)).length;
    unknowns.push(
      covered === stops.length
        ? "Under cover — Atlas says every stop here is indoors."
        : `Under cover — Atlas says ${covered} of ${stops.length} ${stops.length === 1 ? "stop is" : "stops are"} indoors; it does not say the others are.`,
    );
  }
  if (stops.some((s) => !s.open && !s.hours))
    unknowns.push("Opening hours — most places here have not published them.");
  if (stops.some((s) => !s.cost))
    unknowns.push("Prices — only published where a place has said.");
  unknowns.push(
    `${DRIVE_TIMES_UNKNOWN} The plan keeps ${MOVE_MINUTES} minutes back for each move; that is a buffer, not a drive time.`,
  );
  if (stops.some((s) => s.longMove))
    unknowns.push(
      `At least one move is over ${LONG_MOVE_KM} km in a straight line. The road will be longer, and ${MOVE_MINUTES} minutes will not cover it.`,
    );
  if (brief.party === "family" && brief.childAge === undefined)
    unknowns.push(
      "Ages — say how old the kids are and Atlas will say where they are admitted.",
    );

  return {
    title: titleFor(stops, brief),
    opening: openingFor(stops, brief, radiusKm, weather, unmet),
    stops,
    unknowns,
    ...(keptOut.length > 0 ? { leftOut: keptOut } : {}),
    brief,
    closing:
      "Put this in your pocket and your phone in the glovebox. Come back and tell us what actually happened.",
    budget,
    money,
    ...(homeKm !== undefined ? { homeKm } : {}),
    ...(weather ? { weather } : {}),
    ...(radiusKm !== undefined
      ? { radiusKm, radiusAssumed: brief.withinKm === undefined }
      : {}),
    ...(unmet.length > 0 ? { unmet } : {}),
  };
}

/**
 * **A stop they kept that contradicts something they said since.** Kept
 * stops survive every revision (§2.5), so this is a note, not a removal:
 * "No museums" does not delete the museum they chose, it says it is still
 * there.
 */
function keptAgainst(kept: readonly Experience[], brief: DayBrief): string[] {
  const out: string[] = [];
  const avoided = (brief.avoid ?? []).map(stem);
  for (const e of kept) {
    const hit =
      avoided.length > 0
        ? (brief.avoid ?? []).find((a, i) =>
            statedWords(e).some((w) => w.includes(avoided[i]!)),
          )
        : undefined;
    if (hit)
      out.push(
        `${e.title} stays even though you said no ${hit} — you kept it. Remove it if you meant it.`,
      );
    if (brief.shelter === "indoor" && outdoorsByAtlas(e))
      out.push(`${e.title} stays even though it is outdoors — you kept it.`);
  }
  return out;
}

/**
 * **A rain plan for each stop that needs one.**
 *
 * Which stops: on a wet forecast, every stop Atlas does not say stands up to
 * rain; otherwise only the ones it says are exposed or may not run. Which
 * alternative: the nearest eligible subject Atlas says is sheltered, partly
 * sheltered or runs in the rain, not already in the day, and not given to
 * another stop. No stated shelter nearby, no rain plan — and the screen says
 * so rather than suggesting somewhere that might be indoors.
 */
function rainPlansFor(
  ordered: readonly Experience[],
  ranked: readonly Experience[],
  weather: PlanWeather | undefined,
  replay: Readonly<Record<string, string>> | undefined,
  byId: ReadonlyMap<string, Experience>,
): { plans: Map<string, RainPlan> } {
  const plans = new Map<string, RainPlan>();
  const inDay = new Set(ordered.map((e) => e.id));

  const planFor = (stop: Experience, alt: Experience): RainPlan => {
    const a = point(stop);
    const b = point(alt);
    return {
      experience: alt,
      ...(a && b ? { km: roundKm(distanceKm(a, b)) } : {}),
      because: rainLine(alt) ?? "Atlas says the rain does not stop this.",
    };
  };

  if (replay) {
    for (const stop of ordered) {
      const alt = replay[stop.id] ? byId.get(replay[stop.id]!) : undefined;
      if (alt) plans.set(stop.id, planFor(stop, alt));
    }
    return { plans };
  }

  const needs = (e: Experience) =>
    weather?.wet ? !standsUpToRain(e) : arguesAgainst(e) || mayNotRun(e);
  const shelters = ranked.filter(
    (e) => standsUpToRain(e) && !inDay.has(e.id) && point(e),
  );
  const used = new Set<string>();
  for (const stop of ordered) {
    if (!needs(stop)) continue;
    const here = point(stop);
    if (!here) continue;
    let best: Experience | undefined;
    let bestKm = Infinity;
    for (const candidate of shelters) {
      if (used.has(candidate.id)) continue;
      const km = distanceKm(here, point(candidate)!);
      if (km < bestKm) {
        bestKm = km;
        best = candidate;
      }
    }
    if (best) {
      used.add(best.id);
      plans.set(stop.id, planFor(stop, best));
    }
  }
  return { plans };
}

/** One alternative for a stop, and why. */
export interface Alternative {
  readonly experience: Experience;
  readonly because: string;
  /** Straight-line km from the stop it would replace, where both are placed. */
  readonly km?: number;
  readonly cost?: string;
  readonly fit?: string;
}

/**
 * **"Not that one — what else?"**
 *
 * The swap used to be blind: drop the stop, take whatever ranked next. A
 * person choosing between three real places they can see is in control; a
 * person pressing a button until they like the result is playing a slot
 * machine. So this returns the next few the builder would have taken, nearest
 * to the stop being replaced first among equals, each with its reason.
 */
export function alternativesFor({
  pool,
  brief,
  day,
  index,
  without = [],
  weather,
  limit = 3,
}: {
  readonly pool: readonly Experience[];
  readonly brief: DayBrief;
  readonly day: DayPlanned;
  readonly index: number;
  readonly without?: readonly string[];
  readonly weather?: PlanWeather;
  readonly limit?: number;
}): Alternative[] {
  const stop = day.stops[index];
  if (!stop) return [];
  const inDay = day.stops.map((s) => s.experience.id);
  const { ranked, origin, radiusKm } = rank(
    pool,
    brief,
    [...without, ...inDay],
    weather,
  );
  const here = point(stop.experience);
  const score = (e: Experience) => {
    const base = fitness(e, brief, origin, radiusKm, weather);
    const there = point(e);
    if (!here || !there) return base;
    // Near the stop it replaces, so the route still holds together.
    return base + 4 * (1 - Math.min(distanceKm(here, there) / 15, 1));
  };
  // Prefer something different from what is being replaced.
  const kind = stop.experience.subtype ?? stop.experience.kind;
  const sorted = [...ranked].sort((a, b) => {
    const differ = (e: Experience) => ((e.subtype ?? e.kind) !== kind ? 1 : 0);
    return score(b) + differ(b) * 2 - (score(a) + differ(a) * 2);
  });
  return sorted.slice(0, limit).map((experience) => {
    const there = point(experience);
    const cost = statedCost(experience);
    const fit = fitFor(experience, brief);
    return {
      experience,
      because: reasonFor(experience, brief, weather),
      ...(here && there ? { km: roundKm(distanceKm(here, there)) } : {}),
      ...(cost ? { cost } : {}),
      ...(fit ? { fit } : {}),
    };
  });
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
  weather?: PlanWeather,
  unmet: readonly Unmet[] = [],
): string {
  const saidUnmet = (u: readonly Unmet[]) => {
    const where =
      radiusKm !== undefined && brief.town
        ? ` within ${radiusKm} km of ${brief.town.name.replace(/,\s*BC$/, "")}`
        : "";
    return u
      .map(
        ({ activity, nearest, unplaced }) =>
          `Nothing Atlas holds says it offers ${activity}${where}.${nearest ? ` The nearest it can place is ${nearest.title}, ${nearest.km} km away.` : ""}${unplaced?.length ? ` Atlas lists ${unplaced.join(", ")} for it but has not placed ${unplaced.length === 1 ? "it" : "them"} on a map, so it cannot say whether ${unplaced.length === 1 ? "it is" : "they are"} near.` : ""}`,
      )
      .join(" ");
  };
  if (stops.length === 0 && unmet.length > 0) return saidUnmet(unmet);
  if (stops.length === 0 && brief.shelter === "indoor") {
    return "Nothing in range that Atlas says is indoors. Try a wider circle, or tell me what to do outdoors instead.";
  }
  if (stops.length === 0) {
    return "Nothing here matched that. Try fewer constraints, or a wider circle.";
  }
  const hours = brief.hours ? `${brief.hours} hours` : "a day";
  const who =
    brief.childAge !== undefined
      ? ` with a ${brief.childAge}-year-old`
      : brief.party && brief.party !== "family"
        ? ` for ${partyPhrase(brief.party)}`
        : brief.party === "family"
          ? " with the family"
          : "";
  const count = stops.length === 1 ? "one stop" : `${stops.length} stops`;
  // The circle is stated, because it is a choice the plan made on somebody's
  // behalf and they may well want a different one.
  const circle =
    radiusKm !== undefined && brief.town
      ? ` inside ${radiusKm} km of ${brief.town.name.replace(/,\s*BC$/, "")}`
      : "";
  const window =
    brief.startAt !== undefined && brief.homeBy !== undefined
      ? ` Out ${brief.startsNow ? "now" : `at ${clockLabel(brief.startAt)}`}, home by ${clockLabel(brief.homeBy)}.`
      : brief.homeBy !== undefined
        ? ` Home by ${clockLabel(brief.homeBy)}.`
        : brief.startAt !== undefined
          ? ` Out at ${clockLabel(brief.startAt)}.`
          : "";
  const rain =
    weather?.wet && brief.shelter !== "outdoor"
      ? " Rain is forecast, so open-air places sank and the rest carry a rain plan where one exists."
      : "";
  // When nothing they asked for exists, the stops are only what they kept:
  // "the rest of what you asked for" would be false.
  const nothingAsked = unmet.length >= new Set(brief.interests).size;
  const lead =
    unmet.length > 0
      ? `${saidUnmet(unmet)} ${nothingAsked ? "These are only the stops you chose; nothing else was added in its place." : "Here is the rest of what you asked for."} `
      : "";
  const body = `${hours}${who}, ${count}${circle}, and a plan loose enough to abandon.`;
  // After a sentence, the summary starts one: "… asked for. A day, 3 stops".
  const said = lead ? body.charAt(0).toUpperCase() + body.slice(1) : body;
  return `${lead}${said}${window}${rain}`;
}
