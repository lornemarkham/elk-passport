import { readAsk, type DiscoveryAsk, type ReadContext } from "./read";

/**
 * **A conversation, remembered — as the sentences somebody said, in order.**
 *
 * > "Something fun with my daughter." — *How much time do you have?*
 * > "About three hours." — *How far are you willing to travel?*
 * > "Maybe 45 minutes."
 * > "Actually, somewhere indoors."
 *
 * By the fourth line Passport knows a child is coming, there are about three
 * hours, the drive can be 45 minutes, and it should be under a roof. Each
 * sentence is read alone (`readAsk`), and the readings are folded oldest
 * first: **what a later sentence says replaces what an earlier one said about
 * the same thing, and everything it does not mention stays.** That is the
 * doctrine's own rule for a change request (§2.5) — honour what was changed
 * and leave the rest alone.
 *
 * ## Why the sentences, and not the reading
 *
 * The URL holds the words (`?ask=…&ask=…`), the same way it held one question
 * before. Re-reading them is how a conversation survives a refresh, a trip to
 * an entity and back, or sign-in — and it means a better reader improves old
 * links instead of being frozen out by a stored interpretation.
 *
 * ## What is never inferred
 *
 * A question Passport asked is derived from what it knew before the answer
 * (`questionFor`), so nothing has to remember that it was asked: a bare
 * "45 minutes" is read as a drive because, from the earlier turns, the
 * question on screen was *how far?*.
 */
export const MAX_TURNS = 8;

/** Fields that describe one thing, and are replaced together. */
const DISTANCE = ["near", "withinKm", "driveMinutes", "driveHours"] as const;
const TIME = ["hours", "window"] as const;

/** Lenses about *who*, which a later word about who replaces. */
const WHO_LENSES = new Set(["kids", "couple", "group"]);

/**
 * Fold one sentence's reading over everything before it.
 *
 * Replacements that need more than "later wins":
 *
 * - **Distance is one answer.** "Walking distance" after "within 30 minutes"
 *   replaces it; it does not sit beside it.
 * - **Who replaces who.** Friends after a child drops the age; a child after
 *   a date drops "the two of you".
 * - **A new day keeps the part of it.** "Something tonight", then "actually,
 *   make that tomorrow", is tomorrow evening.
 * - **"Something completely different"** keeps the constraints — who, when,
 *   how long, how far — and lets go of the activity and the lens, which are
 *   what they are tired of.
 * - **"Start over"** begins again with this sentence alone.
 * - **No to an activity** that was chosen un-chooses it; naming one that was
 *   refused un-refuses it.
 */
export function foldAsk(
  previous: DiscoveryAsk | undefined,
  next: DiscoveryAsk,
): DiscoveryAsk {
  if (!previous || next.reset) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { reset, ...fresh } = next;
    return fresh;
  }
  const merged: Record<string, unknown> = { ...previous };
  const said = next as unknown as Record<string, unknown>;
  const has = (key: string) => said[key] !== undefined;

  if (next.different) {
    for (const key of ["doing", "lens", "different", "avoid"])
      delete merged[key];
  }
  if (DISTANCE.some(has) || next.lens === "drive") {
    for (const key of DISTANCE) delete merged[key];
    if (next.lens !== "drive" && merged.lens === "drive") delete merged.lens;
  }
  if (TIME.some(has)) for (const key of TIME) delete merged[key];
  if (has("company")) {
    if (next.company !== "child") delete merged.childAge;
    if (next.company === "child") delete merged.pair;
    delete merged.company;
    if (WHO_LENSES.has(previous.lens ?? "")) delete merged.lens;
  }
  if (next.pair) {
    if (previous.company === "child") delete merged.company;
    delete merged.childAge;
    if (WHO_LENSES.has(previous.lens ?? "")) delete merged.lens;
  }
  if (has("on") && !has("partOfDay") && previous.partOfDay) {
    merged.partOfDay = previous.partOfDay;
  }

  const avoid = new Set([...(previous.avoid ?? [])]);
  if (next.doing) avoid.delete(next.doing);
  for (const key of next.avoid ?? []) avoid.add(key);
  if (merged.doing && avoid.has(merged.doing as string)) delete merged.doing;

  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || key === "avoid" || key === "reset") continue;
    // A lens that only says how long ("time") never displaces one that
    // says what kind of thing ("unusual", "kids").
    if (key === "lens" && value === "time" && merged.lens) continue;
    merged[key] = value;
  }
  if (avoid.size > 0) merged.avoid = [...avoid];
  else delete merged.avoid;
  return merged as unknown as DiscoveryAsk;
}

