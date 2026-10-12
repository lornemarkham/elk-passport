import { townById, type DiscoveryTown } from "@/domain/discovery/towns";
import {
  activitiesIn,
  ACTIVITY_LABELS,
  namesActivity,
  ageIn,
  asksForFree,
  hoursIn,
  kmForMinutes,
  partOfDayIn,
  PART_OF_DAY_START,
  stem,
  townChangeIn,
  townIn,
  travelIn,
  type PartOfDay,
} from "./intent";

export { stem };

/**
 * **What somebody said they wanted, turned into something a builder can use.**
 *
 * > "Five hours, $100, with a five-year-old, near Vernon."
 *
 * ## Why this is a parser and not a prompt
 *
 * There is an OpenAI integration in this repository (`openai-recommender.ts`)
 * and **no key configured**, so an AI-only path would ship a dead feature. It
 * is also the wrong shape: a model is good at reading *"something weird, not
 * too far"* and bad at being the only thing standing between a person and a
 * fabricated opening time. So the deterministic reading below is the floor —
 * it works with no credentials, no network and no spend — and a model, when
 * one is configured, is asked to fill the same structure rather than to
 * replace it. Both answer to the same `DayBrief`, and nothing downstream can
 * tell which one produced it.
 *
 * Everything it reads is a number or a word the person actually typed. It
 * never guesses a town from an area code, never infers a child from "family",
 * and leaves anything it did not find `undefined` — which the builder then
 * asks about rather than assuming.
 */
export interface DayBrief {
  /** The sentence as typed, kept so the guide can quote it back. */
  readonly said: string;
  /** Hours available. Absent where nobody said. */
  readonly hours?: number;
  /** Dollars, total, for everybody. Absent where nobody said. */
  readonly budget?: number;
  /** A child's age in whole years — only where a number was actually given. */
  readonly childAge?: number;
  /** Where they are setting out from. */
  readonly town?: DiscoveryTown;
  /** `YYYY-MM-DD`, where a date was carried in rather than typed. */
  readonly on?: string;
  /** How far they are willing to go, in km. */
  readonly withinKm?: number;
  /**
   * **How long they are willing to travel, in minutes** — "drive two hours",
   * "within 30 minutes of Kelowna". Their words, kept so the screen can say
   * them back. `withinKm` is the planning circle drawn from it
   * (`kmForMinutes`): an estimate, said as one. Nothing re-checks the stops
   * against a routed time yet — Atlas's routed minutes only label each leg.
   */
  readonly withinMinutes?: number;
  /** "This afternoon", "tonight". Read from words; never from the clock. */
  readonly when?: PartOfDay;
  /** Set when `startAt` came from `when` rather than a time somebody typed. */
  readonly startFromWhen?: boolean;
  /**
   * Things they asked for that they agreed to plan without — because
   * nothing Atlas holds offers them. Said back on screen, never dropped
   * quietly.
   */
  readonly setAside?: readonly string[];
  /** Verbs and nouns to prefer, in the person's own words. */
  readonly interests: readonly string[];
  /** Whether they asked to stay dry, get outside, or neither. */
  readonly shelter?: "indoor" | "outdoor";
  /**
   * How far off the beaten track. `odd` is "make it weirder" — the builder
   * reads it as *prefer the thing with fewer neighbours*, never as licence to
   * invent one.
   */
  readonly appetite?: "gentle" | "odd" | "adventurous";
  /** Fewer, longer stops. Set by "less driving" and by a short day. */
  readonly lessDriving?: boolean;
  /**
   * **Who is going.** Read from words, never from anything else: "with my
   * wife" is a couple, "the crew" is friends, a child is a family. Absent
   * where nobody said, and nothing assumes a default party.
   */
  readonly party?: Party;
  /** When they set out, in minutes after midnight, where they said. */
  readonly startAt?: number;
  /** When they have to be home, in minutes after midnight, where they said. */
  readonly homeBy?: number;
  /** Set when `startAt` is *now* rather than a time somebody typed. */
  readonly startsNow?: boolean;
  /**
   * Things they said no to — "skip the museum", "no hiking" — in their words.
   * A place that states one of these is left out, and nothing else is.
   */
  readonly avoid?: readonly string[];
  /**
   * Things the person cares about that **nobody can check** here — an
   * allergy, a wheelchair — said back to them as something to ask about, so a
   * plan never reads as though it took care of it.
   */
  readonly cautions?: readonly string[];
}

