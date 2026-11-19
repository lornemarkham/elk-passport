import {
  contentById,
  isInterest,
  isModeId,
  isStageId,
  type Interest,
  type ModeId,
  type StageId,
} from "./content";
import {
  CUSTOM_PER_PERSON,
  customId,
  deal,
  isTruthsId,
  parseCustomId,
  type Slot,
} from "./deck";

/**
 * **A Connect & Play night, as data.**
 *
 * One session is a flat set of string fields (a hash), so the same code runs
 * on memory in tests and on a small temporary Redis in production
 * (`src/lib/date-night/connect/store.ts`). This file is the whole game and
 * knows nothing about where it is kept:
 *
 *   parseState   fields -> state
 *   apply        state + who + what -> the fields to change (or a refusal)
 *   viewFor      state + who -> exactly what that person may see
 *
 * ## What is private, and how that is kept
 *
 * `viewFor` is the only road out. It never includes the other person's
 * unrevealed answer, the lie in a Two Truths before the guess, or a question
 * that has not been asked yet; an answer reaches the other phone only when
 * the card is revealed. An answer is deleted when the night moves past its
 * card, so what is kept is small and short: names, each person's own (up to
 * three) questions, the order of the cards, and the answer to the card on the
 * table. Everything is gone when both leave, and in 24 hours regardless.
 */

export type { Slot } from "./deck";

export interface Person {
  readonly name: string;
  /** sha256 of the person's token; the token itself is never kept. */
  readonly th: string;
  readonly left?: true;
}

export interface SessionState {
  readonly seed: string;
  /** One phone passed between two people, or one phone each. */
  readonly phones: 1 | 2;
  readonly created: number;
  readonly mode: ModeId;
  readonly stage: StageId;
  readonly people: Readonly<Record<Slot, Person | null>>;
  readonly questions: Readonly<Record<Slot, readonly string[]>>;
  /** Index of the card on the table. */
  readonly at: number;
  /** Card ids by index. */
  readonly cards: readonly string[];
  /** Raw answers, keyed "<card index>:<slot>". */
  readonly answers: Readonly<Record<string, unknown>>;
  readonly shared: readonly Interest[];
  readonly ver: number;
}

export const SLOTS: readonly Slot[] = [1, 2];
export const other = (s: Slot): Slot => (s === 1 ? 2 : 1);

const json = <T>(raw: string | undefined): T | null => {
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export function parseState(f: Record<string, string>): SessionState | null {
  if (!f.seed || !isModeId(f.mode) || !isStageId(f.stage)) return null;
  const person = (s: Slot): Person | null => {
    const p = json<Person>(f[`p${s}`]);
    return p && typeof p.th === "string" ? p : null;
  };
  const questions = (s: Slot): string[] => {
    const q = json<unknown>(f[`q${s}`]);
    const list = Array.isArray(q) ? q : [];
    return Array.from({ length: CUSTOM_PER_PERSON }, (_, i) =>
      typeof list[i] === "string" ? (list[i] as string) : "",
    );
  };
  const cards: string[] = [];
  for (let i = 0; f[`n:${i}`] !== undefined; i++) cards.push(f[`n:${i}`]);
  const answers: Record<string, unknown> = {};
  const shared: Interest[] = [];
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith("a:")) answers[k.slice(2)] = json<unknown>(v);
    else if (k.startsWith("sh:") && isInterest(v)) shared.push(v);
  }
  const at = Number(f.at);
  return {
    seed: f.seed,
    phones: f.phones === "1" ? 1 : 2,
    created: Number(f.created) || 0,
    mode: f.mode,
    stage: f.stage,
    people: { 1: person(1), 2: person(2) },
    questions: { 1: questions(1), 2: questions(2) },
    at: Number.isInteger(at) && at >= 0 && at < cards.length ? at : 0,
    cards,
    answers,
    shared,
    ver: Number(f.ver) || 0,
  };
}

// ---------------------------------------------------------------------------
// Words from people
// ---------------------------------------------------------------------------

