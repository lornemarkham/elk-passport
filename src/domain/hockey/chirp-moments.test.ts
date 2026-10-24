import { describe, expect, it } from "vitest";
import {
  LEAD_COOLDOWN_MS,
  LEAD_LINES_PER_GAME,
  ORGANIC_COOLDOWN_MS,
  donePlan,
  gameStamp,
  kindOfKey,
  leadPlan,
  renderBotRow,
  type BotKind,
  type BotRow,
  type Fan,
} from "./chirp";

/**
 * Chirp Bot notices the night's wins as they happen (2026-10-23): a secret
 * mission pulled off, a dare or side quest done, a new Sycle Cup leader.
 * Every plan is rendered back the way the page reads it.
 */

const LORNE = "11111111-1111-1111-1111-111111111111";
const DANNY = "33333333-3333-3333-3333-333333333333";
const fans = new Map<string, Fan>([
  [LORNE, { id: LORNE, name: "Lorne", team: "CGY" }],
  [DANNY, { id: DANNY, name: "Danny", team: "VAN" }],
]);
const START = "2026-10-26T02:00:00+00:00";
const NOW = new Date("2026-10-26T02:40:00Z");

let n = 0;
const row = (over: Partial<BotRow>): BotRow => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`,
  actor_id: LORNE,
  text: null,
  at: "2026-10-26T01:00:00Z",
  bot_key: null,
  bot_line: null,
  bot_sig: null,
  ...over,
});
const asPosted = (actor: string, plan: { key: string; line: string }) =>
  row({
    actor_id: actor,
    bot_key: plan.key,
    bot_line: plan.line,
    at: NOW.toISOString(),
  });
const render = (
  r: BotRow,
  claimHolds: (kind: BotKind, parts: readonly string[]) => boolean = () => true,
  pointsOf: (id: string) => number | undefined = () => 7,
) => renderBotRow(r, { fans, verify: () => false, claimHolds, pointsOf });

const done = {
  userId: DANNY,
  promptId: "toy-abc123",
  rows: [] as BotRow[],
  newestIsBot: false,
  now: NOW,
  level: "normal" as const,
  seed: 3,
};

describe("a secret mission pulled off", () => {
  it("is announced once, by name, never saying what it was", () => {
    const plan = donePlan({ ...done, family: "mission" })!;
    expect(plan.key).toBe(`mission:${DANNY}:toy-abc123`);
    expect(kindOfKey(plan.key)).toBe("mission");
    const line = render(asPosted(DANNY, plan))!;
    expect(line.text).toMatch(/Danny/);
    expect(line.about).toBe(DANNY);
    expect(
      donePlan({ ...done, family: "mission", rows: [asPosted(DANNY, plan)] }),
    ).toBeNull();
  });

  it("is one of the night's moments: it speaks even when the host has Chirp Bot quiet", () => {
    expect(
      donePlan({ ...done, family: "mission", level: "quiet" }),
    ).not.toBeNull();
    expect(
      donePlan({ ...done, family: "mission", newestIsBot: true }),
    ).not.toBeNull();
  });

  it("cannot be claimed for somebody else", () => {
    const plan = donePlan({ ...done, family: "mission" })!;
    expect(render(asPosted(LORNE, plan))).toBeNull();
  });
});

describe("a dare or side quest done", () => {
  it("is a heckle: quiet, the cooldown and never twice in a row hold", () => {
    const plan = donePlan({ ...done, family: "dare" })!;
    expect(plan.key).toBe(`done:${DANNY}:toy-abc123`);
    expect(render(asPosted(DANNY, plan))?.text).toMatch(/Danny/);
    expect(
      donePlan({ ...done, family: "sidequest", level: "quiet" }),
    ).toBeNull();
    expect(donePlan({ ...done, family: "dare", newestIsBot: true })).toBeNull();
    const recent = row({
      bot_key: "challenge:m1",
      bot_line: "o.ch.1",
      at: new Date(NOW.getTime() - ORGANIC_COOLDOWN_MS / 2).toISOString(),
    });
    expect(donePlan({ ...done, family: "dare", rows: [recent] })).toBeNull();
  });

  it("refuses a prompt id that would break the key", () => {
    expect(donePlan({ ...done, family: "dare", promptId: "a:b" })).toBeNull();
  });
});

describe("a Sycle Cup lead change during the game", () => {
  const base = {
    now: NOW,
    startsAt: START,
    gameOver: false,
    called: false,
    leader: { id: DANNY, points: 7 },
    rows: [] as BotRow[],
    seed: 1,
  };
  const stamp = gameStamp(START);

  it("names the new leader with their points, and shows only while they lead", () => {
    const plan = leadPlan(base)!;
    expect(plan.key).toBe(`lead:${stamp}:${DANNY}:1`);
    const posted = asPosted(LORNE, plan);
    const line = render(posted)!;
    expect(line.text).toMatch(/Danny/);
    expect(line.text).toMatch(/7 points/);
    expect(line.about).toBe(DANNY);
    // Somebody else leads now: the claim no longer holds, the line hides.
    expect(
      render(posted, (kind, parts) => kind === "lead" && parts[2] === LORNE),
    ).toBeNull();
  });

  it("is quiet while the same person keeps the lead, and waits out the cooldown", () => {
    const first = asPosted(LORNE, leadPlan(base)!);
    expect(leadPlan({ ...base, rows: [first] })).toBeNull();
    const soon = { ...base, rows: [first], leader: { id: LORNE, points: 9 } };
    expect(leadPlan(soon)).toBeNull();
    const later = new Date(NOW.getTime() + LEAD_COOLDOWN_MS + 1);
    expect(leadPlan({ ...soon, now: later })?.key).toBe(
      `lead:${stamp}:${LORNE}:2`,
    );
  });

  it("stops after four a game, never says a tie or zero, and leaves the end to the verdict", () => {
    const many = Array.from({ length: LEAD_LINES_PER_GAME }, (_, i) =>
      row({
        bot_key: `lead:${stamp}:${i % 2 ? LORNE : DANNY}:${i + 1}`,
        bot_line: "ld.1",
      }),
    );
    expect(
      leadPlan({ ...base, rows: many, leader: { id: LORNE, points: 20 } }),
    ).toBeNull();
    expect(leadPlan({ ...base, leader: null })).toBeNull();
    expect(leadPlan({ ...base, leader: { id: DANNY, points: 0 } })).toBeNull();
    expect(leadPlan({ ...base, gameOver: true, called: true })).toBeNull();
    expect(
      leadPlan({ ...base, now: new Date("2026-10-26T01:00:00Z") }),
    ).toBeNull();
  });
});