/** What Passport might ask next, and the replies it offers to tap. */
export interface FollowUp {
  readonly about: "time" | "distance" | "age";
  readonly text: string;
  readonly replies: readonly { readonly label: string; readonly say: string }[];
}

const TIME_QUESTION: FollowUp = {
  about: "time",
  text: "How much time do you have?",
  replies: [
    { label: "An hour or two", say: "about two hours" },
    { label: "Half a day", say: "half a day" },
    { label: "All day", say: "all day" },
  ],
};

const DISTANCE_QUESTION: FollowUp = {
  about: "distance",
  text: "How far are you willing to travel?",
  replies: [
    { label: "Walking distance", say: "walking distance" },
    { label: "20 minutes", say: "within 20 minutes" },
    { label: "45 minutes", say: "within 45 minutes" },
    { label: "An hour or more", say: "happy to drive an hour" },
  ],
};

const AGE_QUESTION: FollowUp = {
  about: "age",
  text: "How old are they?",
  replies: [2, 4, 5, 7, 10, 13].map((age) => ({
    label: String(age),
    say: `a ${age}-year-old`,
  })),
};

/**
 * **The one question worth asking now, or none.**
 *
 * Only once there is already an answer on screen — a question never stands
 * between somebody and possibility (§4). Only about a thing that changes what
 * Passport would offer:
 *
 * - **How much time** — a short outing and a whole day are different
 *   answers, and it decides which places fit inside the time there is.
 * - **How far** — only once time or a child is known, because that is when
 *   "close" stops being a wish and becomes the constraint.
 * - **How old** — a stated age is what Atlas checks its age rules against.
 *
 * Never for "what's on", "worth the drive" or a sentence nothing was read
 * from, and never a second time once asked: `asked` is every question
 * already put to them in this conversation, and an ignored question stays
 * ignored.
 */
export function questionFor(
  ask: DiscoveryAsk,
  asked: ReadonlySet<FollowUp["about"]> = new Set(),
): FollowUp | undefined {
  if (Object.keys(ask).every((key) => key === "said")) return undefined;
  if (ask.lens === "on" || ask.lens === "drive") return undefined;
  const timeKnown =
    ask.hours !== undefined ||
    ask.window !== undefined ||
    ask.partOfDay === "evening";
  const distanceKnown =
    ask.near !== undefined ||
    ask.withinKm !== undefined ||
    ask.driveMinutes !== undefined ||
    ask.townId !== undefined;
  const asks: FollowUp[] = [];
  if (!timeKnown) asks.push(TIME_QUESTION);
  if (!distanceKnown && (timeKnown || ask.company === "child"))
    asks.push(DISTANCE_QUESTION);
  if (ask.company === "child" && ask.childAge === undefined)
    asks.push(AGE_QUESTION);
  // Two questions a conversation, at most: past that it is a form.
  if (asked.size >= 2) return undefined;
  return asks.find((q) => !asked.has(q.about));
}

export interface Conversation {
  /** What everything said so far adds up to. */
  readonly ask: DiscoveryAsk;
  /** Each turn's own reading, oldest first — for saying back what changed. */
  readonly turns: readonly DiscoveryAsk[];
  /** The question to ask now, where one is worth asking. */
  readonly question?: FollowUp;
}

/**
 * **Read a whole conversation.** Each sentence is read knowing the question
 * that was on screen when it was typed, then folded over the ones before.
 */
export function readConversation(
  said: readonly string[],
  context: ReadContext,
  /** A model's reading of a turn, where one came back for that sentence. */
  readings: ReadonlyMap<string, DiscoveryAsk> = new Map(),
): Conversation {
  let ask: DiscoveryAsk | undefined;
  const turns: DiscoveryAsk[] = [];
  const asked = new Set<FollowUp["about"]>();
  let question: FollowUp | undefined;
  for (const sentence of said.slice(-MAX_TURNS)) {
    const turn =
      readings.get(sentence) ??
      readAsk(sentence, {
        ...context,
        ...(question ? { expecting: question.about } : {}),
      });
    if (turn.reset) asked.clear();
    turns.push(turn);
    ask = foldAsk(ask, turn);
    question = questionFor(ask, asked);
    if (question) asked.add(question.about);
  }
  return {
    ask: ask ?? { said: "" },
    turns,
    ...(question ? { question } : {}),
  };
}