export type Party = "solo" | "couple" | "family" | "friends";

/** What `readBrief` may know that nobody typed: the time on the clock. */
export interface BriefContext {
  /** Minutes after midnight where the day is, if the day is today. */
  readonly nowMinutes?: number;
}

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
};

const numberBefore = (text: string, unit: RegExp): number | undefined => {
  const digits = text.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit.source}`, "i"),
  );
  if (digits?.[1]) return Number(digits[1]);
  const words = text.match(
    new RegExp(
      `\\b(${Object.keys(NUMBER_WORDS).join("|")})\\s*${unit.source}`,
      "i",
    ),
  );
  const word = words?.[1]?.toLowerCase();
  return word ? NUMBER_WORDS[word] : undefined;
};

/** Nouns a person says no to that are not in the interest list but are in Atlas. */
const AVOIDABLE = [
  ...ACTIVITY_LABELS,
  "hike",
  "swim",
  "walk",
  "bike",
  "museums",
  "parks",
  "playgrounds",
  "beer",
  "crowds",
  "shopping",
  "arena",
  "rink",
] as const;

const PARTY_WORDS: readonly (readonly [Party, RegExp])[] = [
  // A child makes it a family whoever else is coming.
  [
    "family",
    /\bkids?\b|\bchildren\b|\bfamily\b|\btoddler\b|\bmy (?:son|daughter|niece|nephew|grandkids?|grandson|granddaughter)\b|year[-\s]?old|\b\d+\s?yo\b/,
  ],
  [
    "friends",
    /\bfriends\b|\bwith (?:a|my) friend\b|\bbuddies\b|\bmates\b|\bthe (?:crew|gang|boys|girls|guys)\b|\bgroup of\b|\bbachelor(?:ette)?\b/,
  ],
  [
    "couple",
    /\bmy (?:wife|husband|partner|girlfriend|boyfriend|fianc[eé]e?)\b|\bdate(?: night| day)?\b|\bthe two of us\b|\bas a couple\b|\bromantic\b|\banniversary\b/,
  ],
  ["solo", /\bsolo\b|\balone\b|\bby myself\b|\bjust me\b|\bon my own\b/],
];

const partyIn = (text: string): Party | undefined =>
  PARTY_WORDS.find(([, pattern]) => pattern.test(text))?.[0];

/**
 * **A clock time, in minutes after midnight, as a person says it.**
 *
 * "9", "9am", "9:30", "5 pm", "noon". With no am/pm the hour is read the way
 * people mean it for a day out — 7 to 11 is morning, 12 is noon, 1 to 6 is
 * afternoon — which is a reading of speech, not of a timetable, and the
 * screen says the time back so it can be corrected.
 */
const CLOCK = String.raw`(noon|midnight|\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)`;

export function clockFrom(spoken: string): number | undefined {
  const text = spoken.toLowerCase().trim();
  if (text === "noon") return 12 * 60;
  if (text === "midnight") return 24 * 60;
  const m = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return undefined;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  if (hour > 23 || minute > 59) return undefined;
  const suffix = m[3]?.[0];
  if (suffix === "p" && hour < 12) hour += 12;
  else if (suffix === "a" && hour === 12) hour = 0;
  else if (!suffix && hour >= 1 && hour <= 6) hour += 12;
  return hour * 60 + minute;
}

const startIn = (text: string): number | undefined => {
  const m =
    text.match(
      new RegExp(
        String.raw`\b(?:leave|leaving|start|starting|head(?:ing)? out|out the door|go|going)\s+(?:at|around|by)?\s*${CLOCK}`,
      ),
    ) ??
    text.match(
      new RegExp(String.raw`\bfrom\s+${CLOCK}\s+(?:to|until|till|-)\s`),
    );
  return m?.[1] ? clockFrom(m[1]) : undefined;
};

const homeIn = (text: string): number | undefined => {
  const m =
    text.match(
      new RegExp(
        String.raw`\b(?:home|back|done|finish(?:ed)?)\s+(?:by|before|at|around|for)\s+${CLOCK}`,
      ),
    ) ??
    text.match(new RegExp(String.raw`\b(?:until|till)\s+${CLOCK}`)) ??
    text.match(
      new RegExp(
        String.raw`\bfrom\s+${CLOCK}\s+(?:to|until|till|-)\s+${CLOCK}`,
      ),
    );
  const spoken = m?.[2] ?? m?.[1];
  return spoken ? clockFrom(spoken) : undefined;
};

const ceilQuarter = (minutes: number) => Math.ceil(minutes / 15) * 15;

/**
 * **Things nobody here can check, heard and handed back.**
 *
 * The doctrine's own example is *"my friend is allergic to shellfish"* (§2.5).
 * Atlas holds no menus and no allergen statements, so the honest response is
 * to keep the sentence and print it as something to ask — never to quietly
 * filter on a field that does not exist.
 */
const cautionsIn = (text: string): string[] => {
  const out: string[] = [];
  const allergy = text.match(
    /\b(?:allergic to|allergy to|allergies? (?:to|for)?)\s*([a-z ]+?)(?:[,.;]|\band\b|$)/,
  );
  if (allergy?.[1]?.trim() || /\ballerg/.test(text)) {
    const what = allergy?.[1]?.trim();
    out.push(
      `${what ? `A ${what} allergy` : "An allergy"} — Atlas holds no menus or allergen information for any place. Ask before you eat.`,
    );
  }
  if (
    /\bvegan\b|\bvegetarian\b|\bgluten\b|\bcoeliac\b|\bceliac\b|\bhalal\b|\bkosher\b/.test(
      text,
    )
  ) {
    out.push(
      "Dietary needs — no place here publishes a menu Passport can read. Ask before you go.",
    );
  }
  if (
    /\bwheelchair\b|\bstroller\b|\bpram\b|\bmobility\b|\baccessib/.test(text)
  ) {
    out.push(
      "Step-free access — very few places here publish it, so this plan cannot promise it. Call ahead.",
    );
  }
  if (
    /\bdogs?\b|\bpup(?:py)?\b/.test(text) &&
    /\bwith (?:the |my |our )?(?:dog|pup)/.test(text)
  ) {
    out.push(
      "Bringing the dog — only rules a place has published are on this plan. Leashes and bans elsewhere are unknown.",
    );
  }
  return out;
};

const avoidIn = (text: string): string[] => {
  const out: string[] = [];
  const pattern =
    /\b(?:no|skip|skipping|without|avoid|not into|hate|nothing with|not|anything but|(?:don'?t|do not|doesn'?t) (?:want|like)(?: to)?|can'?t (?:do|stand))\s+(?:the\s+|any\s+|more\s+|a\s+)?([a-zé]+)/g;
  for (const match of text.matchAll(pattern)) {
    const word = match[1] ?? "";
    if (
      (AVOIDABLE as readonly string[]).includes(word) ||
      activitiesIn(word).length > 0
    )
      out.push(word);
  }
  return [...new Set(out)];
};

/** Whether a person's word for something refers to this activity label. */
const sameThing = (said: string, label: string): boolean => {
  if (namesActivity(said, label)) return true;
  const s = stem(said);
  return (
    s === stem(label) ||
    label
      .toLowerCase()
      .split(/[\s-]+/)
      .some((part) => stem(part) === s)
  );
};

/**
 * Read a sentence. Anything not said stays `undefined`.
 *
 * `fallback` carries what Discovery already knows — the town, the day, the
 * age — so somebody arriving from an exploration does not have to retype it,
 * and anything they *do* type wins.
 *
 * ## Four words that mean something other than what they look like
 *
 * Found by the M200 audit, each with a sentence that reproduces it:
 * *two hours **free*** is time, not a $0 budget; *drive **two hours*** is how
 * far they will go, not how long the day is; *within **30 minutes*** is
 * minutes of travel, not kilometres; and *home by 5* is a deadline. The
 * travel part is lifted out of the sentence first, so what is left can be
 * read for the day's own length.
 */
export function readBrief(
  said: string,
  fallback: Partial<DayBrief> = {},
  context: BriefContext = {},
): DayBrief {
  const lowered = said.toLowerCase();
  const travel = travelIn(lowered);
  const text = travel.rest;

  // **A window is hours too.** "Leave at 9, home by 3" is six hours, and a
  // stated number of hours still wins over the arithmetic. "Home by 5" with
  // no start reads as *leaving now* only where the day is today and the
  // clock is known — and says so, because it is an assumption.
  const homeBy = homeIn(text) ?? fallback.homeBy;
  const typedStart = startIn(text) ?? fallback.startAt;
  const when = partOfDayIn(text) ?? fallback.when;
  // **"This afternoon" is a start, said as one.** Only where no time was
  // typed, never past the clock where the day is today, and shown as assumed.
  const startFromWhen =
    typedStart === undefined && homeBy === undefined && when !== undefined;
  const startsNow =
    typedStart === undefined &&
    homeBy !== undefined &&
    context.nowMinutes !== undefined;
  const startAt = startsNow
    ? ceilQuarter(context.nowMinutes!)
    : startFromWhen
      ? Math.max(
          PART_OF_DAY_START[when!],
          context.nowMinutes !== undefined
            ? ceilQuarter(context.nowMinutes)
            : 0,
        )
      : typedStart;
  const windowHours =
    startAt !== undefined &&
    homeBy !== undefined &&
    homeBy > startAt &&
    !startFromWhen
      ? Math.round(((homeBy - startAt) / 60) * 4) / 4
      : undefined;

  const hours =
    hoursIn(text) ??
    (/\bhalf a day\b/.test(text)
      ? 4
      : /\ball day\b|\bwhole day\b|\bfull day\b/.test(text)
        ? 8
        : /\ban hour\b/.test(text)
          ? 1
          : undefined) ??
    windowHours ??
    fallback.hours;

  const budgetMatch = text.match(/\$\s*(\d+(?:\.\d+)?)/);
  const budget =
    (budgetMatch?.[1] ? Number(budgetMatch[1]) : undefined) ??
    numberBefore(text, /dollars?/) ??
    (asksForFree(text) || /\bcheap\b/.test(text) ? 0 : undefined) ??
    fallback.budget;

  // **A number, or nothing.** "with a kid" is not an age, and guessing five
  // is exactly the invention every other surface in this product refuses.
  const childAge = ageIn(text) ?? fallback.childAge;

  const town = townIn(lowered) ?? townById(fallback.town?.id);

  const withinMinutes = travel.minutes ?? fallback.withinMinutes;
  const withinKm =
    (travel.minutes !== undefined ? kmForMinutes(travel.minutes) : undefined) ??
    numberBefore(text, /\s*km\b/) ??
    (/\bnearby\b|\bclose by\b|\bround the corner\b/.test(text)
      ? 15
      : undefined) ??
    fallback.withinKm;

  const avoid = [...new Set([...avoidIn(text), ...(fallback.avoid ?? [])])];
  const setAside = fallback.setAside ?? [];
  const interests = activitiesIn(text).filter(
    (word) =>
      !avoid.some((a) => sameThing(a, word)) &&
      !setAside.some((a) => a === word),
  );
  const party =
    partyIn(text) ??
    (childAge !== undefined ? "family" : undefined) ??
    fallback.party;
  const cautions = [
    ...new Set([...(fallback.cautions ?? []), ...cautionsIn(text)]),
  ];

  const shelter = /\brain|rainy|indoor|inside|dry\b/.test(text)
    ? ("indoor" as const)
    : /\boutdoor|outside|fresh air\b/.test(text)
      ? ("outdoor" as const)
      : undefined;

  const appetite = /\bweird|unusual|strange|odd|offbeat|surprise\b/.test(text)
    ? ("odd" as const)
    : /\badventur|wild|epic|bold\b/.test(text)
      ? ("adventurous" as const)
      : /\bgentle|easy|relax|slow|calm\b/.test(text)
        ? ("gentle" as const)
        : fallback.appetite;

  return {
    said: said.trim(),
    ...(hours !== undefined ? { hours } : {}),
    ...(budget !== undefined ? { budget } : {}),
    ...(childAge !== undefined ? { childAge } : {}),
    ...(town ? { town } : {}),
    ...(fallback.on ? { on: fallback.on } : {}),
    ...(withinKm !== undefined ? { withinKm } : {}),
    ...(withinMinutes !== undefined ? { withinMinutes } : {}),
    ...(when ? { when } : {}),
    ...(startFromWhen ? { startFromWhen: true } : {}),
    ...(setAside.length > 0 ? { setAside } : {}),
    interests: interests.length > 0 ? interests : (fallback.interests ?? []),
    ...(shelter
      ? { shelter }
      : fallback.shelter
        ? { shelter: fallback.shelter }
        : {}),
    ...(appetite ? { appetite } : {}),
    ...(/\bless driving\b|\bnot far\b|\bno driving\b/.test(text)
      ? { lessDriving: true }
      : fallback.lessDriving
        ? { lessDriving: true }
        : {}),
    ...(party ? { party } : {}),
    ...(startAt !== undefined ? { startAt } : {}),
    ...(homeBy !== undefined ? { homeBy } : {}),
    ...(startsNow ? { startsNow: true } : {}),
    ...(avoid.length > 0 ? { avoid } : {}),
    ...(cautions.length > 0 ? { cautions } : {}),
  };
}

/**
 * **A revision, applied to a brief that already exists.**
 *
 * *"Make it cheaper. More outdoors. Less driving. Make it weirder."* Each one
 * is a change to one dimension and an instruction to leave the rest alone —
 * which the doctrine calls out by name (§2.5) and which a re-parse of the
 * whole sentence would quietly violate.
 */
export function reviseBrief(
  brief: DayBrief,
  said: string,
  context: BriefContext = {},
): DayBrief {
  const lowered = said.toLowerCase();
  // Travel willingness is lifted out first: "drive two hours" must not be
  // read as a two-hour day, nor "free" in "two hours free" as a $0 budget.
  const travel = travelIn(lowered);
  const text = travel.rest;
  let next: DayBrief = { ...brief, said: `${brief.said} — ${said.trim()}` };

  // **Where the day starts.** "Let's do Kelowna instead" moves the start; it
  // does not touch what was kept, said, or set — and the town is only ever
  // one the person named.
  const town = townChangeIn(lowered);
  if (town && town.id !== next.town?.id) next = { ...next, town };

  if (travel.minutes !== undefined) {
    next = {
      ...next,
      withinMinutes: travel.minutes,
      withinKm: kmForMinutes(travel.minutes),
    };
  }

  // **Who.** A new age replaces the old one — it is the youngest that
  // matters — and makes the party a family unless they said otherwise.
  const age = ageIn(text);
  if (age !== undefined && age !== next.childAge) {
    next = { ...next, childAge: age, party: next.party ?? "family" };
  }

  if (/cheap|less money|budget|afford/.test(text)) {
    const now = next.budget ?? 60;
    next = { ...next, budget: Math.max(0, Math.round(now / 2)) };
  }
  const money = text.match(/\$\s*(\d+(?:\.\d+)?)/)?.[1];
  if (money) next = { ...next, budget: Number(money) };
  if (asksForFree(text)) next = { ...next, budget: 0 };

  if (/more outdoor|outside|fresh air/.test(text)) {
    next = { ...next, shelter: "outdoor" };
  }
  if (/indoor|inside|out of the rain|stay dry/.test(text)) {
    next = { ...next, shelter: "indoor" };
  }
  if (/less driving|closer|nearer|not so far/.test(text)) {
    next = {
      ...next,
      withinMinutes: undefined,
      lessDriving: true,
      ...(next.withinKm !== undefined
        ? { withinKm: Math.max(5, Math.round(next.withinKm / 2)) }
        : { withinKm: 15 }),
    };
  }
  if (/further|farther|wider|go further/.test(text)) {
    next = {
      ...next,
      withinMinutes: undefined,
      withinKm: Math.min(200, (next.withinKm ?? 30) * 2),
    };
  }
  if (/weird|unusual|strange|odd|surprise/.test(text)) {
    next = { ...next, appetite: "odd" };
  }
  if (/adventur|wild|bold|epic/.test(text)) {
    next = { ...next, appetite: "adventurous" };
  }
  if (/gentle|easier|calm|relax|slower/.test(text)) {
    next = { ...next, appetite: "gentle" };
  }

  // **Time.** A new number of hours, a new window, or simply shorter/longer.
  const hours = hoursIn(text);
  const homeBy = homeIn(text);
  const startAt = startIn(text);
  if (startAt !== undefined) next = { ...next, startAt, startsNow: undefined };
  if (homeBy !== undefined) {
    next = { ...next, homeBy };
    if (next.startAt === undefined && context.nowMinutes !== undefined) {
      next = {
        ...next,
        startAt: ceilQuarter(context.nowMinutes),
        startsNow: true,
      };
    }
  }
  if (hours !== undefined) {
    next = { ...next, hours };
  } else if (
    (homeBy !== undefined || startAt !== undefined) &&
    next.startAt !== undefined &&
    next.homeBy !== undefined &&
    next.homeBy > next.startAt
  ) {
    // **A deadline only ever shortens a day.** "Home by 9" said at ten in the
    // morning about a four-hour outing is a limit, not a request for eleven
    // hours. Only a whole new window — leave at *and* home by, said together —
    // replaces the hours somebody already gave.
    const window = Math.round(((next.homeBy - next.startAt) / 60) * 4) / 4;
    const restated = homeBy !== undefined && startAt !== undefined;
    next = {
      ...next,
      hours:
        restated || next.hours === undefined
          ? window
          : Math.min(next.hours, window),
    };
  } else if (/\bshorter\b|\bless time\b|\bquicker\b/.test(text)) {
    next = { ...next, hours: Math.max(1, (next.hours ?? 4) - 1) };
  } else if (/\blonger\b|\bmore time\b/.test(text)) {
    next = { ...next, hours: Math.min(12, (next.hours ?? 4) + 1) };
  }

  // **Who is coming.** A new party replaces the old one; the age, if one was
  // given, is a separate fact and stays until somebody changes it.
  const party = partyIn(text);
  if (party) next = { ...next, party };

  const avoid = avoidIn(text);
  if (avoid.length > 0) {
    next = {
      ...next,
      avoid: [...new Set([...(next.avoid ?? []), ...avoid])],
      interests: next.interests.filter(
        (i) => !avoid.some((a) => sameThing(a, i)),
      ),
    };
  }

  const cautions = cautionsIn(text);
  if (cautions.length > 0) {
    next = {
      ...next,
      cautions: [...new Set([...(next.cautions ?? []), ...cautions])],
    };
  }

  // Only this sentence's own "no" stops a word counting as a wish.
  const more = activitiesIn(text).filter(
    (w) => !avoid.some((a) => sameThing(a, w)),
  );
  if (more.length > 0) {
    next = { ...next, interests: [...new Set([...next.interests, ...more])] };
    // Asking for something again takes back an earlier "no".
    next = {
      ...next,
      avoid: (next.avoid ?? []).filter(
        (a) => !more.some((m) => sameThing(a, m)),
      ),
      // Asking again takes back an agreement to plan without it.
      setAside: (next.setAside ?? []).filter((a) => !more.includes(a)),
    };
  }
  return next;
}

/**
 * **What a revision changed, said back in a sentence each.**
 *
 * The conversation is not a chatbot (§3), but it does have to answer. A
 * change nobody can see is indistinguishable from one that did not happen,
 * and "I didn't catch that" is a better answer than silently rebuilding.
 */
export function heardIn(before: DayBrief, after: DayBrief): string[] {
  const out: string[] = [];
  if (after.budget !== before.budget && after.budget !== undefined) {
    out.push(
      after.budget === 0 ? "Free only." : `Budget now $${after.budget}.`,
    );
  }
  if (after.hours !== before.hours && after.hours !== undefined) {
    out.push(`${hoursPhrase(after.hours)} now.`);
  }
  if (after.homeBy !== before.homeBy && after.homeBy !== undefined) {
    out.push(`Home by ${clockLabel(after.homeBy)}.`);
  }
  if (after.startAt !== before.startAt && after.startAt !== undefined) {
    out.push(
      after.startsNow
        ? `Leaving now, about ${clockLabel(after.startAt)}.`
        : `Leaving at ${clockLabel(after.startAt)}.`,
    );
  }
  if (after.shelter !== before.shelter && after.shelter) {
    out.push(
      after.shelter === "indoor"
        ? "Leaving out places Atlas says are outdoors, and preferring those it says are indoors."
        : "Leaning outdoors.",
    );
  }
  if (after.town && after.town.id !== before.town?.id) {
    out.push(
      `Starting from ${after.town.name.replace(/,\s*BC$/, "")} now${before.town ? ` instead of ${before.town.name.replace(/,\s*BC$/, "")}` : ""}.`,
    );
  }
  if (after.childAge !== before.childAge && after.childAge !== undefined) {
    out.push(`Youngest is ${after.childAge}.`);
  }
  if (
    after.withinMinutes !== before.withinMinutes &&
    after.withinMinutes !== undefined
  ) {
    out.push(
      `Within ${travelPhrase(after.withinMinutes)} of the start — about ${after.withinKm} km in a straight line, assuming about 48 km/h. That is a search estimate, not a drive time.`,
    );
  } else if (
    after.withinKm !== before.withinKm &&
    after.withinKm !== undefined
  ) {
    out.push(`Staying within ${after.withinKm} km.`);
  }
  if (after.appetite !== before.appetite && after.appetite) {
    out.push(
      {
        odd: "Leaning odd.",
        adventurous: "Leaning adventurous.",
        gentle: "Taking it easy.",
      }[after.appetite],
    );
  }
  if (after.party !== before.party && after.party) {
    out.push(`Planning for ${partyPhrase(after.party)}.`);
  }
  const avoided = (after.avoid ?? []).filter(
    (a) => !(before.avoid ?? []).includes(a),
  );
  if (avoided.length > 0) out.push(`Leaving out ${avoided.join(", ")}.`);
  const added = after.interests.filter((i) => !before.interests.includes(i));
  if (added.length > 0) out.push(`Looking for ${added.join(", ")}.`);
  const cautions = (after.cautions ?? []).filter(
    (c) => !(before.cautions ?? []).includes(c),
  );
  for (const caution of cautions) out.push(caution);
  return out;
}

/** `30 minutes`, `an hour`, `2 hours` — a length of travel, in words. */
export const travelPhrase = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "an hour";
  const hours = minutes / 60;
  return Number.isInteger(hours)
    ? `${hours} hours`
    : `${hours.toFixed(1)} hours`;
};

export const partyPhrase = (party: Party): string =>
  ({
    solo: "one",
    couple: "two",
    family: "the family",
    friends: "a group of friends",
  })[party];

export const hoursPhrase = (hours: number): string => {
  if (hours === 1) return "One hour";
  const whole = Math.floor(hours);
  const rest = Math.round((hours - whole) * 60);
  if (rest === 0) return `${whole} hours`;
  return `${whole} h ${rest} min`;
};

/** `9:30 am`, `noon`, `5 pm` — the way a person writes it on a fridge note. */
export const clockLabel = (minutes: number): string => {
  const m = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  if (m === 12 * 60) return "noon";
  const hour24 = Math.floor(m / 60);
  const minute = m % 60;
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const suffix = hour24 < 12 ? "am" : "pm";
  return minute === 0
    ? `${hour} ${suffix}`
    : `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
};

