import type {
  AskOutcome,
  Fairview3Store,
  Feedback,
  FeedbackOutcome,
  FeedbackStatus,
  Inbox,
  PresenterAction,
  QaItem,
  QaRow,
  Snapshot,
  UpvoteOutcome,
  VoteOutcome,
} from "./store";
import {
  QA_PUBLIC_LIMIT,
  applyAction,
  emptyTallies,
  initialState,
  normalizeState,
  NotReady,
  qaOrder,
} from "./store";
import {
  FEEDBACK_MAX_CHARS,
  FEEDBACK_MAX_PER_PARTICIPANT,
  QA_MAX_CHARS,
  QA_MAX_PER_PARTICIPANT,
  isFeedbackPromptId,
  isQuestionId,
  questionById,
  type FeedbackPromptId,
} from "./show";
import { feedbackFingerprint } from "./sanitize";

/**
 * **The show in Redis, over HTTP.**
 *
 * A Vercel function keeps nothing between requests, so the room's state lives
 * in one small Redis (Upstash, reached with plain `fetch` — no client library,
 * no connection to hold open). It is temporary by design: every key expires
 * two days after it was last written, and there is no schema to migrate.
 *
 *   fv3:state   JSON, the presenter's one document
 *   fv3:p       set of participant ids
 *   fv3:votes   hash  "<question>|<participant>" -> option
 *   fv3:fb      hash  id -> feedback row (JSON)
 *   fv3:qa      hash  id -> Hot Seat question (JSON)
 *   fv3:up      hash  "<question id>|<participant>" -> 1
 *
 * A snapshot is one pipelined round trip, shared by every request on an
 * instance for a moment, so 150 phones polling do not become 150 reads.
 */

const PREFIX = "fv3:";
const TTL_SECONDS = 60 * 60 * 48;
/** How long one instance reuses a snapshot it just read. */
const SNAPSHOT_TTL_MS = 600;

type Cmd = (string | number)[];

export interface RedisEnv {
  readonly url: string;
  readonly token: string;
}

/** Upstash's own names, or the ones Vercel's KV integration injects. */
export function redisEnv(
  env: Record<string, string | undefined> = process.env,
): RedisEnv | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token || !/^https?:\/\//.test(url)) return null;
  return { url: url.replace(/\/$/, ""), token };
}

/** `HGETALL` comes back as a flat [field, value, ...] list; make it a record. */
const pairs = (flat: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (Array.isArray(flat))
    for (let i = 0; i + 1 < flat.length; i += 2)
      out[String(flat[i])] = String(flat[i + 1]);
  else if (flat && typeof flat === "object")
    for (const [k, v] of Object.entries(flat)) out[k] = String(v);
  return out;
};

