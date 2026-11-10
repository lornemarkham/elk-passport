import { describe, expect, it } from "vitest";
import { applySession, unsound } from "./engine";
import { isActiveGame, type Session } from "./model";
import { NotReady, postgresStore } from "./store";
import { T0, as, club, must, night } from "./testkit";

/**
 * The Postgres store through real PostgREST and the public anon key, the way
 * production reaches it. Runs only beside the local stack:
 *
 *   node docs/product/badminton/verification/stack.mjs start
 *   set -a; . ~/passport/scratch/courtqueue-stack/env; set +a
 *   npx vitest run src/lib/courtqueue/store.stack.test.ts
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const live = !!URL && !!ANON && URL.includes("127.0.0.1:573");
const KEY = "courtqueue-local-stack-key-0123456789";

describe.skipIf(!live)("CourtQueue Postgres store (local stack)", () => {
  const store = live ? postgresStore(URL!, ANON!, KEY) : null!;
  const id = `test:${Date.now()}`;

  it("creates, reads and compare-and-swaps a document", async () => {
    expect(await store.put(id, { n: 1 }, 0)).toBe(true);
    expect(await store.put(id, { n: 1 }, 0)).toBe(false);
    const d = (await store.get([id])).get(id)!;
    expect(d).toEqual({ value: { n: 1 }, version: 1 });
    expect(await store.put(id, { n: 2 }, 1)).toBe(true);
    expect(await store.put(id, { n: 3 }, 1)).toBe(false);
    expect((await store.get([id])).get(id)!.value).toEqual({ n: 2 });
  });

  it("refuses a different key, and the anon key can't touch the table", async () => {
    const intruder = postgresStore(URL!, ANON!, "someone-elses-key-0123456789");
    await expect(intruder.get([id])).rejects.toBeInstanceOf(NotReady);
    const res = await fetch(
      `${URL}/rest/v1/passport_courtqueue_docs?select=*`,
      {
        headers: { apikey: ANON!, Authorization: `Bearer ${ANON}` },
      },
    );
    const body = await res.json();
    expect(res.ok && Array.isArray(body) && body.length > 0).toBe(false);
    const keys = await fetch(
      `${URL}/rest/v1/passport_courtqueue_keys?select=*`,
      {
        headers: { apikey: ANON!, Authorization: `Bearer ${ANON}` },
      },
    );
    const kb = await keys.json();
    expect(keys.ok && Array.isArray(kb) && kb.length > 0).toBe(false);
  });

  it("24 phones tapping PLAY at once against Postgres land exactly once", async () => {
    const c = club(24);
    let s = night();
    const ids = Array.from({ length: 24 }, (_, i) => `p${i + 1}`);
    for (const p of ids) {
      s = must(c, s, as(p), { type: "register" }, T0);
      s = must(c, s, as(p), { type: "check-in" }, T0);
    }
    const key = `${id}:night`;
    expect(await store.put(key, s, 0)).toBe(true);
    let conflicts = 0;
    await Promise.all(
      ids.map(async (p, i) => {
        for (let tries = 0; tries < 60; tries++) {
          const d = (await store.get([key])).get(key)!;
          const out = applySession(
            c,
            d.value as Session,
            as(p),
            { type: "play" },
            T0 + i,
          );
          if (!out.ok) throw new Error(out.error);
          if (await store.put(key, out.value, d.version)) return;
          conflicts++;
        }
        throw new Error(`${p} never landed`);
      }),
    );
    const final = (await store.get([key])).get(key)!.value as Session;
    expect(conflicts).toBeGreaterThan(0);
    expect(final.games.filter(isActiveGame)).toHaveLength(3);
    expect(final.queue).toHaveLength(12);
    expect(unsound(c, final)).toBeNull();
  }, 60_000);
});
