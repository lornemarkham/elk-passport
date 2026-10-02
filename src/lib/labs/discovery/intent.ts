/**
 * **What a person wants, in one representation, whatever they used to say it.**
 *
 * This is the seam the whole synthesis turns on. Four experiments each grew
 * their own way of expressing a wish — a chip in D, a phrase in B, an answer
 * to a fork in C, a typed query everywhere — and left to themselves those
 * would have become four parallel filtering systems that drift apart.
 *
 * They are all now the same thing:
 *
 * ```
 *     a chip        "Go out"            ─┐
 *     a phrase      "get out of the      │
 *                    house"              ├─→  DiscoveryIntent  ─→  resolve()
 *     a Trust Me    "Outside"            │        (this file)         ↓
 *       answer                           │                      possibilities
 *     a search      "pumpkin"           ─┘
 * ```
 *
 * ## The conversational seam
 *
 * There is a fifth producer that does not exist yet and does not need to for
 * the seam to be real:
 *
 * ```
 *     "Me and my daughter, couple of hours, don't want to drive far,
 *      rain is fine."
 *                              ↓
 *     a model's only job: produce this object
 *                              ↓
 *       { when: ["tonight"], looking: ["family"], within: 120 }
 *                              ↓
 *            resolve() — unchanged, deterministic, evidence-backed
 * ```
 *
 * The model would interpret the sentence. **It would not invent the world.**
 * Nothing downstream of this object can be reached by a language model:
 * Atlas remains the only source of possibilities, `resolve` remains a pure
 * function over them, and a hallucinated event has nowhere to enter. That is
 * the whole reason the seam is drawn here rather than at the results.
 *
 * `fromText` below is a deliberately stupid keyword reader. It exists to prove
 * the shape is sufficient — it is the function a model would replace, and
 * replacing it would require changing nothing else.
 *
 * ## Generic on purpose
 *
 * Nothing in this file mentions October, weather, pumpkins or Atlas. A
 * different Passport personality — a city, a season, a sport — would define
 * its own phrases and its own ranking bias, and produce this same object.
 */

/** Which days a person is asking about. Open-ended things answer all of them. */
export type WhenKey = "tonight" | "tomorrow" | "weekend" | "anytime";

/** Where you want to be. Two genuine alternatives. */
export type FeelKey = "go-out" | "stay-in";

/**
 * What you want to be doing. Kept apart from `FeelKey` because *Watch* is a
 * subset of *Stay in* rather than an alternative to it — or-ing them together
 * widened the results instead of narrowing them, which reads as a bug.
 */
export type DoingKey = "watch" | "make";

/** Who it is for, or what it should do to you. */
export type LookingKey = "family" | "scary";

/** Where it happens, where the evidence supports saying. */
export type WhereKey = "indoor" | "outdoor" | "sky";

/**
 * A wish, as this engine understands it.
 *
 * Every field is optional and an empty intent means *show me everything*,
 * which is the state somebody arrives in. Arrays are **or** within themselves
 * and **and** across each other, which is the rule every shop has taught
 * everybody already.
 */
export interface DiscoveryIntent {
  /** Free text, searched across everything written about a possibility. */
  readonly query?: string;
  readonly when?: readonly WhenKey[];
  /** A specific local day, `YYYY-MM-DD`. Behaves exactly like `when`. */
  readonly on?: string;
  readonly feel?: readonly FeelKey[];
  readonly doing?: readonly DoingKey[];
  readonly looking?: readonly LookingKey[];
  readonly where?: readonly WhereKey[];
  /**
   * Minutes a person has. A preference, never a filter — most of the corpus
   * states no duration and excluding it would be a claim nobody made.
   */
  readonly within?: number;
  /**
   * Ask for the unexpected. Inverts the usual contextual preference, so the
   * things a well-behaved feed would bury come first.
   */
  readonly surprise?: true;
}

export const EMPTY: DiscoveryIntent = {};

/** Is this person asking for anything at all? */
export function isEmpty(intent: DiscoveryIntent): boolean {
  return (
    !intent.query?.trim() &&
    !intent.on &&
    !intent.within &&
    !intent.surprise &&
    (intent.when?.length ?? 0) === 0 &&
    (intent.feel?.length ?? 0) === 0 &&
    (intent.doing?.length ?? 0) === 0 &&
    (intent.looking?.length ?? 0) === 0 &&
    (intent.where?.length ?? 0) === 0
  );
}

/** How many separate things have been asked for. Drives "clear everything". */
export function weight(intent: DiscoveryIntent): number {
  return (
    (intent.query?.trim() ? 1 : 0) +
    (intent.on ? 1 : 0) +
    (intent.within ? 1 : 0) +
    (intent.surprise ? 1 : 0) +
    (intent.when?.length ?? 0) +
    (intent.feel?.length ?? 0) +
    (intent.doing?.length ?? 0) +
    (intent.looking?.length ?? 0) +
    (intent.where?.length ?? 0)
  );
}

type Keyed = Pick<
  DiscoveryIntent,
  "when" | "feel" | "doing" | "looking" | "where"
