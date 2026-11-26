import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import { substantial } from "@/lib/ai/ask/answer";
import { readChristmas } from "@/domain/christmas/themes";
import { readWhen } from "@/domain/christmas/when";
import { cardFor, photoOf, type DreamCard } from "./compose";
import { isAccommodation } from "./ingredients";

/**
 * **"I don't know what I want. Help me figure it out."**
 *
 * Not a questionnaire (doctrine §2.1, §4): four pairs of photographs, each a
 * real place near you that Atlas holds a picture of, and one tap each. Every
 * tap adds a few words to a sentence — *a walk in the woods*, *skating*,
 * *tonight*, *worth the drive* — and the sentence is handed to the same
 * reader as anything typed, shown to the person first so they can change it.
 * A photograph somebody reaches for is also a place: it is kept for the day.
 *
 * Nothing is remembered. A pick is a direction for this answer, not a fact
 * about the person (§5: "lingered on three waterfalls" is not "loves
 * waterfalls"), and the photo not picked is not a *not for me*.
 */

export interface FigureOption {
  readonly id: string;
  /** One or two words on the photograph. */
  readonly label: string;
  /** The words this pick adds to the sentence. */
  readonly phrase: string;
  /** The real place on the photograph. */
  readonly card: DreamCard;
}

export interface FigureRound {
  readonly id: string;
  readonly question: string;
  readonly options: readonly [FigureOption, FigureOption];
}

interface Direction {
  readonly id: string;
  readonly label: string;
  readonly phrase: string;
  readonly takes: (e: Experience, km: number) => boolean;
  /** How far to look for its photograph, km. */
  readonly within: readonly [number, number];
}

const subtypeAndTitle = (e: Experience) => `${e.subtype ?? ""} ${e.title}`;
const is = (pattern: RegExp) => (e: Experience) =>
  pattern.test(subtypeAndTitle(e));

const OUTSIDE = is(
  /\b(trail|viewpoint|lookout|waterfall|falls|canyon|provincial park|regional park|nature|lake|beach|forest|mountain)\b/i,
);
const WARM = is(/\b(cafe|café|coffee|tea ?room|bakery|chocolat\w*)\b/i);
const ACTIVE_WINTER = is(
  /\b(rink|arena|skating|sledding|tubing|ski|nordic|snowshoe|climbing)\b/i,
);
const ACTIVE_SUMMER = is(
  /\b(climbing|paddle|kayak|bike|zipline|trail|golf|swim)\b/i,
);
const EASY = is(
  /\b(museum|gallery|theatre|cinema|library|heritage|science|observatory|market|garden)\b/i,
);
const DAY = is(
  /\b(winery|vineyard|farm|orchard|garden|cidery|market|viewpoint|museum)\b/i,
);
const NIGHT = is(
  /\b(theatre|live music|music venue|brewery|brewpub|pub|bar|lounge|comedy|cinema|concert|distillery)\b/i,
);
const BIG = is(
  /\b(ski resort|resort|provincial park|winery|falls|waterfall|canyon|observatory|hot ?springs?|mountain|lake)\b/i,
);

const lights = (e: Experience) =>
  Boolean(readChristmas(e)?.themes.includes("lights"));

/** November to March is winter, for what "active" can mean outside. */
const winter = (today: string) => {
  const m = Number(today.slice(5, 7));
  return m >= 11 || m <= 3;
};

/** Christmas lights are an *after dark* only while the season is on. */
const christmasSeason = (today: string) => {
  const md = today.slice(5);
  return md >= "11-20" || md <= "01-03";
};

