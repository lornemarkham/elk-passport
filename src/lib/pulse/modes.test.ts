import { beforeEach, describe, expect, it } from "vitest";
import { checkDraft, checkRanking, checkReason } from "./model";
import { commonWords, rankItems, verdict } from "./modes";
import {
  ballotToken,
  castVote,
  countEvent,
  createPulse,
  forgetCachedVotes,
  newDevice,
  shelves,
  snapshot,
} from "./service";
import { memoryStore, type PulseStore } from "./store";
import { shares } from "./tally";

/**
 * Quick Ideas: Should I Do It?, Settle This, Is This Normal? and Rank These
 * on the one People's Pulse engine (memory store, same rules as Postgres).
 */

const KEY = "test-key-for-peoples-pulse-0123456789";
let clock = new Date("2026-11-19T18:00:00Z");
const tick = (ms: number) => (clock = new Date(clock.getTime() + ms));
let store: PulseStore;

beforeEach(() => {
  clock = new Date("2026-11-19T18:00:00Z");
  store = memoryStore(() => clock);
  forgetCachedVotes();
});

async function make(input: Record<string, unknown>) {
  const r = await createPulse(
    store,
    KEY,
    { openedAt: clock.getTime() - 10_000, ...input },
    { device: newDevice(), ip: `ip:${Math.random()}`, now: clock },
  );
  if (!r.ok) throw new Error(r.message);
  return r.pulse;
}

async function vote(
  id: string,
  input: Record<string, unknown>,
  device = newDevice(),
) {
  tick(1_000);
  return castVote(
    store,
    KEY,
    id,
    {
      ballot: ballotToken(KEY, id, new Date(clock.getTime() - 5_000)),
      ...input,
    },
    { device, ip: `ip:${device.slice(0, 6)}`, now: clock },
  );
}

const now = new Date("2026-11-19T18:00:00Z");

describe("creating each kind", () => {
  it("Should I Do It? is always Yes / No / Not yet, takes reasons, and is shared by link only", () => {
    const c = checkDraft(
      { kind: "decide", question: "Should I quit my job?", options: ["Maybe"] },
      now,
    );
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.draft.options.map((o) => o.label)).toEqual([
      "Yes",
      "No",
      "Not yet",
    ]);
    expect(c.draft.reasons).toBe(true);
    expect(c.draft.unlisted).toBe(true);
    expect(c.draft.kind).toBe("decide");
  });

  it("a decision can be listed publicly if the creator says so", () => {
    const c = checkDraft(
      { kind: "decide", question: "Should I quit my job?", unlisted: false },
      now,
    );
    expect(c.ok && c.draft.unlisted).toBeFalsy();
  });

  it("Settle This takes two to four sides", () => {
    const five = checkDraft(
      {
        kind: "settle",
        question: "Which movie tonight?",
        options: ["A", "B", "C", "D", "E"],
      },
      now,
    );
    expect(five).toMatchObject({ ok: false, field: "options" });
    const two = checkDraft(
      {
        kind: "settle",
        question: "Pineapple on pizza?",
        options: ["Yes", "No"],
      },
      now,
    );
    expect(two.ok).toBe(true);
  });

  it("Rank These needs at least three things", () => {
    expect(
      checkDraft(
        { kind: "rank", question: "Rank these movies", options: ["A", "B"] },
        now,
      ),
    ).toMatchObject({ ok: false, field: "options" });
  });

  it("Is This Normal? keeps ordered ranges, a unit and an optional category", () => {
    const c = checkDraft(
      {
        kind: "normal",
        question: "What does your household spend on groceries a month?",
        options: ["Under $400", "$400–$799", "$800–$1,199", "$1,200+"],
        unit: "per month",
        group: { label: "Household size", options: ["1", "2", "3–4", "5+"] },
      },
      now,
    );
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.draft.group?.options.map((g) => g.id)).toEqual([
      "g1",
      "g2",
      "g3",
      "g4",
    ]);
    expect(c.draft.unit).toBe("per month");
  });

  it("an unknown kind is an ordinary Pulse, and V1 drafts stay exactly as they were", () => {
    const c = checkDraft(
      {
        kind: "bogus",
        question: "Is this a question?",
        options: ["Yes", "No"],
      },
      now,
    );
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(Object.keys(c.draft).sort()).toEqual(
      [
        "claim",
        "description",
        "expiresAt",
        "options",
        "question",
        "scope",
        "sourceUrl",
      ].sort(),
    );
  });
});