>;

/** Add or remove one key, which is what pressing a chip does. */
export function toggle<K extends keyof Keyed>(
  intent: DiscoveryIntent,
  group: K,
  key: NonNullable<Keyed[K]>[number],
): DiscoveryIntent {
  const current = (intent[group] ?? []) as readonly string[];
  const next = current.includes(key)
    ? current.filter((k) => k !== key)
    : [...current, key];
  return { ...intent, [group]: next };
}

/**
 * Merge a second intent into a first — the operation every *mode* performs.
 *
 * Choosing a phrase on top of an active search adds to it rather than
 * replacing it, which is what makes the surfaces feel like one session
 * instead of four prototypes. Arrays union; scalars from the patch win.
 */
export function merge(
  base: DiscoveryIntent,
  patch: DiscoveryIntent,
): DiscoveryIntent {
  const union = <T>(a: readonly T[] = [], b: readonly T[] = []) => [
    ...new Set([...a, ...b]),
  ];
  return {
    ...base,
    ...patch,
    when: union(base.when, patch.when),
    feel: union(base.feel, patch.feel),
    doing: union(base.doing, patch.doing),
    looking: union(base.looking, patch.looking),
    where: union(base.where, patch.where),
  };
}

/**
 * Remove a patch from an intent — the inverse of `merge`.
 *
 * Pressing an already-chosen phrase used to clear the whole wish, so somebody
 * four refinements deep who changed their mind about one of them lost the
 * other three. Taking a phrase off now takes off exactly what it put on.
 */
export function subtract(
  base: DiscoveryIntent,
  patch: DiscoveryIntent,
): DiscoveryIntent {
  const minus = <T>(a: readonly T[] = [], b: readonly T[] = []) =>
    a.filter((k) => !b.includes(k));
  return {
    ...base,
    when: minus(base.when, patch.when),
    feel: minus(base.feel, patch.feel),
    doing: minus(base.doing, patch.doing),
    looking: minus(base.looking, patch.looking),
    where: minus(base.where, patch.where),
    ...(patch.within !== undefined ? { within: undefined } : {}),
    ...(patch.surprise ? { surprise: undefined } : {}),
  };
}

/**
 * **The function a language model would replace.**
 *
 * It reads a sentence for words this engine already understands and produces
 * the same object a chip produces. It is not clever and is not meant to be —
 * its only job is to demonstrate that natural language needs no new machinery
 * downstream, just a better producer of this one object.
 *
 * Anything it does not recognise falls through to `query`, so a sentence
 * always does *something* rather than silently doing nothing.
 */
export function fromText(text: string): DiscoveryIntent {
  const said = ` ${text.toLowerCase().replace(/[^a-z0-9' ]+/g, " ")} `;
  const has = (...words: string[]) =>
    words.some((w) => said.includes(` ${w} `) || said.includes(` ${w}s `));

  const when: WhenKey[] = [];
  if (has("tonight", "today", "now", "this evening")) when.push("tonight");
  if (has("tomorrow")) when.push("tomorrow");
  if (has("weekend", "saturday", "sunday")) when.push("weekend");

  const feel: FeelKey[] = [];
  if (has("out", "outside", "go", "going")) feel.push("go-out");
  if (has("home", "in", "indoors", "stay")) feel.push("stay-in");

  const doing: DoingKey[] = [];
  if (has("film", "movie", "watch", "watching")) doing.push("watch");
  if (has("make", "making", "craft", "build", "carve")) doing.push("make");

  const looking: LookingKey[] = [];
  if (has("kid", "child", "children", "daughter", "son", "family")) {
    looking.push("family");
  }
  if (has("scary", "scare", "frighten", "frightening", "haunted", "spooky")) {
    looking.push("scary");
  }

  const where: WhereKey[] = [];
  if (has("indoor", "indoors", "dry", "inside")) where.push("indoor");
  if (has("outdoor", "outdoors", "outside")) where.push("outdoor");
  if (has("stars", "sky", "astronomy", "meteor")) where.push("sky");

  // "a couple of hours", "an hour", "90 minutes".
  const hours = /\b(\d+)\s*(h|hr|hour)/.exec(said);
  const mins = /\b(\d+)\s*(m|min|minute)/.exec(said);
  const within = hours
    ? Number(hours[1]) * 60
    : mins
      ? Number(mins[1])
      : has("couple of hour", "couple hour")
        ? 120
        : has("an hour", "one hour")
          ? 60
          : undefined;

  const recognised =
    when.length + feel.length + doing.length + looking.length + where.length >
      0 || within !== undefined;

  return {
    ...(when.length ? { when } : {}),
    ...(feel.length ? { feel } : {}),
    ...(doing.length ? { doing } : {}),
    ...(looking.length ? { looking } : {}),
    ...(where.length ? { where } : {}),
    ...(within !== undefined ? { within } : {}),
    // Anything unrecognised is still worth searching for rather than dropping.
    ...(recognised ? {} : { query: text.trim() }),
  };
}
