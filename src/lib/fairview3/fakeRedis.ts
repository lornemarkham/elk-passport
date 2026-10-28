/**
 * Just enough Redis, in memory, to run the show's store against: the nine
 * commands `redisStore.ts` sends, with Upstash's REST pipeline envelope.
 * Used by the store tests and by `scripts/fairview3/fake-upstash.mjs` so the
 * whole app can be driven end to end with no network and no account.
 */
type Cmd = (string | number)[];

export function fakeRedis() {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const sets = new Map<string, Set<string>>();
  const hash = (k: string) => {
    let h = hashes.get(k);
    if (!h) hashes.set(k, (h = new Map()));
    return h;
  };
  function exec([name, ...a]: Cmd): unknown {
    const k = String(a[0]);
    switch (String(name).toUpperCase()) {
      case "GET":
        return strings.get(k) ?? null;
      case "SET":
        strings.set(k, String(a[1]));
        return "OK";
      case "HSET": {
        const h = hash(k);
        let added = 0;
        for (let i = 1; i + 1 < a.length; i += 2) {
          if (!h.has(String(a[i]))) added++;
          h.set(String(a[i]), String(a[i + 1]));
        }
        return added;
      }
      case "HGET":
        return hashes.get(k)?.get(String(a[1])) ?? null;
      case "HDEL":
        return hashes.get(k)?.delete(String(a[1])) ? 1 : 0;
      case "HGETALL":
        return [...(hashes.get(k) ?? [])].flat();
      case "HKEYS":
        return [...(hashes.get(k)?.keys() ?? [])];
      case "SADD": {
        const s = sets.get(k) ?? new Set<string>();
        sets.set(k, s);
        const had = s.has(String(a[1]));
        s.add(String(a[1]));
        return had ? 0 : 1;
      }
      case "SCARD":
        return sets.get(k)?.size ?? 0;
      case "DEL":
        return [strings.delete(k), hashes.delete(k), sets.delete(k)].some(
          Boolean,
        )
          ? 1
          : 0;
      case "EXPIRE":
        return 1;
      default:
        throw new Error(`ERR unknown command '${name}'`);
    }
  }
  /** The `/pipeline` body in, the `/pipeline` answer out. */
  function pipeline(cmds: Cmd[]): { result?: unknown; error?: string }[] {
    return cmds.map((c) => {
      try {
        return { result: exec(c) };
      } catch (e) {
        return { error: (e as Error).message };
      }
    });
  }
  return { exec, pipeline };
}

/** A `fetch` that answers like Upstash would, for in-process tests. */
export function fakeUpstashFetch(): typeof fetch {
  const r = fakeRedis();
  return (async (_url: unknown, init?: RequestInit) =>
    new Response(JSON.stringify(r.pipeline(JSON.parse(String(init?.body)))), {
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}
