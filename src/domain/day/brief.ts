import {
  DISCOVERY_TOWNS,
  townById,
  type DiscoveryTown,
} from "@/domain/discovery/towns";

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

/** Words a person uses for what they want to do, matched against Atlas's verbs. */
const INTEREST_WORDS = [
  "swimming",
  "hiking",
  "walking",
  "cycling",
  "biking",
  "fishing",
  "skating",
  "skiing",
  "snowshoeing",
  "paddling",
  "kayaking",
  "canoeing",
  "playground",
  "picnic",
  "birdwatching",
  "wildlife",
  "animals",
  "farm",
  "pumpkin",
  "museum",
  "art",
  "music",
  "coffee",
  "food",
  "beach",
  "trail",
  "park",
  "climbing",
  "books",
  "history",
] as const;

/**
 * Read a sentence. Anything not said stays `undefined`.
 *
 * `fallback` carries what Discovery already knows — the town, the day, the
 * age — so somebody arriving from an exploration does not have to retype it,
 * and anything they *do* type wins.
 */
export function readBrief(
  said: string,
  fallback: Partial<DayBrief> = {},
): DayBrief {
  const text = said.toLowerCase();

  const hours =
    numberBefore(text, /(?:hours?|hrs?\b)/) ??
    (/\bhalf a day\b/.test(text)
      ? 4
      : /\ball day\b|\bwhole day\b|\bfull day\b/.test(text)
        ? 8
        : /\ban hour\b/.test(text)
          ? 1
          : undefined) ??
    fallback.hours;

  const budgetMatch = text.match(/\$\s*(\d+(?:\.\d+)?)/);
  const budget =
    (budgetMatch?.[1] ? Number(budgetMatch[1]) : undefined) ??
    numberBefore(text, /dollars?/) ??
    (/\bfree\b|\bno money\b|\bcheap\b/.test(text) ? 0 : undefined) ??
    fallback.budget;

  // **A number, or nothing.** "with a kid" is not an age, and guessing five
  // is exactly the invention every other surface in this product refuses.
  const childAge =
    numberBefore(text, /[-\s]?year[-\s]?old/) ??
    numberBefore(text, /yo\b/) ??
    fallback.childAge;

  const town =
    DISCOVERY_TOWNS.find((t) => {
      const bare = t.name.replace(/,\s*BC$/i, "").toLowerCase();
      return new RegExp(
        `\\b${bare.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      ).test(text);
    }) ?? townById(fallback.town?.id);

  const withinKm =
    numberBefore(text, /\s*km\b/) ??
    (/\bnearby\b|\bclose by\b|\bround the corner\b/.test(text)
      ? 15
      : undefined) ??
    fallback.withinKm;

  const interests = INTEREST_WORDS.filter((word) => text.includes(word));

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
export function reviseBrief(brief: DayBrief, said: string): DayBrief {
  const text = said.toLowerCase();
  let next: DayBrief = { ...brief, said: `${brief.said} — ${said.trim()}` };

  if (/cheap|less money|budget|afford/.test(text)) {
    const now = next.budget ?? 60;
    next = { ...next, budget: Math.max(0, Math.round(now / 2)) };
  }
  if (/more outdoor|outside|fresh air/.test(text)) {
    next = { ...next, shelter: "outdoor" };
  }
  if (/indoor|inside|out of the rain|stay dry/.test(text)) {
    next = { ...next, shelter: "indoor" };
  }
  if (/less driving|closer|nearer|not so far/.test(text)) {
    next = {
      ...next,
      lessDriving: true,
      ...(next.withinKm !== undefined
        ? { withinKm: Math.max(5, Math.round(next.withinKm / 2)) }
        : { withinKm: 15 }),
    };
  }
  if (/further|farther|wider|go further/.test(text)) {
    next = { ...next, withinKm: Math.min(200, (next.withinKm ?? 30) * 2) };
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

  const more = INTEREST_WORDS.filter((w) => text.includes(w));
  if (more.length > 0) {
    next = { ...next, interests: [...new Set([...next.interests, ...more])] };
  }
  return next;
}

/** Which stop a revision asked to change, 1-based, where it named one. */
export function replacedStop(said: string): number | undefined {
  const text = said.toLowerCase();
  if (!/replace|swap|change|different|something else/.test(text))
    return undefined;
  const ordinal = text.match(
    /\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/,
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
  };
  return ordinal ? map[ordinal] : undefined;
}
