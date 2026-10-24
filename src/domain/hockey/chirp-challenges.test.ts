import { describe, expect, it } from "vitest";
import {
  challengePlan,
  renderBotRow,
  ruledPlan,
  worstPick,
  worstPlan,
  type BotRow,
  type ChallengeView,
  type Fan,
} from "./chirp";
import { LIBRARY } from "./chirp-library";

const LORNE = "11111111-1111-4111-8111-111111111111";
const ALEX = "22222222-2222-4222-8222-222222222222";
const SAM = "33333333-3333-4333-8333-333333333333";
const C = "c0000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-24T02:00:00Z");

const fans = new Map<string, Fan>([
  [LORNE, { id: LORNE, name: "Lorne", team: "CGY" }],
  [ALEX, { id: ALEX, name: "Alex", team: "VAN" }],
  [SAM, { id: SAM, name: "Sam", team: "MIN" }],
]);
const bet: ChallengeView = {
  id: C,
  kind: "bet",
  challenger: LORNE,
  target: ALEX,
  status: "open",
  side: "the Wild win",
};
const row = (over: Partial<BotRow>): BotRow => ({
  id: "m1",
  actor_id: LORNE,
  text: null,
  at: NOW.toISOString(),
  bot_key: null,
  bot_line: null,
  bot_sig: null,
  ...over,
});
const ctx = (view: ChallengeView | undefined) => ({
  fans,
  verify: () => false,
  challengeOf: (id: string) => (id === view?.id ? view : undefined),
});
const plan = (over: Partial<Parameters<typeof challengePlan>[0]>) =>
  challengePlan({
    event: "issued",
    challenge: bet,
    userId: LORNE,
    rows: [],
    newestIsBot: false,
    now: NOW,
    level: "normal",
    seed: 7,
    ...over,
  });