/** One line of text from a person: no control characters, no runs of space. */
const CONTROL = /[\u0000-\u001f\u007f]/g;
export function clean(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
export const NAME_MAX = 24;
export const QUESTION_MAX = 160;
export const STATEMENT_MAX = 90;

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type Kind =
  "talk" | "custom" | "tod" | "wyr" | "likely" | "guess" | "truths";

export function kindOf(id: string): Kind | null {
  if (parseCustomId(id)) return "custom";
  if (isTruthsId(id)) return "truths";
  return contentById(id)?.kind ?? null;
}

const present = (st: SessionState, s: Slot) =>
  st.people[s] !== null && !st.people[s]!.left;

/**
 * Who asks, and who guesses, on a card where one of you goes first. Turns
 * alternate between cards of the same kind, so neither person always starts.
 */
export function leader(st: SessionState, index: number): Slot {
  const kind = kindOf(st.cards[index]);
  let before = 0;
  for (let i = 0; i < index; i++) if (kindOf(st.cards[i]) === kind) before++;
  return before % 2 === 0 ? 1 : 2;
}

const answerOf = (st: SessionState, i: number, s: Slot) =>
  st.answers[`${i}:${s}`] ?? null;

/** Who still has to do something before this card can be revealed. */
export function needs(st: SessionState, index = st.at): Slot[] {
  const id = st.cards[index];
  const kind = kindOf(id);
  const a = (s: Slot) => answerOf(st, index, s);
  const here = SLOTS.filter((s) => present(st, s));
  if (kind === "wyr" || kind === "likely")
    return here.filter((s) => a(s) === null);
  if (kind === "guess" || kind === "truths") {
    const first = leader(st, index);
    const second = other(first);
    if (a(first) === null) return present(st, first) ? [first] : [];
    if (a(second) === null) return present(st, second) ? [second] : [];
  }
  return [];
}

// ---------------------------------------------------------------------------
// What a person may see
// ---------------------------------------------------------------------------

export type CardView =
  | { kind: "talk"; id: string; text: string; topic: string }
  | { kind: "custom"; id: string; text: string; from: Slot }
  | { kind: "tod"; id: string; truth: string; dare: string }
  | {
      kind: "wyr";
      id: string;
      a: string;
      b: string;
      mine: 0 | 1 | null;
      /** Only when revealed. */
      theirs: 0 | 1 | null;
      needs: Slot[];
      revealed: boolean;
      /** The interest both picked, if they picked the same one. */
      match: Interest | null;
    }
  | {
      kind: "likely";
      id: string;
      text: string;
      /** The person you pointed at (1 or 2). */
      mine: Slot | null;
      theirs: Slot | null;
      needs: Slot[];
      revealed: boolean;
    }
  | {
      kind: "guess";
      id: string;
      text: string;
      options: readonly string[];
      asker: Slot;
      /** The asker's own choice, to the asker, or to both once revealed. */
      answer: number | null;
      guess: number | null;
      /** Has the asker chosen yet (the guesser may not see what). */
      chosen: boolean;
      needs: Slot[];
      revealed: boolean;
    }
  | {
      kind: "truths";
      id: string;
      writer: Slot;
      /** The three statements, once the writer has written them. */
      statements: string[] | null;
      /** The lie: the writer's own, or everyone's once revealed. */
      lie: number | null;
      guess: number | null;
      needs: Slot[];
      revealed: boolean;
    };

export interface PlayView {
  readonly status: "play";
  readonly code: string;
  readonly ver: number;
  readonly phones: 1 | 2;
  readonly mode: ModeId;
  readonly stage: StageId;
  /** Who the view is for. */
  readonly me: Slot;
  /** One phone: whose turn to hold it (the next person who has to act). */
  readonly acting: Slot | null;
  readonly names: Record<Slot, string>;
  readonly joined: Record<Slot, boolean>;
  readonly left: Record<Slot, boolean>;
  readonly index: number;
  readonly card: CardView;
  /** The viewer's own questions, and nobody else's. */
  readonly mine: readonly string[];
  readonly shared: readonly Interest[];
}

const FALLBACK = "Tell me something I don't know about you yet.";

export function cardView(st: SessionState, index: number, me: Slot): CardView {
  const id = st.cards[index];
  const kind = kindOf(id);
  const content = contentById(id);
  const waiting = needs(st, index);
  const revealed = waiting.length === 0;
  const a = (s: Slot) => answerOf(st, index, s);

  if (kind === "custom") {
    const c = parseCustomId(id)!;
    return {
      kind: "custom",
      id,
      text: st.questions[c.slot][c.index] || FALLBACK,
      from: c.slot,
    };
  }
  if (kind === "truths") {
    const writer = leader(st, index);
    const given = a(writer) as { s?: string[]; lie?: number } | null;
    const guess = a(other(writer));
    const shown = revealed || me === writer;
    return {
      kind: "truths",
      id,
      writer,
      statements: given?.s && given.s.length === 3 ? given.s : null,
      lie: shown && typeof given?.lie === "number" ? given.lie : null,
      guess: typeof guess === "number" ? guess : null,
      needs: waiting,
      revealed: revealed && given !== null,
    };
  }
  if (!content) return { kind: "talk", id, text: FALLBACK, topic: "starter" };
  switch (content.kind) {
    case "talk":
      return { kind: "talk", id, text: content.text, topic: content.topic };
    case "tod":
      return { kind: "tod", id, truth: content.truth, dare: content.dare };
    case "wyr": {
      const mine = a(me) as 0 | 1 | null;
      const them = a(other(me)) as 0 | 1 | null;
      const tag = (p: 0 | 1 | null) =>
        p === 0 ? content.ta : p === 1 ? content.tb : undefined;
      const match =
        revealed && mine !== null && mine === them ? (tag(mine) ?? null) : null;
      return {
        kind: "wyr",
        id,
        a: content.a,
        b: content.b,
        mine,
        theirs: revealed ? them : null,
        needs: waiting,
        revealed,
        match,
      };
    }
    case "likely":
      return {
        kind: "likely",
        id,
        text: content.text,
        mine: a(me) as Slot | null,
        theirs: revealed ? (a(other(me)) as Slot | null) : null,
        needs: waiting,
        revealed,
      };
    case "guess": {
      const asker = leader(st, index);
      const chosen = a(asker);
      const guess = a(other(asker));
      return {
        kind: "guess",
        id,
        text: content.text,
        options: content.options,
        asker,
        answer:
          typeof chosen === "number" && (revealed || me === asker)
            ? chosen
            : null,
        guess: typeof guess === "number" ? guess : null,
        chosen: chosen !== null,
        needs: waiting,
        revealed,
      };
    }
  }
}

/** Who a person is, as a stored person. `null` if nobody is. */
export function viewFor(st: SessionState, code: string, me: Slot): PlayView {
  const waiting = needs(st);
  return {
    status: "play",
    code,
    ver: st.ver,
    phones: st.phones,
    mode: st.mode,
    stage: st.stage,
    me,
    acting: st.phones === 1 ? (waiting[0] ?? null) : null,
    names: { 1: st.people[1]?.name ?? "", 2: st.people[2]?.name ?? "" },
    joined: { 1: st.people[1] !== null, 2: st.people[2] !== null },
    left: { 1: !!st.people[1]?.left, 2: !!st.people[2]?.left },
    index: st.at,
    card: cardView(st, st.at, me),
    mine: st.questions[me],
    shared: st.shared,
  };
}

// ---------------------------------------------------------------------------
// What a person may do
// ---------------------------------------------------------------------------

export type Action =
  | { type: "answer"; value: unknown }
  | { type: "next"; from: number }
  | { type: "mode"; mode: unknown }
  | { type: "stage"; stage: unknown }
  | { type: "questions"; list: unknown }
  | { type: "name"; name: unknown };

/** What to write. `nx` fields are written only if still absent. */
export interface Change {
  readonly set: Record<string, string>;
  readonly del: readonly string[];
  readonly nx: Record<string, string>;
}

export type Outcome =
  { ok: true; change: Change } | { ok: false; error: string };

const NONE: Change = { set: {}, del: [], nx: {} };
const ok = (c: Partial<Change> = {}): Outcome => ({
  ok: true,
  change: { ...NONE, ...c },
});
const no = (error: string): Outcome => ({ ok: false, error });

const isSlot = (v: unknown): v is Slot => v === 1 || v === 2;
const isIndex = (v: unknown, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < max;

function history(st: SessionState): string[] {
  return [...st.cards];
}

/** The deal for the card after this one, as the fields to write. */
function dealAfter(st: SessionState, mode = st.mode, stage = st.stage) {
  return deal({
    mode,
    stage,
    seed: st.seed,
    history: history(st),
    questions: st.questions,
    solo: SLOTS.some((s) => !present(st, s)),
  });
}

export function apply(st: SessionState, actor: Slot, action: Action): Outcome {
  if (!present(st, actor)) return no("not-here");
  switch (action.type) {
    case "mode":
      return isModeId(action.mode)
        ? ok({ set: { mode: action.mode } })
        : no("bad-mode");
    case "stage":
      return isStageId(action.stage)
        ? ok({ set: { stage: action.stage } })
        : no("bad-stage");
    case "name": {
      const name = clean(action.name, NAME_MAX);
      const me = st.people[actor]!;
      return ok({ set: { [`p${actor}`]: JSON.stringify({ ...me, name }) } });
    }
    case "questions": {
      const list: unknown = action.list;
      if (!Array.isArray(list)) return no("bad-questions");
      const next = Array.from({ length: CUSTOM_PER_PERSON }, (_, i) =>
        clean(list[i], QUESTION_MAX),
      );
      // A question already put to the other person is kept exactly as asked.
      const asked = new Set(st.cards);
      const kept = next.map((q, i) =>
        asked.has(customId(actor, i)) ? st.questions[actor][i] : q,
      );
      return ok({ set: { [`q${actor}`]: JSON.stringify(kept) } });
    }
    case "next": {
      if (action.from !== st.at) return ok(); // a double tap, or the other phone got there
      const index = st.at + 1;
      const set: Record<string, string> = { at: String(index) };
      // What the night learned from this card: one word, never an answer.
      const card = contentById(st.cards[st.at]);
      if (card?.kind === "wyr") {
        const x = answerOf(st, st.at, 1);
        const y = answerOf(st, st.at, 2);
        if (x !== null && x === y) {
          const tag = x === 0 ? card.ta : card.tb;
          if (tag) set[`sh:${st.at}`] = tag;
        }
      }
      return ok({
        set,
        nx: { [`n:${index}`]: dealAfter(st) },
        del: SLOTS.map((s) => `a:${st.at}:${s}`),
      });
    }
    case "answer":
      return answer(st, actor, action.value);
  }
}

function answer(st: SessionState, actor: Slot, value: unknown): Outcome {
  const index = st.at;
  const id = st.cards[index];
  const kind = kindOf(id);
  const content = contentById(id);
  const waiting = needs(st, index);
  if (!waiting.includes(actor)) return no("not-your-turn");
  const put = (v: unknown) =>
    ok({ set: { [`a:${index}:${actor}`]: JSON.stringify(v) } });

  if (kind === "wyr")
    return value === 0 || value === 1 ? put(value) : no("bad-answer");
  if (kind === "likely") return isSlot(value) ? put(value) : no("bad-answer");
  if (kind === "guess" && content?.kind === "guess")
    return isIndex(value, content.options.length)
      ? put(value)
      : no("bad-answer");
  if (kind === "truths") {
    if (actor === leader(st, index)) {
      const v = value as { s?: unknown; lie?: unknown } | null;
      const s = Array.isArray(v?.s)
        ? v.s.map((x) => clean(x, STATEMENT_MAX))
        : [];
      if (s.length !== 3 || s.some((x) => x === "") || !isIndex(v?.lie, 3))
        return no("bad-answer");
      return put({ s, lie: v!.lie });
    }
    return isIndex(value, 3) ? put(value) : no("bad-answer");
  }
  return no("nothing-to-answer");
}

/** The fields that make a brand-new night. */
export function newFields(input: {
  seed: string;
  phones: 1 | 2;
  mode: ModeId;
  stage: StageId;
  now: number;
  host: Person;
  /** One phone: the other person, held on the same device. */
  guest?: Person;
  questions: readonly string[];
  /** One phone: the other person's own questions. */
  guestQuestions?: readonly string[];
}): Record<string, string> {
  const own = (list: readonly string[] = []) =>
    Array.from({ length: CUSTOM_PER_PERSON }, (_, i) =>
      clean(list[i], QUESTION_MAX),
    );
  const q = own(input.questions);
  const q2 = own(input.guest ? input.guestQuestions : []);
  const fields: Record<string, string> = {
    seed: input.seed,
    phones: String(input.phones),
    created: String(input.now),
    mode: input.mode,
    stage: input.stage,
    p1: JSON.stringify(input.host),
    q1: JSON.stringify(q),
    at: "0",
    ver: "0",
  };
  if (input.guest) {
    fields.p2 = JSON.stringify(input.guest);
    fields.q2 = JSON.stringify(q2);
  }
  const first = deal({
    mode: input.mode,
    stage: input.stage,
    seed: input.seed,
    history: [],
    questions: { 1: q, 2: q2 },
    solo: false,
  });
  fields["n:0"] = first;
  return fields;
}

/** What leaving takes away: this person's answers, questions and token. */
export function leaving(st: SessionState, slots: readonly Slot[]): Change {
  const del: string[] = [];
  for (const [key] of Object.entries(st.answers)) {
    const [i, s] = key.split(":");
    if (slots.includes(Number(s) as Slot)) del.push(`a:${i}:${s}`);
  }
  // The shared words came from both; with one gone they go too.
  if (st.shared.length) del.push(...sharedKeys(st));
  const set: Record<string, string> = {};
  for (const s of slots) {
    const p = st.people[s];
    set[`p${s}`] = JSON.stringify({ name: p?.name ?? "", th: "", left: true });
    set[`q${s}`] = JSON.stringify(["", "", ""]);
  }
  return { set, del, nx: {} };
}

/** Field names of the shared-interest words, for deleting. */
function sharedKeys(st: SessionState): string[] {
  const out: string[] = [];
  for (let i = 0; i <= st.at; i++) out.push(`sh:${i}`);
  return out;
}

/** Nobody is left in the night. */
export function everyoneGone(st: SessionState, leaving: readonly Slot[]) {
  return SLOTS.every(
    (s) => st.people[s] === null || st.people[s]!.left || leaving.includes(s),
  );
}
