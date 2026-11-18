import { beforeEach, describe, expect, it } from "vitest";
import {
  BALLOT_MIN_AGE_MS,
  CREATES_PER_DAY,
  NET_CAP_PER_PULSE,
  ballotProblem,
  ballotToken,
  castVote,
  circleCode,
  createPulse,
  forgetCachedVotes,
  newDevice,
  reportPulse,
  shelves,
  snapshot,
} from "./service";
import { memoryStore, type PulseStore } from "./store";

const KEY = "test-key-for-peoples-pulse-0123456789";
let clock = new Date("2026-11-18T18:00:00Z");
const tick = (ms: number) => (clock = new Date(clock.getTime() + ms));
let store: PulseStore;

beforeEach(() => {
  clock = new Date("2026-11-18T18:00:00Z");
  store = memoryStore(() => clock);
  forgetCachedVotes();
});

async function make(
  overrides: Record<string, unknown> = {},
  who = { device: newDevice(), ip: "ip:10.0.0.1" },
) {
  const r = await createPulse(
    store,
    KEY,
    {
      question: "Should Vernon build a second sheet of ice?",
      options: ["Yes", "No"],
      openedAt: clock.getTime() - 10_000,
      ...overrides,
    },
    { ...who, now: clock },
  );
  if (!r.ok) throw new Error(r.message);
  return r.pulse;
}

function ballot(id: string) {
  const b = ballotToken(KEY, id, new Date(clock.getTime() - 5_000));
  return b;
}

async function vote(
  id: string,
  device: string,
  option: string,
  extra: Record<string, unknown> = {},
  ip = `ip:${device.slice(0, 6)}`,
) {
  tick(1_000);
  return castVote(
    store,
    KEY,
    id,
    { option, ballot: ballot(id), ...extra },
    { device, ip, now: clock },
  );
}

