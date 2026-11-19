import {
  ALL_CONTENT,
  suits,
  type ContentCard,
  type ModeId,
  type StageId,
  type Tone,
  type Topic,
} from "./content";

/**
 * **Which card comes next.**
 *
 * Pure and deterministic: the same seed, mode, stage and history always deal
 * the same card, so two phones that ask at once get the same answer and a test
 * can say exactly what a mode does. Nothing is random at the moment of
 * dealing; the randomness is the seed, chosen once when the night is made.
 *
 * - **Get to know me** deals conversation only, wandering between starters,
 *   interests, personal, memories and dreams. Never a game, never a score.
 * - **Figure me out** deals the games in turn: would you rather, guess my
 *   answer, most likely to, two truths and a lie, truth or dare.
 * - **Surprise me** alternates funny questions, real ones, playful
 *   challenges and getting-to-know-you games.
 * - **A person's own questions** (up to three each, written privately before
 *   the date) are woven in every few cards in every mode, alternating who is
 *   asking, and never first.
 *
 * Mode and stage are read at the moment of dealing, so changing either
 * mid-date changes the next card and leaves the ones already asked alone.
 */

export type Slot = 1 | 2;

export const CUSTOM_PER_PERSON = 3;

type Want =
  | { kind: "talk"; tone?: Tone; topic?: Topic }
  | { kind: "wyr" | "likely" | "guess" | "tod" | "truths" };

const KNOW: readonly Want[] = (
  [
    "starter",
    "interests",
    "personal",
    "memories",
    "dreams",
    "personal",
    "interests",
    "dreams",
  ] as const
).map((topic) => ({ kind: "talk", topic }));

const FIGURE: readonly Want[] = [
  { kind: "wyr" },
  { kind: "guess" },
  { kind: "likely" },
  { kind: "truths" },
  { kind: "tod" },
];

const SURPRISE: readonly Want[] = [
  { kind: "talk", tone: "fun" },
  { kind: "wyr" },
  { kind: "talk", tone: "real" },
  { kind: "tod" },
  { kind: "likely" },
  { kind: "talk", tone: "real" },
  { kind: "guess" },
  { kind: "talk", tone: "fun" },
  { kind: "truths" },
  { kind: "talk", tone: "real" },
];

const RHYTHM: Record<ModeId, readonly Want[]> = {
  know: KNOW,
  figure: FIGURE,
  surprise: SURPRISE,
};

/** How many cards between a person's own questions. */
export const CUSTOM_GAP: Record<ModeId, number> = {
  know: 3,
  figure: 4,
  surprise: 4,
};

export interface DealInput {
  readonly mode: ModeId;
  readonly stage: StageId;
  readonly seed: string;
  /** Every card dealt so far, in order. */
  readonly history: readonly string[];
  /** Each person's own questions; empty strings are blanks. */
  readonly questions: Readonly<Record<Slot, readonly string[]>>;
  /** Someone has left, so nothing that needs both of them is dealt. */
  readonly solo: boolean;
}

/** 32-bit FNV-1a: a stable, well-spread order from a seed and an id. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const customId = (slot: Slot, index: number) => `q:${slot}:${index}`;
export function parseCustomId(
  id: string,
): { slot: Slot; index: number } | null {
  const m = /^q:([12]):([0-2])$/.exec(id);
  return m ? { slot: Number(m[1]) as Slot, index: Number(m[2]) } : null;
}
export const isTruthsId = (id: string) => /^x:\d+$/.test(id);

const isCustom = (id: string) => id.startsWith("q:");

/** The next of someone's own questions to ask, if it's time. */
function nextCustom(input: DealInput): string | null {
  if (input.solo) return null;
  const { history, questions, mode } = input;
  let since = 0;
  for (let i = history.length - 1; i >= 0 && !isCustom(history[i]); i--)
    since++;
  if (since < CUSTOM_GAP[mode]) return null;
  const asked = new Set(history);
  const lastAsker = [...history]
    .reverse()
    .map(parseCustomId)
    .find(Boolean)?.slot;
  const order: Slot[] = lastAsker === 1 ? [2, 1] : [1, 2];
  for (const slot of order) {
    const index = questions[slot].findIndex(
      (q, i) => q.trim() !== "" && !asked.has(customId(slot, i)),
    );
    if (index >= 0) return customId(slot, index);
  }
  return null;
}

const needsBoth = (kind: Want["kind"]) =>
  kind === "wyr" || kind === "likely" || kind === "guess" || kind === "truths";

function pick(
  input: DealInput,
  want: Want,
  candidates: readonly ContentCard[],
): ContentCard | null {
  const seen = new Set(input.history);
  const suit = candidates.filter(
    (c) => c.kind === want.kind && suits(c, input.stage),
  );
  const fresh = suit.filter((c) => !seen.has(c.id));
  const narrowed = (pool: readonly ContentCard[]) => {
    if (want.kind !== "talk") return pool;
    const exact = pool.filter(
      (c) =>
        c.kind === "talk" &&
        (!want.topic || c.topic === want.topic) &&
        (!want.tone || c.tone === want.tone),
    );
    if (exact.length) return exact;
    const tone = pool.filter(
      (c) => c.kind === "talk" && (!want.tone || c.tone === want.tone),
    );
    return tone.length ? tone : pool;
  };
  let pool = narrowed(fresh);
  if (!pool.length) {
    // Used up for this stage: reuse the one asked longest ago.
    const recent = new Set(input.history.slice(-12));
    pool = suit.filter((c) => !recent.has(c.id));
    if (!pool.length) pool = suit;
  }
  if (!pool.length) return null;
  return pool.reduce((best, c) =>
    hash(`${input.seed}:${c.id}`) < hash(`${input.seed}:${best.id}`) ? c : best,
  );
}

/** The id of the next card. Always returns something. */
export function deal(input: DealInput): string {
  const custom = nextCustom(input);
  if (custom) return custom;

  const rhythm = RHYTHM[input.mode];
  const own = input.history.filter((id) => !isCustom(id)).length;
  let want = rhythm[own % rhythm.length];
  if (input.solo && needsBoth(want.kind)) {
    // Someone has left: the rest of the night is for the one still here.
    want = { kind: input.mode === "figure" ? "tod" : "talk" };
  }
  if (want.kind === "truths") return `x:${input.history.length}`;
  const card = pick(input, want, ALL_CONTENT);
  if (card) return card.id;
  // A stage with nothing of that kind: fall back to any conversation.
  return (
    pick(input, { kind: "talk" }, ALL_CONTENT)?.id ??
    ALL_CONTENT.find((c) => c.kind === "talk")!.id
  );
}
