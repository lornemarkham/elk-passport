import {
  QUESTION_IDS,
  isQuestionId,
  isSectionId,
  questionById,
  type FeedbackPromptId,
  type QuestionId,
  type SectionId,
  isFeedbackPromptId,
  FEEDBACK_MAX_PER_PARTICIPANT,
  FEEDBACK_MAX_CHARS,
} from "./show";
import { feedbackFingerprint } from "./sanitize";
import { supabaseFairview3 } from "./supabaseStore";

/**
 * **Where the live show lives.**
 *
 * One state row the presenter edits, one vote per participant per question,
 * one feedback row per submission. Memory for development and tests, Postgres
 * through security-definer functions otherwise (see the migration: the
 * public anon key can call the functions and touch nothing else, and the
 * presenter's key is checked inside the database, not in a route handler).
 */

export type VoteStatus = "closed" | "open" | "revealed";
export type FeedbackStatus = "pending" | "approved" | "hidden";

export interface ShowState {
  readonly section: SectionId;
  readonly questions: Record<QuestionId, VoteStatus>;
  readonly finale: {
    readonly started: boolean;
    readonly audioUrl: string | null;
    readonly lyrics: string | null;
  };
  /** Bumps on every presenter change, so a client can tell "new" from "same". */
  readonly rev: number;
}

export interface Feedback {
  readonly id: string;
  readonly participantId: string;
  readonly prompt: FeedbackPromptId;
  readonly body: string;
  readonly status: FeedbackStatus;
  readonly at: string;
}

export type PublicFeedback = Pick<Feedback, "id" | "prompt" | "body">;

export interface Snapshot {
  readonly state: ShowState;
  readonly participants: number;
  /** Votes per option, per question. Always every question, always every option. */
  readonly tallies: Record<QuestionId, readonly number[]>;
  readonly feedback: readonly PublicFeedback[];
  readonly at: string;
}

export interface Inbox {
  readonly feedback: readonly Feedback[];
  readonly counts: { pending: number; approved: number; hidden: number };
}

export type PresenterAction =
  | { readonly type: "section"; readonly section: SectionId }
  | {
      readonly type: "question";
      readonly question: QuestionId;
      readonly status: VoteStatus;
    }
  | {
      readonly type: "finale";
      readonly started?: boolean;
      readonly audioUrl?: string | null;
      readonly lyrics?: string | null;
    }
  | {
      readonly type: "moderate";
      readonly id: string;
      readonly status: FeedbackStatus;
    }
  | { readonly type: "reset"; readonly what: "votes" | "feedback" | "all" };

export type VoteOutcome = "ok" | "closed" | "bad-option";
export type FeedbackOutcome = "ok" | "too-many" | "duplicate";

export interface Fairview3Store {
  snapshot(): Promise<Snapshot>;
  presence(participantId: string): Promise<void>;
  vote(
    participantId: string,
    question: QuestionId,
    option: number,
  ): Promise<VoteOutcome>;
  feedback(
    participantId: string,
    prompt: FeedbackPromptId,
    body: string,
  ): Promise<FeedbackOutcome>;
  /** Whether this key opens the console. */
  presenterOk(key: string): Promise<boolean>;
  /** `false` means the key was refused. */
  presenter(key: string, action: PresenterAction): Promise<boolean>;
  inbox(key: string): Promise<Inbox | null>;
}

export const initialState = (): ShowState => ({
  section: "curtain",
  questions: { q1: "closed", q2: "closed", q3: "closed" },
  finale: { started: false, audioUrl: null, lyrics: null },
  rev: 0,
});

export const emptyTallies = (): Record<QuestionId, number[]> =>
  Object.fromEntries(
    QUESTION_IDS.map((q) => [q, questionById(q).options.map(() => 0)]),
  ) as Record<QuestionId, number[]>;

const MAX_URL = 2048;
const MAX_LYRICS = 8000;

/**
 * A presenter action as it arrives over the wire, checked field by field. The
 * same check runs in the database function, so a route handler is not the
 * only thing standing between a request and the state.
 */
export function parsePresenterAction(raw: unknown): PresenterAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case "section":
      return isSectionId(a.section)
        ? { type: "section", section: a.section }
        : null;
    case "question":
      return isQuestionId(a.question) &&
        (a.status === "closed" ||
          a.status === "open" ||
          a.status === "revealed")
        ? { type: "question", question: a.question, status: a.status }
        : null;
    case "finale": {
      const out: {
        -readonly [
          K in keyof Extract<PresenterAction, { type: "finale" }>
        ]: Extract<PresenterAction, { type: "finale" }>[K];
      } = { type: "finale" };
      if ("started" in a) {
        if (typeof a.started !== "boolean") return null;
        out.started = a.started;
      }
      if ("audioUrl" in a) {
        if (a.audioUrl === null || a.audioUrl === "") out.audioUrl = null;
        else if (
          typeof a.audioUrl === "string" &&
          a.audioUrl.length <= MAX_URL &&
          /^(https:\/\/|\/)/.test(a.audioUrl)
        )
          out.audioUrl = a.audioUrl;
        else return null;
      }
      if ("lyrics" in a) {
        if (a.lyrics === null || a.lyrics === "") out.lyrics = null;
        else if (typeof a.lyrics === "string" && a.lyrics.length <= MAX_LYRICS)
          out.lyrics = a.lyrics;
        else return null;
      }
      return out;
    }
    case "moderate":
      return typeof a.id === "string" &&
        a.id.length <= 64 &&
        (a.status === "pending" ||
          a.status === "approved" ||
          a.status === "hidden")
        ? { type: "moderate", id: a.id, status: a.status }
        : null;
    case "reset":
      return a.what === "votes" || a.what === "feedback" || a.what === "all"
        ? { type: "reset", what: a.what }
        : null;
    default:
      return null;
  }
}

