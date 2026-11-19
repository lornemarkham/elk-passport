import type { Change } from "@/domain/date-night/connect/session";

/**
 * **Where a night lives while it is being played.**
 *
 * A night is one small hash of string fields, kept for 24 hours after it was
 * last touched and then gone. Memory for development and tests; a small
 * temporary Redis over HTTP in production, reached with plain `fetch` the way
 * the Fairview 3 show is (`src/lib/fairview3/redisStore.ts`), so there is no
 * schema, no migration and nothing to keep: expiry is the retention policy.
 *
 * The store knows nothing about games. It stores fields, writes a change
 * atomically enough for two phones (each person writes only their own fields;
 * the one field both could write, the next card, is write-once), and forgets.
 */

export const NIGHT_TTL_SECONDS = 60 * 60 * 24;
const PREFIX = "dnp:";

export interface NightStore {
  /** Every field of a night, or `null` if there is no such night. */
  load(code: string): Promise<Record<string, string> | null>;
  /** Make a night. `false` if the code is already taken. */
  create(code: string, fields: Record<string, string>): Promise<boolean>;
  /** Set a field only if nobody has: `true` if this call set it. */
  claim(code: string, field: string, value: string): Promise<boolean>;
  /** Apply a change and refresh the 24 hours. */
  write(code: string, change: Change): Promise<void>;
  /** Forget the night entirely. */
  drop(code: string): Promise<void>;
}

/** The night is not set up here; the API says so rather than crashing. */
export class NotReady extends Error {
  constructor(detail: string) {
    super(`date-night play: store not ready: ${detail}`);
  }
}

const isNight = (f: Record<string, string> | undefined | null) =>
  !!f && typeof f.seed === "string" && f.seed !== "";

export function memoryNights(now: () => number = Date.now): NightStore {
  const nights = new Map<string, { f: Record<string, string>; exp: number }>();
  const live = (code: string) => {
    const n = nights.get(code);
    if (!n) return null;
    if (n.exp <= now()) {
      nights.delete(code);
      return null;
    }
    return n;
  };
  const touch = (n: { exp: number }) => {
    n.exp = now() + NIGHT_TTL_SECONDS * 1000;
  };
  return {
    async load(code) {
      const n = live(code);
      return n ? { ...n.f } : null;
    },
    async create(code, fields) {
      if (live(code)) return false;
      const n = { f: { ...fields }, exp: 0 };
      touch(n);
      nights.set(code, n);
      return true;
    },
    async claim(code, field, value) {
      const n = live(code);
      if (!n || n.f[field] !== undefined) return false;
      n.f[field] = value;
      n.f.ver = String(Number(n.f.ver ?? 0) + 1);
      touch(n);
      return true;
    },
    async write(code, change) {
      const n = live(code);
      if (!n) return;
      for (const [k, v] of Object.entries(change.nx))
        if (n.f[k] === undefined) n.f[k] = v;
      Object.assign(n.f, change.set);
      for (const k of change.del) delete n.f[k];
      n.f.ver = String(Number(n.f.ver ?? 0) + 1);
      touch(n);
    },
    async drop(code) {
      nights.delete(code);
    },
  };
}

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

/** `HGETALL` is a flat [field, value, ...] list, or an object. */
function record(flat: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(flat))
    for (let i = 0; i + 1 < flat.length; i += 2)
      out[String(flat[i])] = String(flat[i + 1]);
  else if (flat && typeof flat === "object")
    for (const [k, v] of Object.entries(flat)) out[k] = String(v);
  return out;
}

export function redisNights(
  { url, token }: RedisEnv,
  fetchImpl: typeof fetch = fetch,
): NightStore {
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
  const key = (code: string) => PREFIX + code;
  const flat = (o: Record<string, string>) =>
    Object.entries(o).flatMap(([k, v]) => [k, v]);
  const refresh = (code: string): Cmd[] => [
    ["HINCRBY", key(code), "ver", 1],
    ["EXPIRE", key(code), NIGHT_TTL_SECONDS],
  ];

  return {
    async load(code) {
      const [raw] = await run([["HGETALL", key(code)]]);
      const f = record(raw);
      if (isNight(f)) return f;
      // A write that arrived after the night was dropped leaves a husk with
      // no seed; it is not a night, and it should not linger.
      if (Object.keys(f).length) await run([["DEL", key(code)]]);
      return null;
    },
    async create(code, fields) {
      const [made] = await run([["HSETNX", key(code), "seed", fields.seed]]);
      if (made !== 1) return false;
      const rest = { ...fields };
      delete rest.seed;
      await run([
        ["HSET", key(code), ...flat(rest)],
        ["EXPIRE", key(code), NIGHT_TTL_SECONDS],
      ]);
      return true;
    },
    async claim(code, field, value) {
      const [exists, set] = await run([
        ["HEXISTS", key(code), "seed"],
        ["HSETNX", key(code), field, value],
      ]);
      if (exists !== 1) {
        await run([["DEL", key(code)]]);
        return false;
      }
      if (set !== 1) return false;
      await run(refresh(code));
      return true;
    },
    async write(code, change) {
      const cmds: Cmd[] = [];
      for (const [k, v] of Object.entries(change.nx))
        cmds.push(["HSETNX", key(code), k, v]);
      if (Object.keys(change.set).length)
        cmds.push(["HSET", key(code), ...flat(change.set)]);
      if (change.del.length) cmds.push(["HDEL", key(code), ...change.del]);
      if (!cmds.length) return;
      await run([...cmds, ...refresh(code)]);
    },
    async drop(code) {
      await run([["DEL", key(code)]]);
    },
  };
}

const g = globalThis as unknown as { __nightsPlay?: NightStore };

/**
 * The store for this process. `DATENIGHT_PLAY_STORE=memory` forces memory
 * (the e2e suite does); otherwise Redis when it is configured, memory outside
 * production, and a clear "not ready" in production without one, because a
 * serverless function's memory is not shared between the two phones.
 */
export function nightStore(): NightStore {
  if (g.__nightsPlay) return g.__nightsPlay;
  const forced = process.env.DATENIGHT_PLAY_STORE === "memory";
  const redis = forced ? null : redisEnv();
  const production = process.env.NODE_ENV === "production";
  g.__nightsPlay = redis
    ? redisNights(redis)
    : forced || !production
      ? memoryNights()
      : unavailable("UPSTASH_REDIS_REST_URL / _TOKEN are not set");
  return g.__nightsPlay;
}

function unavailable(why: string): NightStore {
  const fail = async (): Promise<never> => {
    throw new NotReady(why);
  };
  return {
    load: fail,
    create: fail,
    claim: fail,
    write: fail,
    drop: fail,
  };
}