const parse = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export function redisFairview3(
  { url, token }: RedisEnv,
  presenterKey: string,
  now: () => Date = () => new Date(),
  fetchImpl: typeof fetch = fetch,
): Fairview3Store {
  async function run(cmds: Cmd[]): Promise<unknown[]> {
    let res: Response;
    try {
      res = await fetchImpl(`${url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cmds),
        cache: "no-store",
      });
    } catch (e) {
      throw new NotReady(`redis unreachable: ${(e as Error).message}`);
    }
    if (res.status === 401 || res.status === 403)
      throw new NotReady("redis refused the token");
    if (!res.ok) throw new Error(`redis ${res.status}`);
    const body = (await res.json()) as { result?: unknown; error?: string }[];
    return body.map((r) => {
      if (r.error) throw new Error(`redis: ${r.error}`);
      return r.result;
    });
  }

  const touch = (...keys: string[]): Cmd[] =>
    keys.map((k) => ["EXPIRE", PREFIX + k, TTL_SECONDS]);

  const good = (key: string) => key.length > 0 && key === presenterKey;

  async function readState() {
    const [raw] = await run([["GET", `${PREFIX}state`]]);
    return typeof raw === "string"
      ? normalizeState(parse(raw))
      : initialState();
  }
  const writeState = async (state: ReturnType<typeof initialState>) => {
    await run([
      ["SET", `${PREFIX}state`, JSON.stringify(state), "EX", TTL_SECONDS],
    ]);
    cache = null;
  };

  let cache: { at: number; value: Promise<Snapshot> } | null = null;

  const item = (q: QaRow, votes: number): QaItem => ({
    id: q.id,
    name: q.name,
    body: q.body,
    status: q.status,
    votes,
    at: q.at,
  });

  const upvoteCounts = (fields: unknown): Map<string, number> => {
    const counts = new Map<string, number>();
    if (Array.isArray(fields))
      for (const f of fields) {
        const id = String(f).split("|")[0]!;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    return counts;
  };

  async function readSnapshot(): Promise<Snapshot> {
    const [rawState, votes, count, fb, qa, up] = await run([
      ["GET", `${PREFIX}state`],
      ["HGETALL", `${PREFIX}votes`],
      ["SCARD", `${PREFIX}p`],
      ["HGETALL", `${PREFIX}fb`],
      ["HGETALL", `${PREFIX}qa`],
      ["HKEYS", `${PREFIX}up`],
    ]);
    const state =
      typeof rawState === "string"
        ? normalizeState(parse(rawState))
        : initialState();
    const tallies = emptyTallies();
    for (const [field, option] of Object.entries(pairs(votes))) {
      const q = field.split("|")[0]!;
      const n = Number(option);
      if (isQuestionId(q) && tallies[q][n] !== undefined) tallies[q][n]! += 1;
    }
    const counts = upvoteCounts(up);
    const rows = Object.values(pairs(qa))
      .map((raw) => parse<QaRow>(raw))
      .filter((q): q is QaRow => !!q && q.status !== "hidden")
      .map((q) => item(q, counts.get(q.id) ?? 0));
    return {
      state,
      participants: Number(count ?? 0),
      tallies,
      feedback: Object.values(pairs(fb))
        .map((raw) => parse<Feedback>(raw))
        .filter((f): f is Feedback => !!f && f.status === "approved")
        .sort((a, b) => a.at.localeCompare(b.at))
        .map(({ id, prompt, body }) => ({ id, prompt, body })),
      qa: rows
        .sort(
          (a, b) =>
            Number(b.id === state.qa.selected) -
              Number(a.id === state.qa.selected) || qaOrder(a, b),
        )
        .slice(0, QA_PUBLIC_LIMIT)
        .sort(qaOrder),
      at: now().toISOString(),
    };
  }

  const snapshot = (): Promise<Snapshot> => {
    const t = Date.now();
    if (cache && t - cache.at < SNAPSHOT_TTL_MS) return cache.value;
    const value = readSnapshot();
    const mine = { at: t, value };
    cache = mine;
    // A failed read must not be served again for the next 600 ms.
    value.catch(() => {
      if (cache === mine) cache = null;
    });
    return value;
  };

  async function qaRows(): Promise<QaRow[]> {
    const [raw] = await run([["HGETALL", `${PREFIX}qa`]]);
    return Object.values(pairs(raw))
      .map((r) => parse<QaRow>(r))
      .filter((q): q is QaRow => !!q);
  }

  return {
    snapshot,
    async presence(id) {
      await run([["SADD", `${PREFIX}p`, id], ...touch("p")]);
    },
    async vote(id, question, option) {
      const state = await readState();
      if (state.questions[question] !== "open") return "closed";
      const n = questionById(question).options.length;
      if (!Number.isInteger(option) || option < 0 || option >= n)
        return "bad-option";
      await run([
        ["HSET", `${PREFIX}votes`, `${question}|${id}`, option],
        ["SADD", `${PREFIX}p`, id],
        ...touch("votes", "p"),
      ]);
      cache = null;
      return "ok" satisfies VoteOutcome;
    },
    async feedback(id, prompt: FeedbackPromptId, body) {
      if (!isFeedbackPromptId(prompt) || body.length > FEEDBACK_MAX_CHARS)
        return "duplicate";
      const [raw] = await run([["HGETALL", `${PREFIX}fb`]]);
      const mine = Object.values(pairs(raw))
        .map((r) => parse<Feedback>(r))
        .filter((f): f is Feedback => !!f && f.participantId === id);
      if (mine.length >= FEEDBACK_MAX_PER_PARTICIPANT) return "too-many";
      const print = feedbackFingerprint(body);
      if (mine.some((f) => feedbackFingerprint(f.body) === print))
        return "duplicate";
      const row: Feedback = {
        id: crypto.randomUUID(),
        participantId: id,
        prompt,
        body,
        status: "pending",
        at: now().toISOString(),
      };
      await run([
        ["HSET", `${PREFIX}fb`, row.id, JSON.stringify(row)],
        ["SADD", `${PREFIX}p`, id],
        ...touch("fb", "p"),
      ]);
      return "ok" satisfies FeedbackOutcome;
    },
    async ask(id, name, body) {
      if (body.length < 1 || body.length > QA_MAX_CHARS) return "duplicate";
      const mine = (await qaRows()).filter((q) => q.participantId === id);
      if (mine.length >= QA_MAX_PER_PARTICIPANT) return "too-many";
      const print = feedbackFingerprint(body);
      if (mine.some((q) => feedbackFingerprint(q.body) === print))
        return "duplicate";
      const row: QaRow = {
        id: crypto.randomUUID(),
        participantId: id,
        name,
        body,
        status: "visible",
        votes: 0,
        at: now().toISOString(),
      };
      await run([
        ["HSET", `${PREFIX}qa`, row.id, JSON.stringify(row)],
        ["SADD", `${PREFIX}p`, id],
        ...touch("qa", "p"),
      ]);
      cache = null;
      return "ok" satisfies AskOutcome;
    },
    async upvote(id, questionId, on) {
      const [raw] = await run([["HGET", `${PREFIX}qa`, questionId]]);
      const q = typeof raw === "string" ? parse<QaRow>(raw) : null;
      if (!q || q.status === "hidden") return "missing";
      await run([
        on
          ? ["HSET", `${PREFIX}up`, `${questionId}|${id}`, 1]
          : ["HDEL", `${PREFIX}up`, `${questionId}|${id}`],
        ["SADD", `${PREFIX}p`, id],
        ...touch("up", "p"),
      ]);
      cache = null;
      return "ok" satisfies UpvoteOutcome;
    },
    async presenterOk(key) {
      return good(key);
    },
    async presenter(key, action: PresenterAction) {
      if (!good(key)) return false;
      if (action.type === "moderate") {
        const [raw] = await run([["HGET", `${PREFIX}fb`, action.id]]);
        const f = typeof raw === "string" ? parse<Feedback>(raw) : null;
        if (f)
          await run([
            [
              "HSET",
              `${PREFIX}fb`,
              action.id,
              JSON.stringify({ ...f, status: action.status }),
            ],
          ]);
        cache = null;
        return true;
      }
      if (action.type === "qa-moderate") {
        const [raw] = await run([["HGET", `${PREFIX}qa`, action.id]]);
        const q = typeof raw === "string" ? parse<QaRow>(raw) : null;
        if (!q) return true;
        await run([
          [
            "HSET",
            `${PREFIX}qa`,
            action.id,
            JSON.stringify({ ...q, status: action.status }),
          ],
        ]);
        // Answered or hidden questions leave the stage.
        if (action.status !== "visible") {
          const state = await readState();
          if (state.qa.selected === action.id)
            await writeState(
              applyAction(state, { type: "qa-select", id: null }),
            );
        }
        cache = null;
        return true;
      }
      if (action.type === "qa-select" && action.id) {
        const [raw] = await run([["HGET", `${PREFIX}qa`, action.id]]);
        const q = typeof raw === "string" ? parse<QaRow>(raw) : null;
        if (!q || q.status === "hidden") return true;
      }
      if (action.type === "reset") {
        const del = (...ks: string[]): Cmd[] =>
          ks.map((k) => ["DEL", PREFIX + k]);
        const cmds: Cmd[] = [];
        if (action.what === "votes" || action.what === "all")
          cmds.push(...del("votes"));
        if (action.what === "feedback" || action.what === "all")
          cmds.push(...del("fb"));
        if (action.what === "qa" || action.what === "all")
          cmds.push(...del("qa", "up"));
        if (action.what === "all") cmds.push(...del("p"));
        if (cmds.length) await run(cmds);
      }
      await writeState(applyAction(await readState(), action));
      return true;
    },
    async inbox(key) {
      if (!good(key)) return null;
      const [fbRaw, qaRaw, up] = await run([
        ["HGETALL", `${PREFIX}fb`],
        ["HGETALL", `${PREFIX}qa`],
        ["HKEYS", `${PREFIX}up`],
      ]);
      const feedback = Object.values(pairs(fbRaw))
        .map((r) => parse<Feedback>(r))
        .filter((f): f is Feedback => !!f);
      const counts: Record<FeedbackStatus, number> = {
        pending: 0,
        approved: 0,
        hidden: 0,
      };
      for (const f of feedback) counts[f.status] += 1;
      const votes = upvoteCounts(up);
      const qa = Object.values(pairs(qaRaw))
        .map((r) => parse<QaRow>(r))
        .filter((q): q is QaRow => !!q)
        .map((q) => ({ ...q, votes: votes.get(q.id) ?? 0 }))
        .sort(qaOrder);
      return {
        feedback: feedback.sort((a, b) => b.at.localeCompare(a.at)),
        counts,
        qa,
      } satisfies Inbox;
    },
  };
}