/** Apply a presenter action to a state; pure, shared by memory store and tests. */
export function applyAction(
  state: ShowState,
  action: PresenterAction,
): ShowState {
  const rev = state.rev + 1;
  switch (action.type) {
    case "section":
      return { ...state, section: action.section, rev };
    case "question":
      return {
        ...state,
        questions: { ...state.questions, [action.question]: action.status },
        rev,
      };
    case "finale":
      return {
        ...state,
        finale: {
          started: action.started ?? state.finale.started,
          audioUrl:
            action.audioUrl === undefined
              ? state.finale.audioUrl
              : action.audioUrl,
          lyrics:
            action.lyrics === undefined ? state.finale.lyrics : action.lyrics,
        },
        rev,
      };
    case "reset":
      return action.what === "all"
        ? { ...initialState(), rev }
        : { ...state, rev };
    case "moderate":
      return state;
  }
}

export function memoryFairview3(
  presenterKey: string,
  now: () => Date = () => new Date(),
): Fairview3Store {
  let state = initialState();
  const participants = new Set<string>();
  const votes = new Map<QuestionId, Map<string, number>>(
    QUESTION_IDS.map((q) => [q, new Map()]),
  );
  let feedback: Feedback[] = [];
  const good = (key: string) => key.length > 0 && key === presenterKey;
  return {
    async snapshot() {
      const tallies = emptyTallies();
      for (const q of QUESTION_IDS)
        for (const option of votes.get(q)!.values()) tallies[q][option]! += 1;
      return {
        state,
        participants: participants.size,
        tallies,
        feedback: feedback
          .filter((f) => f.status === "approved")
          .map(({ id, prompt, body }) => ({ id, prompt, body })),
        at: now().toISOString(),
      };
    },
    async presence(id) {
      participants.add(id);
    },
    async vote(id, question, option) {
      if (state.questions[question] !== "open") return "closed";
      const n = questionById(question).options.length;
      if (!Number.isInteger(option) || option < 0 || option >= n)
        return "bad-option";
      participants.add(id);
      votes.get(question)!.set(id, option);
      return "ok";
    },
    async feedback(id, prompt, body) {
      if (!isFeedbackPromptId(prompt) || body.length > FEEDBACK_MAX_CHARS)
        return "duplicate";
      const mine = feedback.filter((f) => f.participantId === id);
      if (mine.length >= FEEDBACK_MAX_PER_PARTICIPANT) return "too-many";
      const print = feedbackFingerprint(body);
      if (mine.some((f) => feedbackFingerprint(f.body) === print))
        return "duplicate";
      participants.add(id);
      feedback.push({
        id: crypto.randomUUID(),
        participantId: id,
        prompt,
        body,
        status: "pending",
        at: now().toISOString(),
      });
      return "ok";
    },
    async presenterOk(key) {
      return good(key);
    },
    async presenter(key, action) {
      if (!good(key)) return false;
      if (action.type === "moderate") {
        feedback = feedback.map((f) =>
          f.id === action.id ? { ...f, status: action.status } : f,
        );
        return true;
      }
      if (action.type === "reset") {
        if (action.what !== "feedback")
          for (const m of votes.values()) m.clear();
        if (action.what !== "votes") feedback = [];
        if (action.what === "all") participants.clear();
      }
      state = applyAction(state, action);
      return true;
    },
    async inbox(key) {
      if (!good(key)) return null;
      const counts = { pending: 0, approved: 0, hidden: 0 };
      for (const f of feedback) counts[f.status] += 1;
      return {
        feedback: [...feedback].sort((a, b) => b.at.localeCompare(a.at)),
        counts,
      };
    },
  };
}

const g = globalThis as unknown as { __fairview3Store?: Fairview3Store };

/** The one store for this process: Supabase when configured, memory otherwise. */
export const fairview3Store = (): Fairview3Store => {
  if (g.__fairview3Store) return g.__fairview3Store;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const forced = process.env.FAIRVIEW3_STORE;
  const useSupabase =
    forced !== "memory" && !!url && !!anon && /^https?:\/\//.test(url);
  g.__fairview3Store = useSupabase
    ? supabaseFairview3(url!, anon!)
    : memoryFairview3(process.env.FAIRVIEW3_PRESENTER_KEY || "merlin");
  return g.__fairview3Store;
};

/** The database is not set up yet; the API says so instead of crashing. */
export class NotReady extends Error {
  constructor(detail: string) {
    super(`fairview3: database not ready: ${detail}`);
  }
}
