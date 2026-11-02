import {
  ADVENTUROUS_LEVELS,
  IDEA_PICKS,
  type Adventurous,
  type DateNight,
  type IdeaPick,
} from "./types";

/**
 * **What the invited person sends back.**
 *
 * Every part is optional — they can answer one question or all of them — and
 * everything is their own words or a choice among the night's own options.
 * Nothing here is inferred: a pick is what they tapped, not what Passport
 * guessed they might like (§5).
 */
export interface DateNightAnswer {
  /** Idea id → what they said about it. Ideas skipped are absent. */
  readonly picks: Readonly<Record<string, IdeaPick>>;
  /** Their own adventure ideas, in their words. */
  readonly ownIdeas: readonly string[];
  /** Atlas places they tapped, by id — only ones the night offered. */
  readonly placeIds: readonly string[];
  /** Places they typed. Their words, not knowledge about the world. */
  readonly places: readonly string[];
  readonly adventurous?: Adventurous;
  /** Food and drink chips they tapped — only the night's own. */
  readonly food: readonly string[];
  readonly foodNote?: string;
  readonly message?: string;
}

export const LIMITS = {
  ownIdeas: 6,
  ideaLength: 140,
  places: 6,
  placeLength: 120,
  foodNote: 280,
  message: 1000,
} as const;

export const EMPTY_ANSWER: DateNightAnswer = {
  picks: {},
  ownIdeas: [],
  placeIds: [],
  places: [],
  food: [],
};

/** Ids of every Atlas place a night offers, in ideas or as suggestions. */
export function offeredPlaceIds(night: DateNight): ReadonlySet<string> {
  return new Set([
    ...(night.suggestPlaceIds ?? []),
    ...night.ideas.flatMap((i) => i.atlasIds ?? []),
  ]);
}

const PICKS = new Set<string>(IDEA_PICKS.map((p) => p.value));
const LEVELS = new Set<number>(ADVENTUROUS_LEVELS.map((l) => l.value));

/** Trimmed, inner whitespace collapsed, control characters gone. */
function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return undefined;
  return text.length > max ? undefined : text;
}

function list(value: unknown, most: number, max: number): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > most) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim() === "") continue;
    const text = clean(item, max);
    if (text === undefined) return null;
    if (!out.includes(text)) out.push(text);
  }
  return out;
}

export type ParsedAnswer =
  | { readonly ok: true; readonly answer: DateNightAnswer }
  | { readonly ok: false; readonly reason: string };

/**
 * Reads an answer from the network against the night it is for. Anything not
 * one of the night's own ideas, places or foods is refused rather than
 * stored, and text over its limit is refused rather than cut — a message
 * silently shortened is a message changed.
 */
export function parseAnswer(raw: unknown, night: DateNight): ParsedAnswer {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ok: false, reason: "not an answer" };
  const body = raw as Record<string, unknown>;

  const picks: Record<string, IdeaPick> = {};
  if (body.picks !== undefined) {
    if (
      !body.picks ||
      typeof body.picks !== "object" ||
      Array.isArray(body.picks)
    )
      return { ok: false, reason: "picks" };
    const ideas = new Set(night.ideas.map((i) => i.id));
    for (const [id, pick] of Object.entries(body.picks)) {
      if (!ideas.has(id) || typeof pick !== "string" || !PICKS.has(pick))
        return { ok: false, reason: `pick ${id}` };
      picks[id] = pick as IdeaPick;
    }
  }

  const ownIdeas = list(body.ownIdeas, LIMITS.ownIdeas, LIMITS.ideaLength);
  if (!ownIdeas) return { ok: false, reason: "ownIdeas" };
  const places = list(body.places, LIMITS.places, LIMITS.placeLength);
  if (!places) return { ok: false, reason: "places" };

  const offered = offeredPlaceIds(night);
  const placeIds = list(body.placeIds, offered.size, 64);
  if (!placeIds || placeIds.some((id) => !offered.has(id)))
    return { ok: false, reason: "placeIds" };

  const foods = new Set(night.food);
  const food = list(body.food, night.food.length, 60);
  if (!food || food.some((f) => !foods.has(f)))
    return { ok: false, reason: "food" };

  let adventurous: Adventurous | undefined;
  if (body.adventurous !== undefined && body.adventurous !== null) {
    if (typeof body.adventurous !== "number" || !LEVELS.has(body.adventurous))
      return { ok: false, reason: "adventurous" };
    adventurous = body.adventurous as Adventurous;
  }

  const text = (key: "foodNote" | "message", max: number) => {
    const value = body[key];
    if (value === undefined || value === null || value === "")
      return { ok: true as const };
    const cleaned = clean(value, max);
    return cleaned === undefined && String(value).trim() !== ""
      ? { ok: false as const }
      : { ok: true as const, value: cleaned };
  };
  const foodNote = text("foodNote", LIMITS.foodNote);
  if (!foodNote.ok) return { ok: false, reason: "foodNote" };
  const message = text("message", LIMITS.message);
  if (!message.ok) return { ok: false, reason: "message" };

  const answer: DateNightAnswer = {
    picks,
    ownIdeas,
    placeIds,
    places,
    food,
    ...(adventurous ? { adventurous } : {}),
    ...(foodNote.value ? { foodNote: foodNote.value } : {}),
    ...(message.value ? { message: message.value } : {}),
  };
  if (isEmpty(answer)) return { ok: false, reason: "empty" };
  return { ok: true, answer };
}

export function isEmpty(answer: DateNightAnswer): boolean {
  return (
    Object.keys(answer.picks).length === 0 &&
    answer.ownIdeas.length === 0 &&
    answer.placeIds.length === 0 &&
    answer.places.length === 0 &&
    answer.food.length === 0 &&
    !answer.adventurous &&
    !answer.foodNote &&
    !answer.message
  );
}
