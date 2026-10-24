import { describe, expect, it } from "vitest";
import { LIBRARY } from "./chirp-library";
import {
  ORGANIC_COOLDOWN_MS,
  ROWDY_COOLDOWN_MS,
  boldestPick,
  chirpLevelOf,
  couchPlan,
  finalPlan,
  gameStamp,
  kindOfKey,
  organicAllowed,
  picksPlan,
  renderBotRow,
  switchPlan,
  type BotKind,
  type BotRow,
  type Fan,
} from "./chirp";

/**
 * Chirp Bot's moments for the rest of the night — the couch, picks sealed,
 * the final verdict, a jumped dinner vote — and the frequency the host sets.
 * Every plan here is rendered back the way the page would read it, because
 * a line that is posted but cannot be rendered is a line nobody sees.
 */

const LORNE = "11111111-1111-1111-1111-111111111111";
const DANNY = "33333333-3333-3333-3333-333333333333";
const PRIYA = "44444444-4444-4444-4444-444444444444";
const fans = new Map<string, Fan>([
  [LORNE, { id: LORNE, name: "Lorne", team: "CGY" }],
  [DANNY, { id: DANNY, name: "Danny", team: "VAN" }],
  [PRIYA, { id: PRIYA, name: "Priya", team: "EDM" }],
]);
const never = () => false;
const START = "2026-10-26T02:00:00+00:00";
const NOW = new Date("2026-10-26T02:05:00Z");

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

const rendered = (
  r: BotRow,
  claimHolds: (kind: BotKind, parts: readonly string[]) => boolean = () => true,
  optionLabel?: (id: string) => string | undefined,
  pointsOf?: (id: string) => number | undefined,
) =>
  renderBotRow(r, { fans, verify: never, claimHolds, optionLabel, pointsOf });

describe("keys", () => {
  it("a game time inside a key has no colons, so the key splits cleanly", () => {
    expect(gameStamp("2026-10-25T19:00:00-07:00")).toBe("2026-10-25T1900");
    expect(gameStamp(START)).not.toContain(":");
  });

  it("knows the new kinds by prefix", () => {
    expect(kindOfKey(`couch:${PRIYA}`)).toBe("couch");
    expect(kindOfKey("picks:x:y:1-0")).toBe("picks");
    expect(kindOfKey("final:x:y:5")).toBe("final");
    expect(kindOfKey("switch:a:b:c")).toBe("switch");
  });
});

describe("the couch", () => {
  it("welcomes a couch fan once, by name", () => {
    const plan = couchPlan({ userId: PRIYA, rows: [], seed: 1, today: "x" });
    expect(plan?.key).toBe(`couch:${PRIYA}`);
    const line = rendered(
      row({ actor_id: PRIYA, bot_key: plan!.key, bot_line: plan!.line }),
    );
    expect(line?.text).toContain("Priya");
    expect(line?.about).toBe(PRIYA);
    expect(
      couchPlan({
        userId: PRIYA,
        rows: [row({ bot_key: plan!.key, bot_line: plan!.line })],
        seed: 2,
        today: "x",
      }),
    ).toBeNull();
  });

  it("a couch line about somebody else, written by another member, is not shown", () => {
    expect(
      rendered(
        row({ actor_id: LORNE, bot_key: `couch:${PRIYA}`, bot_line: "cw.1" }),
      ),
    ).toBeNull();
  });
});

describe("picks sealed at puck drop", () => {
  const picks = [
    { userId: LORNE, home: 3, away: 2 },
    { userId: DANNY, home: 7, away: 1 },
    { userId: PRIYA, home: 4, away: 3 },
  ];

  it("the boldest call is the biggest margin, then the most goals", () => {
    expect(boldestPick(picks)?.userId).toBe(DANNY);
    expect(
      boldestPick([
        { userId: LORNE, home: 5, away: 3 },
        { userId: PRIYA, home: 3, away: 1 },
      ])?.userId,
    ).toBe(LORNE);
    expect(boldestPick([])).toBeNull();
  });

  it("reads out Danny's 7–1 once, after puck drop, and renders it", () => {
    const plan = picksPlan({
      now: NOW,
      startsAt: START,
      members: 3,
      picks,
      rows: [],
      seed: 4,
    });
    expect(plan).not.toBeNull();
    const line = rendered(
      row({ bot_key: plan!.key, bot_line: plan!.line }),
      (kind, parts) =>
        kind === "picks" && parts[2] === DANNY && parts[3] === "7-1",
    );
    expect(line?.text).toContain("Danny");
    expect(line?.text).toContain("7–1");
    expect(line?.about).toBe(DANNY);
    // Once per game time.
    expect(
      picksPlan({
        now: NOW,
        startsAt: START,
        members: 3,
        picks,
        rows: [row({ bot_key: plan!.key, bot_line: plan!.line })],
        seed: 5,
      }),
    ).toBeNull();
  });

  it("never before puck drop (picks are still sealed), nor hours later, nor alone", () => {
    const base = { startsAt: START, members: 3, picks, rows: [], seed: 1 };
    expect(
      picksPlan({ ...base, now: new Date("2026-10-26T01:59:00Z") }),
    ).toBeNull();
    expect(
      picksPlan({ ...base, now: new Date("2026-10-26T05:30:00Z") }),
    ).toBeNull();
    expect(picksPlan({ ...base, now: NOW, members: 1 })).toBeNull();
  });

  it("a line quoting a pick nobody made is not shown", () => {
    const forged = row({
      bot_key: `picks:${gameStamp(START)}:${LORNE}:9-0`,
      bot_line: "pk.1",
    });
    expect(rendered(forged, () => false)).toBeNull();
  });
});

