import { describe, expect, it } from "vitest";
import type { Pulse } from "./model";
import { NotReady, postgresStore } from "./store";

/**
 * The Postgres store through real PostgREST and the public anon key, the way
 * production reaches it. Runs only beside the local stack (CourtQueue's
 * harness, with the People's Pulse migration applied twice on top):
 *
 *   export STACK=~/scratch/m906/pulse-stack
 *   node docs/product/badminton/verification/stack.mjs start
 *   node docs/product/badminton/verification/stack.mjs apply supabase/migrations/20261118000000_passport_pulse.sql
 *   set -a; . $STACK/env; set +a
 *   npx vitest run src/lib/pulse/store.stack.test.ts
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const live = !!URL && !!ANON && URL.includes("127.0.0.1:573");
const KEY = "pulse-local-stack-key-0123456789";

const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
const rid = () =>
  Array.from(
    { length: 8 },
    () => alphabet[Math.floor(Math.random() * 32)],
  ).join("");

const pulse = (over: Partial<Pulse> = {}): Pulse => ({
  id: rid(),
  question: "Should Vernon build a second sheet of ice?",
  description: null,
  options: [
    { id: "o1", label: "Yes" },
    { id: "o2", label: "No" },
  ],
  claim: null,
  sourceUrl: null,
  scope: { kind: "canada" },
  expiresAt: null,
  status: "live",
  createdAt: new Date().toISOString(),
  ...over,
});

const vote = (
  pulseId: string,
  voter: string,
  option = "o1",
  net = "net-a",
) => ({
  pulseId,
  voter,
  net,
  option,
  circle: rid(),
  via: null,
  province: "BC",
  city: "Vernon",
});

describe.skipIf(!live)("People's Pulse Postgres store (local stack)", () => {
  const store = live ? postgresStore(URL!, ANON!, KEY) : null!;

  it("creates, reads back, and refuses a taken id", async () => {
    const p = pulse({
      description: "Fair context.",
      scope: { kind: "province", province: "BC" },
    });
    expect(
      await store.create(p, { creator: `c-${p.id}`, net: `n-${p.id}` }, 10),
    ).toBe("ok");
    expect(
      await store.create(p, { creator: `c2-${p.id}`, net: `n2-${p.id}` }, 10),
    ).toBe("taken");
    const back = await store.get(p.id);
    expect(back).toMatchObject({
      id: p.id,
      question: p.question,
      description: "Fair context.",
      options: p.options,
      scope: { kind: "province", province: "BC" },
      status: "live",
      expiresAt: null,
    });
    expect(await store.get(rid())).toBeNull();
  });

  it("limits creations per creator or network per day", async () => {
    const net = `n-${rid()}`;
    for (let i = 0; i < 2; i++)
      expect(await store.create(pulse(), { creator: rid(), net }, 2)).toBe(
        "ok",
      );
    expect(await store.create(pulse(), { creator: rid(), net }, 2)).toBe(
      "limited",
    );
  });

  it("one vote per voter, valid answers only, a cap per network", async () => {
    const p = pulse();
    await store.create(p, { creator: rid(), net: rid() }, 10);
    expect(await store.vote(vote(p.id, "v1"), 2)).toBe("ok");
    expect(await store.vote(vote(p.id, "v1", "o2"), 2)).toBe("duplicate");
    expect(await store.vote(vote(p.id, "v2", "o9"), 2)).toBe("bad-option");
    expect(await store.vote(vote(p.id, "v2", "o2"), 2)).toBe("ok");
    expect(await store.vote(vote(p.id, "v3", "o2"), 2)).toBe("limited");
    expect(await store.vote(vote(p.id, "v3", "o2", "net-b"), 2)).toBe("ok");
    expect(await store.vote(vote(rid(), "v1"), 2)).toBe("missing");
    expect(await store.mine(p.id, "v1")).toMatchObject({ option: "o1" });
    expect(await store.mine(p.id, "nobody")).toBeNull();
    const rows = await store.votes(p.id);
    expect(rows).toHaveLength(3);
    expect(Object.keys(rows[0]!).sort()).toEqual([
      "at",
      "circle",
      "city",
      "option",
      "province",
      "via",
    ]);
  });

  it("holds the per-voter rule under a burst of simultaneous votes", async () => {
    const p = pulse();
    await store.create(p, { creator: rid(), net: rid() }, 10);
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, () =>
        store.vote(vote(p.id, "same-voter"), 100),
      ),
    );
    expect(outcomes.filter((o) => o === "ok")).toHaveLength(1);
    expect((await store.votes(p.id)).length).toBe(1);
  });

  it("holds the network cap under a burst", async () => {
    const p = pulse();
    await store.create(p, { creator: rid(), net: rid() }, 10);
    const outcomes = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        store.vote(vote(p.id, `burst-${i}`, "o1", "one-net"), 5),
      ),
    );
    expect(outcomes.filter((o) => o === "ok")).toHaveLength(5);
  });

  it("refuses votes once a Pulse has ended", async () => {
    const p = pulse({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    await store.create(p, { creator: rid(), net: rid() }, 10);
    expect(await store.vote(vote(p.id, "late"), 10)).toBe("closed");
  });

  it("lists live Pulses with counts; reports pause one; a moderator decides", async () => {
    const p = pulse();
    await store.create(p, { creator: rid(), net: rid() }, 10);
    await store.vote(vote(p.id, "a"), 10);
    const listed = (await store.list(200)).find((l) => l.pulse.id === p.id);
    expect(listed).toMatchObject({ total: 1, lastDay: 1 });
    expect(await store.report(p.id, "r1", "misleading", null)).toBe("ok");
    expect(await store.report(p.id, "r1", "spam", null)).toBe("duplicate");
    expect(await store.report(p.id, "r2", "spam", "an ad")).toBe("ok");
    expect((await store.get(p.id))?.status).toBe("live");
    expect(await store.report(p.id, "r3", "harassment", null)).toBe("ok");
    expect((await store.get(p.id))?.status).toBe("review");
    expect((await store.list(200)).some((l) => l.pulse.id === p.id)).toBe(
      false,
    );
    expect(await store.vote(vote(p.id, "b"), 10)).toBe("closed");
    const queued = (await store.reported()).find((r) => r.pulse.id === p.id);
    expect(queued?.reports.map((r) => r.reason)).toEqual([
      "misleading",
      "spam",
      "harassment",
    ]);
    expect(await store.setStatus(p.id, "live")).toBe(true);
    expect(await store.vote(vote(p.id, "b"), 10)).toBe("ok");
    expect(await store.setStatus(p.id, "removed")).toBe(true);
    expect(await store.report(p.id, "r4", "spam", null)).toBe("missing");
  });

  it("refuses a different key, and the anon key reads no table", async () => {
    const intruder = postgresStore(URL!, ANON!, "someone-elses-key-0123456789");
    await expect(intruder.list(10)).rejects.toBeInstanceOf(NotReady);
    for (const table of [
      "passport_pulses",
      "passport_pulse_votes",
      "passport_pulse_reports",
      "passport_pulse_keys",
    ]) {
      const res = await fetch(`${URL}/rest/v1/${table}?select=*`, {
        headers: { apikey: ANON!, Authorization: `Bearer ${ANON}` },
      });
      const body = await res.json();
      expect(res.ok && Array.isArray(body) && body.length > 0).toBe(false);
    }
  });
});