describe("Chirp Bot on PLAY's challenges", () => {
  it("a thrown bet: a line from the bet pool, naming both people and the side", () => {
    const p = plan({})!;
    expect(p.key).toBe(`chal:${LORNE}:${C}`);
    expect(p.line.startsWith("ch.bet.")).toBe(true);
    const line = renderBotRow(
      row({ bot_key: p.key, bot_line: p.line }),
      ctx(bet),
    )!;
    expect(line.text).toContain("Lorne");
    expect(line.text).toContain("Alex");
    expect(line.text).toContain("the Wild win");
  });

  it("a challenge to defend: the target's team is the joke, not the target", () => {
    const defend: ChallengeView = {
      ...bet,
      kind: "defend",
      challenger: ALEX,
      target: LORNE,
      side: undefined,
    };
    const p = plan({ challenge: defend, userId: ALEX })!;
    const line = renderBotRow(
      row({ actor_id: ALEX, bot_key: p.key, bot_line: p.line }),
      ctx(defend),
    )!;
    expect(line.text).toMatch(/Flames/);
  });

  it("thrown is a heckle (cooldown, Quiet, never twice in a row); taken is a moment", () => {
    expect(plan({ level: "quiet" })).toBeNull();
    expect(plan({ newestIsBot: true })).toBeNull();
    const recent = row({
      bot_key: "bold:x",
      bot_line: "o.bd.1",
      at: new Date(NOW.getTime() - 60_000).toISOString(),
    });
    expect(plan({ rows: [recent] })).toBeNull();
    const taken = { ...bet, status: "accepted" as const };
    const took = plan({
      event: "accepted",
      challenge: taken,
      userId: ALEX,
      level: "quiet",
      newestIsBot: true,
    })!;
    expect(took.key).toBe(`took:${ALEX}:${C}`);
  });

  it("only the challenger's action can throw it, only the target's can take it", () => {
    expect(plan({ userId: SAM })).toBeNull();
    expect(
      plan({
        event: "accepted",
        challenge: { ...bet, status: "accepted" },
        userId: LORNE,
      }),
    ).toBeNull();
    // A forged row: Sam writes a "took" line about Alex's challenge.
    const forged = row({
      actor_id: SAM,
      bot_key: `took:${SAM}:${C}`,
      bot_line: "tk.1",
    });
    expect(
      renderBotRow(forged, ctx({ ...bet, status: "accepted" })),
    ).toBeNull();
    // A line from the wrong pool for the kind is refused.
    const wrongPool = row({
      bot_key: `chal:${LORNE}:${C}`,
      bot_line: "ch.defend.1",
    });
    expect(renderBotRow(wrongPool, ctx(bet))).toBeNull();
    // A line about a challenge that doesn't exist (or was declined) is refused.
    expect(
      renderBotRow(
        row({ bot_key: `chal:${LORNE}:${C}`, bot_line: "ch.bet.1" }),
        ctx(undefined),
      ),
    ).toBeNull();
    expect(
      renderBotRow(
        row({ bot_key: `chal:${LORNE}:${C}`, bot_line: "ch.bet.1" }),
        ctx({ ...bet, status: "declined" }),
      ),
    ).toBeNull();
  });

  it("a decline is never announced", () => {
    expect(
      plan({
        event: "accepted",
        challenge: { ...bet, status: "declined" },
        userId: ALEX,
      }),
    ).toBeNull();
  });

  it("the verdict shows only while the rows say so, and never from a model", () => {
    const won: ChallengeView = {
      ...bet,
      status: "accepted",
      winner: LORNE,
      decidedAt: NOW.toISOString(),
    };
    const p = ruledPlan({ challenge: won, rows: [], now: NOW, seed: 1 })!;
    expect(p.key).toBe(`ruled:${C}:${LORNE}`);
    const r = row({ actor_id: SAM, bot_key: p.key, bot_line: p.line });
    expect(renderBotRow(r, ctx(won))!.text).toMatch(
      /Lorne beats Alex|Alex lost a bet to Lorne/,
    );
    // The host corrects the call: Alex won after all. The old line disappears.
    expect(renderBotRow(r, ctx({ ...won, winner: ALEX }))).toBeNull();
    expect(
      renderBotRow(
        { ...r, bot_line: "ai", text: "Lorne wins!" },
        { ...ctx(won), verify: () => true },
      ),
    ).toBeNull();
    // Once per challenge, and not for a stale decision.
    expect(
      ruledPlan({
        challenge: won,
        rows: [row({ bot_key: p.key })],
        now: NOW,
        seed: 1,
      }),
    ).toBeNull();
    expect(
      ruledPlan({
        challenge: won,
        rows: [],
        now: new Date(NOW.getTime() + 7 * 3_600_000),
        seed: 1,
      }),
    ).toBeNull();
  });

  it("the spectacularly wrong pick needs two picks and a called score", () => {
    const picks = [
      { userId: LORNE, home: 1, away: 7 },
      { userId: ALEX, home: 3, away: 2 },
    ];
    expect(worstPick(picks, [3, 2])?.userId).toBe(LORNE);
    expect(worstPick(picks.slice(0, 1), [3, 2])).toBeNull();
    const p = worstPlan({
      now: NOW,
      startsAt: "2026-10-23T23:00:00Z",
      gameOver: true,
      actual: [3, 2],
      picks,
      rows: [],
      seed: 3,
    })!;
    expect(p.key).toMatch(new RegExp(`^worst:2026-10-23T2300:${LORNE}:1-7$`));
    expect(LIBRARY.get(p.line)?.text).toContain("{actual}");
  });

  it("every new library line is workplace-safe: no profanity, no bodies, no drinking dares", () => {
    const ids = [...LIBRARY.keys()].filter((id) =>
      /^(ch|tk|or|rl|wr)\./.test(id),
    );
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) {
      const text = LIBRARY.get(id)!.text;
      expect(text).not.toMatch(/\b(shit|fuck|drunk|chug|shots?)\b/i);
      expect(text.length).toBeLessThan(200);
    }
  });
});