describe("the final verdict", () => {
  const base = {
    now: new Date("2026-10-26T05:00:00Z"),
    startsAt: START,
    gameOver: true,
    called: true,
    leader: { id: LORNE, points: 8 },
    rows: [],
    seed: 2,
  };

  it("crowns the outright leader once, with their points as they stand", () => {
    const plan = finalPlan(base)!;
    expect(plan.key).toBe(`final:${gameStamp(START)}:${LORNE}`);
    const line = rendered(
      row({ actor_id: DANNY, bot_key: plan.key, bot_line: plan.line }),
      (kind, parts) => kind === "final" && parts[2] === LORNE,
      undefined,
      (id) => (id === LORNE ? 8 : undefined),
    );
    expect(line?.text).toContain("Lorne");
    expect(line?.text).toContain("8");
    expect(
      finalPlan({
        ...base,
        rows: [row({ bot_key: plan.key, bot_line: plan.line })],
      }),
    ).toBeNull();
  });

  it("a later call that changes the lead gives the new leader a verdict (2026-10-23 race)", () => {
    // The tick fired after the first call, with Lorne ahead…
    const first = finalPlan(base)!;
    const posted = [row({ bot_key: first.key, bot_line: first.line })];
    // …then the next call put Priya in front.
    const next = finalPlan({
      ...base,
      leader: { id: PRIYA, points: 9 },
      rows: posted,
    });
    expect(next?.key).toBe(`final:${gameStamp(START)}:${PRIYA}`);
    // Lorne's line no longer holds, so it isn't shown.
    expect(rendered(posted[0], (kind, parts) => parts[2] === PRIYA)).toBeNull();
  });

  it("says nothing before the game is over, before anything is called, or on a tie", () => {
    expect(finalPlan({ ...base, gameOver: false })).toBeNull();
    expect(finalPlan({ ...base, called: false })).toBeNull();
    expect(finalPlan({ ...base, leader: null })).toBeNull();
    expect(finalPlan({ ...base, leader: { id: LORNE, points: 0 } })).toBeNull();
  });

  it("a verdict that no longer matches the standings is not shown", () => {
    const plan = finalPlan(base)!;
    expect(
      rendered(row({ bot_key: plan.key, bot_line: plan.line }), () => false),
    ).toBeNull();
  });
});

describe("a jumped dinner vote", () => {
  const labels = (id: string) =>
    ({ a: "Chambar", b: "Shark Club" })[id] ?? undefined;
  const base = {
    userId: DANNY,
    from: "a",
    to: "b",
    rows: [],
    newestIsBot: false,
    now: NOW,
    level: "normal" as const,
    seed: 9,
  };

  it("names who jumped, from where, to where", () => {
    const plan = switchPlan(base)!;
    const line = rendered(
      row({ actor_id: DANNY, bot_key: plan.key, bot_line: plan.line }),
      undefined,
      labels,
    );
    expect(line?.text).toContain("Danny");
    expect(line?.text).toContain("Chambar");
    expect(line?.text).toContain("Shark Club");
  });

  it("is a heckle: quiet hosts, cooldowns and 'never twice in a row' apply", () => {
    expect(switchPlan({ ...base, level: "quiet" })).toBeNull();
    expect(switchPlan({ ...base, newestIsBot: true })).toBeNull();
    expect(switchPlan({ ...base, to: "a" })).toBeNull();
    const recent = row({
      bot_key: "bold:x",
      bot_line: "o.bd.1",
      at: new Date(NOW.getTime() - 60_000).toISOString(),
    });
    expect(switchPlan({ ...base, rows: [recent] })).toBeNull();
  });

  it("only about the person who moved their own vote, and only between real options", () => {
    expect(
      rendered(
        row({
          actor_id: LORNE,
          bot_key: `switch:${DANNY}:a:b`,
          bot_line: "o.sw.1",
        }),
        undefined,
        labels,
      ),
    ).toBeNull();
    expect(
      rendered(
        row({
          actor_id: DANNY,
          bot_key: `switch:${DANNY}:a:zzz`,
          bot_line: "o.sw.1",
        }),
        undefined,
        labels,
      ),
    ).toBeNull();
  });
});

describe("how much Chirp Bot talks", () => {
  it("reads the host's level, defaulting to normal", () => {
    expect(chirpLevelOf({})).toBe("normal");
    expect(chirpLevelOf({ chirpLevel: "quiet" })).toBe("quiet");
    expect(chirpLevelOf({ chirpLevel: "rowdy" })).toBe("rowdy");
    expect(chirpLevelOf({ chirpLevel: "maximum" })).toBe("normal");
  });

  it("quiet never heckles; rowdy heckles sooner than normal", () => {
    const last = row({
      bot_key: "bold:y",
      bot_line: "o.bd.2",
      at: new Date(NOW.getTime() - (ROWDY_COOLDOWN_MS + 1000)).toISOString(),
    });
    expect(organicAllowed([], false, NOW, "quiet")).toBe(false);
    expect(organicAllowed([last], false, NOW, "rowdy")).toBe(true);
    expect(organicAllowed([last], false, NOW, "normal")).toBe(
      ROWDY_COOLDOWN_MS + 1000 >= ORGANIC_COOLDOWN_MS,
    );
  });
});

describe("the new material keeps the rules", () => {
  it("roasts teams and moments, never a person's body, job, family or money", () => {
    const off =
      /\b(fat|ugly|stupid|idiot|wife|husband|kids|salary|broke|old man|weight|job)\b/i;
    for (const [id, line] of LIBRARY)
      if (/^(cw|pk|fv|o\.sw)\./.test(id))
        expect(line.text, id).not.toMatch(off);
  });
});
