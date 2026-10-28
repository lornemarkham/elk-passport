import {
  QUESTION_IDS,
  TRACK_IDS,
  isQaStatus,
  isQuestionId,
  isSectionId,
  isTrackId,
  questionById,
  type FeedbackPromptId,
  type QaStatus,
  type QuestionId,
  type SectionId,
  type TrackId,
  isFeedbackPromptId,
  FEEDBACK_MAX_PER_PARTICIPANT,
  FEEDBACK_MAX_CHARS,
  QA_MAX_CHARS,
  QA_MAX_PER_PARTICIPANT,
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

export interface TrackConfig {
  /** `null` falls back to `/fairview3/audio/<slot>.mp3`. */
  readonly audioUrl: string | null;
  /** `null` falls back to the shared anthem lyrics. */
  readonly lyrics: string | null;
}

export interface ShowState {
  readonly section: SectionId;
  readonly questions: Record<QuestionId, VoteStatus>;
  /** The Hot Seat question on the stage. Only the presenter puts one there. */
  readonly qa: { readonly selected: string | null };
  /** The musical showdown's announced winner, fixed when announced. */
  readonly showdown: {
    readonly announced: boolean;
    readonly winner: TrackId | null;
  };
  readonly finale: {
    readonly started: boolean;
    /** Which song the finale plays. */
    readonly track: TrackId | null;
    readonly volume: number;
    readonly tracks: Record<TrackId, TrackConfig>;
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

/** A Hot Seat question as the room sees it: never hidden, no participant id. */
export interface QaItem {
  readonly id: string;
  readonly name: string;
  readonly body: string;
  readonly status: QaStatus;
  readonly votes: number;
  readonly at: string;
}

export interface QaRow extends QaItem {
  readonly participantId: string;
}

/** How many questions the public snapshot carries; the rest stay in the inbox. */
export const QA_PUBLIC_LIMIT = 80;

/** Unanswered first, then most upvoted, then oldest. */
export const qaOrder = (a: QaItem, b: QaItem): number =>
  Number(a.status === "answered") - Number(b.status === "answered") ||
  b.votes - a.votes ||
  a.at.localeCompare(b.at);

export interface Snapshot {
  readonly state: ShowState;
  readonly participants: number;
  /** Votes per option, per question. Always every question, always every option. */
  readonly tallies: Record<QuestionId, readonly number[]>;
  readonly feedback: readonly PublicFeedback[];
  readonly qa: readonly QaItem[];
  readonly at: string;
}

export interface Inbox {
  readonly feedback: readonly Feedback[];
  readonly counts: { pending: number; approved: number; hidden: number };
  readonly qa: readonly QaRow[];
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
      readonly track?: TrackId | null;
      readonly volume?: number;
    }
  | {
      readonly type: "track";
      readonly track: TrackId;
      readonly audioUrl?: string | null;
      readonly lyrics?: string | null;
    }
  | {
      readonly type: "showdown";
      readonly announced?: boolean;
      readonly winner?: TrackId | null;
    }
  | { readonly type: "qa-select"; readonly id: string | null }
  | {
      readonly type: "qa-moderate";
      readonly id: string;
      readonly status: QaStatus;
    }
  | {
      readonly type: "moderate";
      readonly id: string;
      readonly status: FeedbackStatus;
    }
  | {
      readonly type: "reset";
      readonly what: "votes" | "feedback" | "qa" | "all";
    };

export type VoteOutcome = "ok" | "closed" | "bad-option";
export type FeedbackOutcome = "ok" | "too-many" | "duplicate";
export type AskOutcome = "ok" | "too-many" | "duplicate";
export type UpvoteOutcome = "ok" | "missing";

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
  ask(participantId: string, name: string, body: string): Promise<AskOutcome>;
  /** Idempotent: `on` adds this phone's upvote, `!on` takes it back. */
  upvote(
    participantId: string,
    questionId: string,
    on: boolean,
  ): Promise<UpvoteOutcome>;
  /** Whether this key opens the console. */
  presenterOk(key: string): Promise<boolean>;
  /** `false` means the key was refused. */
  presenter(key: string, action: PresenterAction): Promise<boolean>;
  inbox(key: string): Promise<Inbox | null>;
}

const emptyTracks = (): Record<TrackId, TrackConfig> =>
  Object.fromEntries(
    TRACK_IDS.map((t) => [t, { audioUrl: null, lyrics: null }]),
  ) as Record<TrackId, TrackConfig>;

export const initialState = (): ShowState => ({
  section: "curtain",
  questions: { q1: "closed", q2: "closed", q3: "closed", q4: "closed" },
  qa: { selected: null },
  showdown: { announced: false, winner: null },
  finale: { started: false, track: null, volume: 0.8, tracks: emptyTracks() },
  rev: 0,
});

/** A state as it came off the wire or out of the database, filled to shape. */
export function normalizeState(raw: unknown): ShowState {
  const base = initialState();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const tracks = emptyTracks();
  for (const t of TRACK_IDS) {
    const c = s.finale?.tracks?.[t];
    if (c && typeof c === "object")
      tracks[t] = {
        audioUrl: typeof c.audioUrl === "string" ? c.audioUrl : null,
        lyrics: typeof c.lyrics === "string" ? c.lyrics : null,
      };
  }
  const f = s.finale ?? {};
  return {
    section: isSectionId(s.section) ? s.section : base.section,
    questions: { ...base.questions, ...(s.questions ?? {}) },
    qa: { selected: typeof s.qa?.selected === "string" ? s.qa.selected : null },
    showdown: {
      announced: s.showdown?.announced === true,
      winner: isTrackId(s.showdown?.winner) ? s.showdown.winner : null,
    },
    finale: {
      started: f.started === true,
      track: isTrackId(f.track) ? f.track : null,
      volume:
        typeof f.volume === "number" && f.volume >= 0 && f.volume <= 1
          ? f.volume
          : base.finale.volume,
      tracks,
    },
    rev: typeof s.rev === "number" ? s.rev : 0,
  };
}

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
      if ("track" in a) {
        if (a.track === null) out.track = null;
        else if (isTrackId(a.track)) out.track = a.track;
        else return null;
      }
      if ("volume" in a) {
        if (typeof a.volume !== "number" || !(a.volume >= 0 && a.volume <= 1))
          return null;
        out.volume = a.volume;
      }
      return out;
    }
    case "track": {
      if (!isTrackId(a.track)) return null;
      const out: {
        -readonly [
          K in keyof Extract<PresenterAction, { type: "track" }>
        ]: Extract<PresenterAction, { type: "track" }>[K];
      } = { type: "track", track: a.track };
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
    case "showdown": {
      const out: {
        -readonly [
          K in keyof Extract<PresenterAction, { type: "showdown" }>
        ]: Extract<PresenterAction, { type: "showdown" }>[K];
      } = { type: "showdown" };
      if ("announced" in a) {
        if (typeof a.announced !== "boolean") return null;
        out.announced = a.announced;
      }
      if ("winner" in a) {
        if (a.winner === null) out.winner = null;
        else if (isTrackId(a.winner)) out.winner = a.winner;
        else return null;
      }
      return out;
    }
    case "qa-select":
      return a.id === null || (typeof a.id === "string" && a.id.length <= 64)
        ? { type: "qa-select", id: a.id }
        : null;
    case "qa-moderate":
      return typeof a.id === "string" &&
        a.id.length <= 64 &&
        isQaStatus(a.status)
        ? { type: "qa-moderate", id: a.id, status: a.status }
        : null;
    case "moderate":
      return typeof a.id === "string" &&
        a.id.length <= 64 &&
        (a.status === "pending" ||
          a.status === "approved" ||
          a.status === "hidden")
        ? { type: "moderate", id: a.id, status: a.status }
        : null;
    case "reset":
      return a.what === "votes" ||
        a.what === "feedback" ||
        a.what === "qa" ||
        a.what === "all"
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
          ...state.finale,
          started: action.started ?? state.finale.started,
          track: action.track === undefined ? state.finale.track : action.track,
          volume: action.volume ?? state.finale.volume,
        },
        rev,
      };
    case "track":
      return {
        ...state,
        finale: {
          ...state.finale,
          tracks: {
            ...state.finale.tracks,
            [action.track]: {
              audioUrl:
                action.audioUrl === undefined
                  ? state.finale.tracks[action.track].audioUrl
                  : action.audioUrl,
              lyrics:
                action.lyrics === undefined
                  ? state.finale.tracks[action.track].lyrics
                  : action.lyrics,
            },
          },
        },
        rev,
      };
    case "showdown":
      return {
        ...state,
        showdown: {
          announced: action.announced ?? state.showdown.announced,
          winner:
            action.winner === undefined ? state.showdown.winner : action.winner,
        },
        rev,
      };
    case "qa-select":
      return { ...state, qa: { selected: action.id }, rev };
    case "reset": {
      if (action.what === "all") return { ...initialState(), rev };
      if (action.what === "qa")
        return { ...state, qa: { selected: null }, rev };
      if (action.what === "votes")
        return {
          ...state,
          showdown: { announced: false, winner: null },
          rev,
        };
      return { ...state, rev };
    }
    case "moderate":
    case "qa-moderate":
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
  let qa: QaRow[] = [];
  /** question id -> participants who upvoted it */
  const upvotes = new Map<string, Set<string>>();
  const good = (key: string) => key.length > 0 && key === presenterKey;
  const item = (q: QaRow): QaItem => ({
    id: q.id,
    name: q.name,
    body: q.body,
    status: q.status,
    votes: upvotes.get(q.id)?.size ?? 0,
    at: q.at,
  });
  const rows = (): QaRow[] =>
    qa.map((q) => ({ ...q, votes: upvotes.get(q.id)?.size ?? 0 }));
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
        // The question on the stage is always carried, however far down it ranks.
        qa: qa
          .filter((q) => q.status !== "hidden")
          .map(item)
          .sort(
            (a, b) =>
              Number(b.id === state.qa.selected) -
                Number(a.id === state.qa.selected) || qaOrder(a, b),
          )
          .slice(0, QA_PUBLIC_LIMIT)
          .sort(qaOrder),
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
    async ask(id, name, body) {
      if (body.length < 1 || body.length > QA_MAX_CHARS) return "duplicate";
      const mine = qa.filter((q) => q.participantId === id);
      if (mine.length >= QA_MAX_PER_PARTICIPANT) return "too-many";
      const print = feedbackFingerprint(body);
      if (mine.some((q) => feedbackFingerprint(q.body) === print))
        return "duplicate";
      participants.add(id);
      qa.push({
        id: crypto.randomUUID(),
        participantId: id,
        name,
        body,
        status: "visible",
        votes: 0,
        at: now().toISOString(),
      });
      return "ok";
    },
    async upvote(id, questionId, on) {
      const q = qa.find((x) => x.id === questionId);
      if (!q || q.status === "hidden") return "missing";
      participants.add(id);
      const set = upvotes.get(q.id) ?? new Set<string>();
      if (on) set.add(id);
      else set.delete(id);
      upvotes.set(q.id, set);
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
      if (action.type === "qa-moderate") {
        qa = qa.map((q) =>
          q.id === action.id ? { ...q, status: action.status } : q,
        );
        // Answered or hidden questions leave the stage.
        if (action.status !== "visible" && state.qa.selected === action.id)
          state = applyAction(state, { type: "qa-select", id: null });
        return true;
      }
      if (action.type === "qa-select") {
        const q = action.id ? qa.find((x) => x.id === action.id) : null;
        if (action.id && (!q || q.status === "hidden")) return true;
      }
      if (action.type === "reset") {
        if (action.what === "votes" || action.what === "all")
          for (const m of votes.values()) m.clear();
        if (action.what === "feedback" || action.what === "all") feedback = [];
        if (action.what === "qa" || action.what === "all") {
          qa = [];
          upvotes.clear();
        }
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
        qa: rows().sort(qaOrder),
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