function directionsFor(
  today: string,
): readonly (readonly [string, string, Direction, Direction])[] {
  return [
    [
      "out-or-in",
      "Out in it, or somewhere warm?",
      {
        id: "outside",
        label: "Out in it",
        phrase: "a walk in the woods",
        takes: OUTSIDE,
        within: [0, 30],
      },
      {
        id: "warm",
        label: "Somewhere warm",
        phrase: "hot chocolate somewhere cozy",
        takes: WARM,
        within: [0, 15],
      },
    ],
    [
      "move-or-be-moved",
      "Move, or be moved?",
      {
        id: "active",
        label: "Move",
        phrase: winter(today) ? "skating" : "something active, like climbing",
        takes: winter(today) ? ACTIVE_WINTER : ACTIVE_SUMMER,
        within: [0, 30],
      },
      {
        id: "easy",
        label: "Be moved",
        phrase: "a museum or a show",
        takes: EASY,
        within: [0, 30],
      },
    ],
    [
      "day-or-night",
      "Daylight, or after dark?",
      {
        id: "day",
        label: "Daylight",
        phrase: "this afternoon",
        takes: DAY,
        within: [0, 30],
      },
      christmasSeason(today)
        ? {
            id: "night",
            label: "After dark",
            phrase: "the Christmas lights tonight",
            takes: (e) => lights(e) || NIGHT(e),
            within: [0, 30],
          }
        : {
            id: "night",
            label: "After dark",
            phrase: "tonight",
            takes: NIGHT,
            within: [0, 30],
          },
    ],
    [
      "near-or-far",
      "Stay close, or worth the drive?",
      {
        id: "near",
        label: "Stay close",
        phrase: "close to home, within 10 km",
        takes: (e) => substantial(e),
        within: [0, 10],
      },
      {
        id: "far",
        label: "Worth the drive",
        phrase: "worth the drive",
        takes: BIG,
        within: [40, 150],
      },
    ],
  ];
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const distance = (
  a: { latitude: number; longitude: number },
  c: readonly [number, number],
) => {
  const R = 6371;
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(c[1] - a.latitude) / 2) ** 2 +
    Math.cos(r(a.latitude)) *
      Math.cos(r(c[1])) *
      Math.sin(r(c[0] - a.longitude) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Four pairs of real photographs near the town, different each seed. */
export function figureRounds(input: {
  readonly pool: readonly Experience[];
  readonly townId: string;
  readonly today: string;
  readonly seed?: number;
}): FigureRound[] {
  const town = townById(input.townId) ?? townById("vernon")!;
  const origin = { latitude: town.latitude, longitude: town.longitude };
  const pictured = input.pool.flatMap((e) => {
    const c = e.geography?.coordinates;
    if (!c || typeof c[0] !== "number" || typeof c[1] !== "number") return [];
    if (!photoOf(e) || isAccommodation(e) || !substantial(e)) return [];
    if (e.kind === "Event" && e.startTime) {
      const when = readWhen(e, input.today);
      if (when.phase !== "now" && when.phase !== "upcoming") return [];
    }
    return [{ e, km: distance(origin, c as [number, number]) }];
  });
  const used = new Set<string>();
  const pick = (d: Direction): DreamCard | undefined => {
    const fits = pictured
      .filter(
        (p) =>
          !used.has(p.e.id) &&
          p.km >= d.within[0] &&
          p.km <= d.within[1] &&
          d.takes(p.e, p.km),
      )
      .sort(
        (a, b) =>
          hash(`${input.today}:${input.seed ?? 0}:${d.id}:${a.e.id}`) -
          hash(`${input.today}:${input.seed ?? 0}:${d.id}:${b.e.id}`),
      );
    const chosen = fits[0];
    if (!chosen) return undefined;
    used.add(chosen.e.id);
    return cardFor(chosen.e, origin, input.today, input.today);
  };
  return directionsFor(input.today).flatMap(([id, question, a, b]) => {
    const left = pick(a);
    const right = pick(b);
    if (!left || !right) return [];
    const option = (d: Direction, card: DreamCard): FigureOption => ({
      id: d.id,
      label: d.label,
      phrase: d.phrase,
      card,
    });
    return [
      {
        id,
        question,
        options: [option(a, left), option(b, right)] as const,
      },
    ];
  });
}

export { sentenceFrom } from "./figureSentence";