describe("ballot parts", () => {
  const options = [
    { id: "o1", label: "A" },
    { id: "o2", label: "B" },
    { id: "o3", label: "C" },
  ];
  it("a ranking must name every answer exactly once", () => {
    expect(checkRanking(["o3", "o1", "o2"], options)).toBe("312");
    expect(checkRanking(["o3", "o1"], options)).toBeNull();
    expect(checkRanking(["o3", "o3", "o1"], options)).toBeNull();
    expect(checkRanking(["o3", "o1", "o9"], options)).toBeNull();
    expect(checkRanking("312", options)).toBeNull();
  });
  it("a reason is trimmed, and refused when it carries personal details", () => {
    expect(checkReason("  life is short  ")).toBe("life is short");
    expect(checkReason("")).toBeNull();
    expect(checkReason("call me at 250-555-1234")).toBe("problem");
  });
});

describe("Should I Do It?", () => {
  it("keeps reasons, shows them only from 5 votes, in steps of 5, with the common words", async () => {
    const p = await make({ kind: "decide", question: "Should I quit my job?" });
    const said = [
      ["o1", "Life is short and the job drains you"],
      ["o1", "You have savings, life is short"],
      ["o2", "Wait until the bonus pays out"],
      ["o3", "Line up the next job first"],
    ];
    for (const [option, reason] of said)
      expect((await vote(p.id, { option, reason })).ok).toBe(true);
    const four = await snapshot(store, KEY, p.id, newDevice(), clock, true);
    expect(four?.results?.modes.reasons?.groups).toBeNull();

    await vote(p.id, { option: "o1" });
    const five = await snapshot(store, KEY, p.id, newDevice(), clock, true);
    const yes = five?.results?.modes.reasons?.groups?.find(
      (g) => g.optionId === "o1",
    );
    expect(yes?.written).toBe(2);
    expect(yes?.quotes).toContain("You have savings, life is short");
    expect(yes?.words.map((w) => w.word)).toEqual(["life", "short"]);

    // A sixth vote with a reason is not shown until four more arrive.
    await vote(p.id, { option: "o2", reason: "The market is rough right now" });
    const six = await snapshot(store, KEY, p.id, newDevice(), clock, true);
    const no = six?.results?.modes.reasons?.groups?.find(
      (g) => g.optionId === "o2",
    );
    expect(no?.quotes).toEqual(["Wait until the bonus pays out"]);
  });

  it("refuses a reason with personal details instead of storing it", async () => {
    const p = await make({
      kind: "decide",
      question: "Should I move to Calgary?",
    });
    const r = await vote(p.id, {
      option: "o1",
      reason: "email me jo@example.com",
    });
    expect(r).toMatchObject({ ok: false, outcome: "bad-reason" });
  });

  it("ignores a reason on a Pulse that doesn't ask for them", async () => {
    const p = await make({
      question: "Is it cold out today?",
      options: ["Yes", "No"],
    });
    await vote(p.id, { option: "o1", reason: "brr" });
    expect((await store.votes(p.id))[0]?.reason).toBeNull();
  });

  it("is not on the public shelves", async () => {
    await make({ kind: "decide", question: "Should I quit my job?" });
    await make({ question: "Is it cold out today?", options: ["Yes", "No"] });
    const s = shelves(await store.list(50), clock);
    expect(s.recent.map((c) => c.question)).toEqual(["Is it cold out today?"]);
  });

  it("shows your circle's reasons only once your circle has 5", async () => {
    const host = newDevice();
    const p = await make({ kind: "decide", question: "Should I buy the van?" });
    await vote(p.id, { option: "o1", reason: "Road trips forever" }, host);
    const mine = await snapshot(store, KEY, p.id, host, clock, true);
    const code = mine!.me.circle;
    for (let i = 0; i < 3; i++)
      await vote(p.id, { option: "o2", via: code, reason: `No way ${i}` });
    expect(
      (await snapshot(store, KEY, p.id, host, clock, true))?.results?.modes
        .reasons?.circle,
    ).toBeNull();
    await vote(p.id, { option: "o3", via: code });
    const circle = (await snapshot(store, KEY, p.id, host, clock, true))
      ?.results?.modes.reasons?.circle;
    expect(circle).toHaveLength(4);
    expect(circle).toContain("Road trips forever");
  });
});