describe("People's Pulse, end to end on the memory store", () => {
  it("creates a Pulse, takes votes, and shows results only after voting", async () => {
    const p = await make();
    const alice = newDevice();
    const before = await snapshot(store, KEY, p.id, alice, clock, false);
    expect(before?.results).toBeNull();
    expect(before?.total).toBe(0);
    expect((await vote(p.id, alice, "o1")).ok).toBe(true);
    const after = await snapshot(store, KEY, p.id, alice, clock, false);
    expect(after?.me.option).toBe("o1");
    expect(after?.results?.everyone.map((s) => s.n)).toEqual([1, 0]);
  });

  it("counts one vote per browser: a second vote changes nothing", async () => {
    const p = await make();
    const bob = newDevice();
    expect(await vote(p.id, bob, "o1")).toEqual({ ok: true, outcome: "ok" });
    expect(await vote(p.id, bob, "o2")).toEqual({
      ok: true,
      outcome: "duplicate",
    });
    const s = await snapshot(store, KEY, p.id, bob, clock, false);
    expect(s?.total).toBe(1);
    expect(s?.me.option).toBe("o1");
  });

  it("caps votes from one network on one Pulse", async () => {
    const p = await make();
    for (let i = 0; i < NET_CAP_PER_PULSE; i++)
      expect(
        (await vote(p.id, newDevice(), "o1", {}, "ip:203.0.113.9")).ok,
      ).toBe(true);
    const r = await vote(p.id, newDevice(), "o1", {}, "ip:203.0.113.9");
    expect(r).toMatchObject({ ok: false, outcome: "limited" });
  });

  it("refuses votes without a real, aged ballot from the page", async () => {
    const p = await make();
    const d = newDevice();
    const r = await castVote(
      store,
      KEY,
      p.id,
      { option: "o1" },
      { device: d, ip: "ip:x", now: clock },
    );
    expect(r).toMatchObject({ ok: false, outcome: "bot" });
    expect(ballotProblem(KEY, p.id, ballotToken(KEY, p.id, clock), clock)).toBe(
      "too-fast",
    );
    expect(
      ballotProblem(
        KEY,
        p.id,
        ballotToken(KEY, p.id, clock),
        new Date(clock.getTime() + BALLOT_MIN_AGE_MS),
      ),
    ).toBeNull();
    expect(
      ballotProblem(
        KEY,
        "zzzz2222",
        ballotToken(KEY, p.id, clock),
        new Date(clock.getTime() + 5000),
      ),
    ).toBe("forged");
  });

  it("refuses a form sent faster than a person, or with the hidden field filled", async () => {
    const quick = await createPulse(
      store,
      KEY,
      {
        question: "Is this a bot?",
        options: ["Yes", "No"],
        openedAt: clock.getTime() - 200,
      },
      { device: newDevice(), ip: "ip:a", now: clock },
    );
    expect(quick).toMatchObject({ ok: false, error: "bot" });
    const honey = await createPulse(
      store,
      KEY,
      {
        question: "Is this a bot?",
        options: ["Yes", "No"],
        openedAt: 0,
        website: "http://x",
      },
      { device: newDevice(), ip: "ip:a", now: clock },
    );
    expect(honey).toMatchObject({ ok: false, error: "bot" });
  });

  it("limits how many Pulses one browser or network makes a day", async () => {
    const who = { device: newDevice(), ip: "ip:198.51.100.4" };
    for (let i = 0; i < CREATES_PER_DAY; i++)
      await make({ question: `Question number ${i}?` }, who);
    const r = await createPulse(
      store,
      KEY,
      { question: "One too many?", options: ["Yes", "No"], openedAt: 0 },
      { ...who, device: newDevice(), now: clock },
    );
    expect(r).toMatchObject({ ok: false, error: "limited" });
  });

  it("attributes votes to the sharer's circle through referral links", async () => {
    const host = newDevice();
    const p = await make({}, { device: host, ip: "ip:host" });
    const hostCode = circleCode(KEY, p.id, host);
    // Five friends arrive through the host's link; one shares onward.
    const friends = Array.from({ length: 5 }, () => newDevice());
    for (const [i, f] of friends.entries())
      await vote(p.id, f, i < 4 ? "o2" : "o1", { via: hostCode });
    const friendOfFriend = newDevice();
    await vote(p.id, friendOfFriend, "o2", {
      via: circleCode(KEY, p.id, friends[0]!),
    });
    // Ten strangers find it elsewhere.
    for (let i = 0; i < 10; i++) await vote(p.id, newDevice(), "o1");
    await vote(p.id, host, "o1");

    const s = await snapshot(store, KEY, p.id, host, clock, false);
    expect(s?.results?.total).toBe(17);
    expect(s?.results?.circle?.joinedViaYou).toBe(5);
    expect(s?.results?.circle?.total).toBe(7); // host + 5 friends + 1 friend-of-friend
    expect(s?.results?.circle?.counted).toBe(5);
    // Everyone leans Yes; the circle leans No.
    expect(s?.results?.everyone[0]!.pct).toBeGreaterThan(50);
    expect(s?.results?.circle?.shares?.[1]!.pct).toBeGreaterThan(50);
  });

  it("ignores a referral code that is your own", async () => {
    const p = await make();
    const d = newDevice();
    await vote(p.id, d, "o1", { via: circleCode(KEY, p.id, d) });
    const rows = await store.votes(p.id);
    expect(rows[0]!.via).toBeNull();
  });

  it("filters by self-reported province and city", async () => {
    const p = await make({ scope: { kind: "province", province: "BC" } });
    for (let i = 0; i < 6; i++)
      await vote(p.id, newDevice(), i < 4 ? "o1" : "o2", {
        province: "BC",
        city: "vernon",
      });
    for (let i = 0; i < 5; i++)
      await vote(p.id, newDevice(), "o2", { province: "AB", city: "Calgary" });
    await vote(p.id, newDevice(), "o1", { province: "ZZ", city: "Nowhere" });
    const s = await snapshot(store, KEY, p.id, newDevice(), clock, true);
    expect(s?.results?.provinces.map((x) => [x.key, x.total])).toEqual([
      ["BC", 6],
      ["AB", 5],
    ]);
    expect(s?.results?.cities.map((c) => c.name).sort()).toEqual([
      "Calgary, AB",
      "Vernon, BC",
    ]);
    expect(s?.results?.unplaced).toBe(1);
  });

  it("closes voting at the end date but keeps results visible", async () => {
    const p = await make({
      expiresAt: new Date(clock.getTime() + 2 * 3_600_000).toISOString(),
    });
    await vote(p.id, newDevice(), "o1");
    tick(3 * 3_600_000);
    expect(await vote(p.id, newDevice(), "o2")).toMatchObject({
      ok: false,
      outcome: "closed",
    });
    const s = await snapshot(store, KEY, p.id, newDevice(), clock, false);
    expect(s?.open).toBe(false);
    expect(s?.results?.total).toBe(1);
  });

  it("three reports pause a Pulse; it stops taking votes and leaves the shelves", async () => {
    const p = await make();
    await vote(p.id, newDevice(), "o1");
    const reporter = newDevice();
    expect(
      await reportPulse(store, KEY, p.id, { reason: "misleading" }, reporter),
    ).toBe("ok");
    expect(
      await reportPulse(store, KEY, p.id, { reason: "misleading" }, reporter),
    ).toBe("duplicate");
    expect(
      await reportPulse(store, KEY, p.id, { reason: "nope" }, newDevice()),
    ).toBe("invalid");
    await reportPulse(store, KEY, p.id, { reason: "spam" }, newDevice());
    await reportPulse(
      store,
      KEY,
      p.id,
      { reason: "harassment", note: "names a neighbour" },
      newDevice(),
    );
    expect((await store.get(p.id))?.status).toBe("review");
    expect(await vote(p.id, newDevice(), "o1")).toMatchObject({
      ok: false,
      outcome: "closed",
    });
    expect(shelves(await store.list(50), clock).recent).toHaveLength(0);
    const queue = await store.reported();
    expect(queue[0]!.reports.map((r) => r.reason)).toEqual([
      "misleading",
      "spam",
      "harassment",
    ]);
    // A moderator puts it back; a removed Pulse is gone.
    await store.setStatus(p.id, "live");
    expect((await vote(p.id, newDevice(), "o2")).ok).toBe(true);
    await store.setStatus(p.id, "removed");
    expect(
      await snapshot(store, KEY, p.id, newDevice(), clock, true),
    ).toBeNull();
  });

  it("never returns another voter's identity in results", async () => {
    const p = await make();
    const d = newDevice();
    await vote(p.id, d, "o1", { province: "BC" });
    const s = await snapshot(store, KEY, p.id, newDevice(), clock, true);
    const text = JSON.stringify(s);
    expect(text).not.toContain(d);
    expect(text).not.toContain(circleCode(KEY, p.id, d));
    expect(Object.keys((await store.votes(p.id))[0]!).sort()).toEqual([
      "at",
      "circle",
      "city",
      "option",
      "province",
      "via",
    ]);
  });

  it("puts Pulses on recent, popular and trending shelves", async () => {
    const quiet = await make({ question: "Quiet question here?" });
    tick(60_000);
    const busy = await make({ question: "Busy question here?" });
    for (let i = 0; i < 4; i++) await vote(busy.id, newDevice(), "o1");
    await vote(quiet.id, newDevice(), "o1");
    const s = shelves(await store.list(50), clock);
    expect(s.recent.map((c) => c.id)).toEqual([busy.id, quiet.id]);
    expect(s.popular.map((c) => c.id)).toEqual([busy.id, quiet.id]);
    expect(s.trending.map((c) => c.id)).toEqual([busy.id]);
  });
});