/** Which stop a revision asked to change, 1-based, where it named one. */
export function replacedStop(said: string): number | undefined {
  const text = said.toLowerCase();
  if (!/replace|swap|change|different|something else/.test(text))
    return undefined;
  return ordinalIn(text);
}

/** Which stop a revision asked to drop, 1-based — "remove the third", "cut the last". */
export function removedStop(said: string, stops: number): number | undefined {
  const text = said.toLowerCase();
  if (!/\b(?:remove|drop|cut|lose|ditch|delete)\b/.test(text)) return undefined;
  if (/\blast\b/.test(text)) return stops > 0 ? stops : undefined;
  return ordinalIn(text);
}

/** "Add a stop", "one more stop" is +1; "fewer stops", "one less stop" is -1. */
export function stopCountChange(said: string): 1 | -1 | undefined {
  const text = said.toLowerCase();
  if (
    /\b(?:add (?:a|another|one more) stop|one more stop|another stop|more stops)\b/.test(
      text,
    )
  )
    return 1;
  if (/\b(?:fewer stops|less stops|one less stop|one fewer stop)\b/.test(text))
    return -1;
  return undefined;
}

const ordinalIn = (text: string): number | undefined => {
  const ordinal = text.match(
    /\b(first|second|third|fourth|fifth|sixth|1st|2nd|3rd|4th|5th|6th)\b/,
  )?.[1];
  const map: Readonly<Record<string, number>> = {
    first: 1,
    "1st": 1,
    second: 2,
    "2nd": 2,
    third: 3,
    "3rd": 3,
    fourth: 4,
    "4th": 4,
    fifth: 5,
    "5th": 5,
    sixth: 6,
    "6th": 6,
  };
  return ordinal ? map[ordinal] : undefined;
};