describe("Settle This", () => {
  it("calls it early, tied, close or settled — never more than the votes say", () => {
    const opts = [
      { id: "o1", label: "Pineapple" },
      { id: "o2", label: "No pineapple" },
    ];
    const v = (a: number, b: number) =>
      shares(opts, [
        ...Array.from({ length: a }, () => ({ option: "o1" })),
        ...Array.from({ length: b }, () => ({ option: "o2" })),
      ]);
    expect(verdict(v(2, 1), 3)).toEqual({ status: "early", needed: 2 });
    expect(verdict(v(3, 3), 6)).toMatchObject({ status: "tie" });
    expect(verdict(v(11, 10), 21)).toMatchObject({
      status: "close",
      winner: "Pineapple",
    });
    expect(verdict(v(8, 2), 10)).toMatchObject({
      status: "settled",
      winner: "Pineapple",
      pct: 80,
      margin: 60,
    });
  });
});

describe("Is This Normal?", () => {
  const groceries = {
    kind: "normal",
    question: "What does your household spend on groceries a month?",
    options: ["Under $400", "$400–$799", "$800–$1,199", "$1,200+"],
    group: { label: "Household size", options: ["1", "2+"] },
  };

  it("shows nothing — not even everyone — until 5, then moves in steps of 5", async () => {
    const p = await make(groceries);
    for (let i = 0; i < 4; i++) await vote(p.id, { option: "o2", group: "g1" });
    const four = await snapshot(store, KEY, p.id, newDevice(), clock, true);
    expect(four?.results?.total).toBe(4);
    expect(four?.results?.modes.normal?.everyone.shares).toBeNull();
    expect(four?.results?.everyone.every((s) => s.n === 0)).toBe(true);
    expect(four?.results?.provinces).toEqual([]);

    const me = newDevice();
    await vote(p.id, { option: "o3", group: "g2" }, me);
    const five = await snapshot(store, KEY, p.id, me, clock, true);
    const normal = five!.results!.modes.normal!;
    expect(normal.everyone.counted).toBe(5);
    expect(normal.everyone.median).toBe("$400–$799");
    expect(normal.you).toEqual({ below: 80, same: 20, above: 0 });
    // Category 1 has four votes: shown? no — four is under 5.
    expect(normal.groups).toEqual([]);
    expect(normal.hiddenGroups).toBe(5);

    await vote(p.id, { option: "o4", group: "g1" });
    const six = await snapshot(store, KEY, p.id, me, clock, true);
    expect(six?.results?.everyone.find((s) => s.optionId === "o4")?.n).toBe(0);
  });

  it("drops a category that isn't one of the Pulse's", async () => {
    const p = await make(groceries);
    await vote(p.id, { option: "o1", group: "g9" });
    expect((await store.votes(p.id))[0]?.group).toBeNull();
  });
});

