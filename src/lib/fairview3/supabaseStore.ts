import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AskOutcome,
  Fairview3Store,
  Feedback,
  FeedbackOutcome,
  Inbox,
  PresenterAction,
  QaItem,
  QaRow,
  Snapshot,
  UpvoteOutcome,
  VoteOutcome,
} from "./store";
import { emptyTallies, normalizeState, NotReady } from "./store";
import type { QaStatus, QuestionId } from "./show";

interface RawQa {
  id: string;
  name: string;
  body: string;
  status: string;
  votes: number;
  at: string;
  participant_id?: string;
}
const qaItem = (q: RawQa): QaItem => ({
  id: q.id,
  name: q.name,
  body: q.body,
  status: q.status as QaStatus,
  votes: Number(q.votes ?? 0),
  at: q.at,
});

/**
 * The show in Postgres, entirely through `fairview3_*` functions. The anon key
 * is public (it ships in the browser bundle), so the tables grant it nothing;
 * every function is SECURITY DEFINER and decides for itself. See the
 * migration for the rules. A missing function (the owner has not run the
 * SQL yet) surfaces as `NotReady`, which the API turns into a 503 and the
 * pages into a calm "not ready" message, never a crash.
 */
export function supabaseFairview3(url: string, anon: string): Fairview3Store {
  let client: SupabaseClient | undefined;
  const db = () =>
    (client ??= createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    }));

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await db().rpc(fn, args);
    if (error) {
      if (
        error.code === "PGRST202" ||
        error.code === "42883" ||
        /function .* does not exist|Could not find the function/i.test(
          error.message,
        )
      )
        throw new NotReady(`${fn}: ${error.message}`);
      throw new Error(`fairview3 ${fn}: ${error.message}`);
    }
    return data as T;
  }

  return {
    async snapshot(): Promise<Snapshot> {
      const raw = await rpc<{
        state: unknown;
        participants: number;
        tallies: Partial<Record<QuestionId, number[]>>;
        feedback: { id: string; prompt: string; body: string }[] | null;
        qa: RawQa[] | null;
        at: string;
      }>("fairview3_snapshot", {});
      const tallies = emptyTallies();
      for (const q of Object.keys(tallies) as QuestionId[]) {
        const got = raw.tallies?.[q];
        if (Array.isArray(got))
          tallies[q] = tallies[q].map((_, i) => Number(got[i] ?? 0));
      }
      return {
        state: normalizeState(raw.state),
        participants: Number(raw.participants ?? 0),
        tallies,
        feedback: (raw.feedback ?? []).map((f) => ({
          id: f.id,
          prompt: f.prompt as Feedback["prompt"],
          body: f.body,
        })),
        qa: (raw.qa ?? []).map(qaItem),
        at: raw.at ?? new Date().toISOString(),
      };
    },
    async presence(id) {
      await rpc("fairview3_presence", { p_participant: id });
    },
    async vote(id, question, option) {
      return rpc<VoteOutcome>("fairview3_vote", {
        p_participant: id,
        p_question: question,
        p_option: option,
      });
    },
    async feedback(id, prompt, body) {
      return rpc<FeedbackOutcome>("fairview3_feedback", {
        p_participant: id,
        p_prompt: prompt,
        p_body: body,
      });
    },
    async ask(id, name, body) {
      return rpc<AskOutcome>("fairview3_qa_ask", {
        p_participant: id,
        p_name: name,
        p_body: body,
      });
    },
    async upvote(id, questionId, on) {
      return rpc<UpvoteOutcome>("fairview3_qa_upvote", {
        p_participant: id,
        p_question: questionId,
        p_on: on,
      });
    },
    async presenterOk(key) {
      return rpc<boolean>("fairview3_presenter_ok", { p_key: key });
    },
    async presenter(key, action: PresenterAction) {
      return rpc<boolean>("fairview3_presenter", {
        p_key: key,
        p_action: action,
      });
    },
    async inbox(key): Promise<Inbox | null> {
      const raw = await rpc<{
        feedback: {
          id: string;
          participant_id: string;
          prompt: string;
          body: string;
          status: string;
          at: string;
        }[];
        qa: RawQa[] | null;
      } | null>("fairview3_inbox", { p_key: key });
      if (!raw) return null;
      const feedback: Feedback[] = raw.feedback.map((f) => ({
        id: f.id,
        participantId: f.participant_id,
        prompt: f.prompt as Feedback["prompt"],
        body: f.body,
        status: f.status as Feedback["status"],
        at: f.at,
      }));
      const counts = { pending: 0, approved: 0, hidden: 0 };
      for (const f of feedback) counts[f.status] += 1;
      const qa: QaRow[] = (raw.qa ?? []).map((q) => ({
        ...qaItem(q),
        participantId: q.participant_id ?? "",
      }));
      return { feedback, counts, qa };
    },
  };
}