describe("Rank These", () => {
  const movies = {
    kind: "rank",
    question: "Rank these for movie night",
    options: ["Dune", "Up", "Heat"],
  };

  it("needs a full ranking, records the first choice as the answer, and ranks by points", async () => {
    const p = await make(movies);
    expect(await vote(p.id, { ranking: ["o1", "o2"] })).toMatchObject({
      ok: false,
      outcome: "bad-ranking",
    });
    await vote(p.id, { ranking: ["o2", "o1", "o3"] });
    await vote(p.id, { ranking: ["o2", "o3", "o1"] });
    await vote(p.id, { ranking: ["o1", "o2", "o3"] });
    const rows = await store.votes(p.id);
    expect(rows.map((r) => r.option)).toEqual(["o2", "o2", "o1"]);
    const snap = await snapshot(store, KEY, p.id, newDevice(), clock, true);
    const items = snap!.results!.modes.ranking!.items;
    expect(items.map((i) => i.label)).toEqual(["Up", "Dune", "Heat"]);
    expect(items[0]).toMatchObject({ points: 5, average: 1.3, firstPct: 67 });
  });

  it("ignores rows without a full ranking when counting points", () => {
    const pulse = {
      id: "abcdefgh",
      question: "q",
      description: null,
      options: [
        { id: "o1", label: "A" },
        { id: "o2", label: "B" },
        { id: "o3", label: "C" },
      ],
      claim: null,
      sourceUrl: null,
      scope: { kind: "canada" as const },
      expiresAt: null,
      status: "live" as const,
      createdAt: now.toISOString(),
      kind: "rank" as const,
    };
    const row = (ranking: string | null) => ({
      option: "o1",
      province: null,
      city: null,
      at: now.toISOString(),
      circle: "aaaaaaaa",
      via: null,
      ranking,
    });
    expect(
      rankItems(pulse, [row("321"), row(null), row("32")])[0],
    ).toMatchObject({
      label: "C",
      points: 2,
    });
  });
});

describe("common words", () => {
  it("counts a word once per reason, skips filler, and needs two people", () => {
    expect(
      commonWords([
        "money money money",
        "the money is good",
        "I would travel",
        "travel more",
        "because",
      ]),
    ).toEqual([
      { word: "money", n: 2 },
      { word: "travel", n: 2 },
    ]);
  });
});

describe("usage", () => {
  it("counts Pulses, votes, referred votes, events and returning voters — counts only", async () => {
    const p = await make({
      kind: "settle",
      question: "Pineapple on pizza?",
      options: ["Yes", "No"],
      template: "which-to-buy",
    });
    const returning = newDevice();
    await vote(p.id, { option: "o1" }, returning);
    await vote(p.id, { option: "o2", via: "abcdefgh" });
    await countEvent(store, p.id, "share");
    await countEvent(store, p.id, "share");
    tick(86_400_000);
    const q = await make({
      question: "Is it cold out today?",
      options: ["Yes", "No"],
    });
    await vote(q.id, { option: "o1" }, returning);
    await countEvent(store, q.id, "link-open");

    const u = await store.usage(7);
    expect(u.daily.map((d) => d.day)).toEqual(["2026-11-20", "2026-11-19"]);
    expect(u.daily[1]).toMatchObject({
      created: 1,
      votes: 2,
      referredVotes: 1,
      events: { share: 2 },
    });
    expect(u.byKind).toEqual([
      { kind: "settle", created: 1, votes: 2 },
      { kind: "pulse", created: 1, votes: 1 },
    ]);
    expect(u.byTemplate).toEqual([{ template: "which-to-buy", created: 1 }]);
    expect(u.voters).toBe(2);
    expect(u.returningVoters).toBe(1);
    expect(JSON.stringify(u)).not.toContain(returning);
  });

  it("a count for a missing Pulse is not recorded", async () => {
    expect(await countEvent(store, "zzzzzzzz", "share")).toBe(false);
  });
});
