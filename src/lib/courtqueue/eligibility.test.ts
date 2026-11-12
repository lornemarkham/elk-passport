import { describe, expect, it } from "vitest";
import { applyClub, applySession, tick, type SessionCommand } from "./engine";
import { eligibleCourts, mayPlay, modeOf } from "./eligibility";
import { dashboard } from "./fairness";
import type { Level } from "./journey";
import { MINUTE, filled, tidyClub, type Club } from "./model";
import { organizerView } from "./view";
import { runNight } from "./eligibility.sim";
import { as, club, must, night, ORG, refused, T0 } from "./testkit";

/** Owner decision 2026-11-12: optional, configurable court eligibility. */

const level = (c: Club, id: string, l: Level) => {
  c.players[id]!.journey = { level: l, goals: [], practising: [], done: [] };
};

/** Eight players: p1–p4 advanced, p5–p8 beginners; court 2 is advanced-only. */
function setup(guided: boolean, courts = 2) {
  const c = club(8, undefined, courts);
  for (let i = 1; i <= 4; i++) level(c, `p${i}`, "advanced");
  for (let i = 5; i <= 8; i++) level(c, `p${i}`, "beginner");
  c.courts[1]!.minLevel = "advanced";
  if (guided) c.rules.mode = "guided";
  let s = night();
  for (let i = 1; i <= 8; i++) {
    s = must(c, s, as(`p${i}`), { type: "register" }, T0);
    s = must(c, s, as(`p${i}`), { type: "check-in" }, T0);
  }
  s = must(c, s, ORG, { type: "go-live" }, T0);
  return { c, s };
}
const playAll = (
  c: Club,
  s: ReturnType<typeof night>,
  ids: string[],
  at = T0,
) => {
  for (const id of ids) s = must(c, s, as(id), { type: "play" }, at);
  return s;
};

describe("open play is the default", () => {
  it("a new club is open and every player is eligible for every court", () => {
    const c = club(4);
    expect(modeOf(c)).toBe("open");
    expect(eligibleCourts(c, "p1")).toEqual(c.courts.map((x) => x.id));
  });

  it("ignores a court's minimum while the club is open", () => {
    const { c, s } = setup(false);
    expect(mayPlay(c, c.courts[1]!, "p5")).toBe(true);
    const out = playAll(c, s, ["p5", "p6", "p7", "p8", "p1", "p2", "p3", "p4"]);
    expect(out.games).toHaveLength(2);
  });
});

describe("guided play", () => {
  it("never puts a beginner on an advanced-only court", () => {
    const { c, s } = setup(true);
    const out = playAll(c, s, ["p5", "p6", "p7", "p8"]);
    // Four beginners wait; court 1 takes them, court 2 stays empty.
    expect(out.games.map((g) => g.court)).toEqual([1]);
    expect(
      out.games[0]!.slots.every((p) => ["p5", "p6", "p7", "p8"].includes(p!)),
    ).toBe(true);
  });

  it("an advanced player may play a beginner court", () => {
    const { c, s } = setup(true);
    const out = playAll(c, s, ["p1", "p2", "p3", "p4"]);
    expect(out.games).toHaveLength(1);
    expect(mayPlay(c, c.courts[0]!, "p1")).toBe(true);
  });

  it("gives the scarce advanced court first pick, so the open court takes the rest", () => {
    const { c, s } = setup(true);
    const out = playAll(c, s, ["p5", "p6", "p7", "p8", "p1", "p2", "p3", "p4"]);
    const adv = out.games.find((g) => g.court === 2)!;
    expect(filled(adv.slots).sort()).toEqual(["p1", "p2", "p3", "p4"]);
    const open = out.games.find((g) => g.court === 1)!;
    expect(filled(open.slots).sort()).toEqual(["p5", "p6", "p7", "p8"]);
  });

  it("a player nobody has placed is treated as a beginner, never on an advanced court", () => {
    const { c, s } = setup(true);
    delete c.players.p1!.journey;
    expect(mayPlay(c, c.courts[1]!, "p1")).toBe(false);
    const out = playAll(c, s, ["p1", "p2", "p3", "p4"]);
    // only three advanced players: court 2 stays empty, court 1 takes the four.
    expect(out.games.map((g) => g.court)).toEqual([1]);
  });

  it("the organizer's placement beats the player's own answer", () => {
    const { c } = setup(true);
    const r = applyClub(
      c,
      ORG,
      { type: "place", playerId: "p5", level: "advanced" },
      T0,
    );
    expect(r.ok && mayPlay(r.value, r.value.courts[1]!, "p5")).toBe(true);
    const back = applyClub(
      r.ok ? r.value : c,
      ORG,
      { type: "place", playerId: "p5", level: null },
      T0,
    );
    expect(back.ok && mayPlay(back.value, back.value.courts[1]!, "p5")).toBe(
      false,
    );
    expect(
      applyClub(
        c,
        as("p1"),
        { type: "place", playerId: "p5", level: "advanced" },
        T0,
      ).ok,
    ).toBe(false);
  });

  it("refuses to assign a beginner to an advanced court by hand", () => {
    const { c, s } = setup(true);
    const err = refused(
      c,
      s,
      ORG,
      { type: "assign", court: 2, slots: ["p1", "p2", "p3", "p5"] },
      T0,
    );
    expect(err).toMatch(/isn't eligible/);
  });

  it("does not let a challenge put a beginner on an advanced court", () => {
    const { c, s } = setup(true);
    s.closedCourts = [1];
    let x = must(
      c,
      s,
      as("p1"),
      { type: "challenge", slots: ["p1", "p2", "p3", "p5"] },
      T0,
    );
    for (const id of ["p2", "p3", "p5"])
      x = must(
        c,
        x,
        as(id),
        { type: "challenge-accept", challengeId: x.challenges[0]!.id },
        T0,
      );
    x = must(
      c,
      x,
      as("p1"),
      { type: "challenge-accept", challengeId: x.challenges[0]!.id },
      T0,
    );
    x = playAll(c, x, ["p1", "p2", "p3", "p5"]);
    expect(x.games.filter((g) => g.court === 2)).toHaveLength(0);
  });

  it("switching to guided mid-night returns an ineligible called game to the line", () => {
    const { c, s } = setup(false);
    let x = must(
      c,
      s,
      ORG,
      { type: "court-closed", court: 1, closed: true },
      T0,
    );
    x = playAll(c, x, ["p5", "p6", "p7", "p8"]);
    const g = x.games.find((q) => q.court === 2 && q.status === "called")!;
    expect(filled(g.slots)).toHaveLength(4); // beginners on the court asking for advanced
    const guided = applyClub(c, ORG, { type: "play-mode", mode: "guided" }, T0);
    expect(guided.ok).toBe(true);
    if (!guided.ok) return;
    const y = structuredClone(x);
    tick(guided.value, y, T0 + MINUTE);
    expect(y.games.find((q) => q.id === g.id)!.status).toBe("cancelled");
    expect(y.queue.map((q) => q.playerId).sort()).toEqual([
      "p5",
      "p6",
      "p7",
      "p8",
    ]);
  });
});

describe("configuring the courts", () => {
  it("is organizer-only", () => {
    const c = club(4);
    for (const cmd of [
      { type: "play-mode", mode: "guided" },
      { type: "courts-count", count: 6 },
      { type: "court", court: 1, patch: { minLevel: "advanced" } },
    ] as const)
      expect(applyClub(c, as("p1"), cmd as never, T0).ok).toBe(false);
  });

  it("supports any court count, and keeps it", () => {
    let c = club(4);
    for (const n of [6, 3, 12]) {
      const r = applyClub(c, ORG, { type: "courts-count", count: n }, T0);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      c = tidyClub(r.value);
      expect(c.courts.map((x) => x.id)).toEqual(
        Array.from({ length: n }, (_, i) => i + 1),
      );
    }
    expect(applyClub(c, ORG, { type: "courts-count", count: 0 }, T0).ok).toBe(
      false,
    );
    expect(applyClub(c, ORG, { type: "courts-count", count: 13 }, T0).ok).toBe(
      false,
    );
  });

  it("does not top a shortened club back up to four, but still upgrades a legacy three", () => {
    const three = club(4, undefined, 3);
    const t = tidyClub(three);
    expect(t.courts).toHaveLength(4);
    const r = applyClub(club(4), ORG, { type: "courts-count", count: 2 }, T0);
    expect(r.ok && tidyClub(r.value).courts).toHaveLength(2);
  });

  it("refuses to remove a court with a game on it", () => {
    const c = club(4);
    const r = applyClub(
      c,
      ORG,
      { type: "courts-count", count: 2 },
      T0,
      new Set([3]),
    );
    expect(r.ok).toBe(false);
  });

  it("fills a five-court venue", () => {
    const c = club(25, undefined, 4);
    const grown = applyClub(c, ORG, { type: "courts-count", count: 5 }, T0);
    expect(grown.ok).toBe(true);
    if (!grown.ok) return;
    let s = night();
    for (let i = 1; i <= 25; i++) {
      s = must(grown.value, s, as(`p${i}`), { type: "register" }, T0);
      s = must(grown.value, s, as(`p${i}`), { type: "check-in" }, T0);
    }
    s = must(grown.value, s, ORG, { type: "go-live" }, T0);
    s = playAll(
      grown.value,
      s,
      Array.from({ length: 25 }, (_, i) => `p${i + 1}`),
    );
    expect(s.games.map((g) => g.court).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("clears a court's minimum, and rejects nonsense", () => {
    const c = club(4);
    const a = applyClub(
      c,
      ORG,
      { type: "court", court: 1, patch: { minLevel: "intermediate" } },
      T0,
    );
    expect(a.ok && a.value.courts[0]!.minLevel).toBe("intermediate");
    const b = applyClub(
      a.ok ? a.value : c,
      ORG,
      { type: "court", court: 1, patch: { minLevel: null } },
      T0,
    );
    expect(b.ok && b.value.courts[0]!.minLevel).toBeUndefined();
    expect(
      applyClub(
        c,
        ORG,
        { type: "court", court: 1, patch: { minLevel: "wizard" } },
        T0,
      ).ok,
    ).toBe(false);
  });
});

describe("rotation", () => {
  const four = ["p1", "p2", "p3", "p4"];
  function playing(count = 12) {
    const c = club(count, undefined, 1);
    let s = night();
    for (let i = 1; i <= count; i++) {
      s = must(c, s, as(`p${i}`), { type: "register" }, T0);
      s = must(c, s, as(`p${i}`), { type: "check-in" }, T0);
    }
    s = must(c, s, ORG, { type: "go-live" }, T0);
    s = playAll(
      c,
      s,
      Array.from({ length: count }, (_, i) => `p${i + 1}`),
    );
    return { c, s };
  }
  const finish = (c: Club, s: ReturnType<typeof night>, at: number) => {
    const g = s.games.find(
      (x) => x.status === "called" || x.status === "playing",
    )!;
    s = must(c, s, ORG, { type: "start", gameId: g.id }, at);
    return {
      s: must(
        c,
        s,
        ORG,
        { type: "finish", gameId: g.id, score: [21, 12] },
        at + 15 * MINUTE,
      ),
      g,
    };
  };

  it("all four leave after a game; nobody stays on, and the same four are not called again", () => {
    const { c, s: s0 } = playing();
    const first = finish(c, s0, T0 + MINUTE);
    let s = first.s;
    // the four tap back in immediately; others have waited longer
    s = playAll(c, s, filled(first.g.slots));
    const next = s.games.find((g) => g.status === "called")!;
    expect(next.id).not.toBe(first.g.id);
    expect(
      filled(next.slots).filter((p) => filled(first.g.slots).includes(p)),
    ).toHaveLength(0);
  });

  it("the longest-waiting eligible players are called first", () => {
    const { s } = playing();
    const first = s.games[0]!;
    expect(filled(first.slots).sort()).toEqual(four); // equal waits, arrival order
  });

  it("a player who passes does not block the court: the next in line takes the place", () => {
    const { c, s } = playing();
    const g = s.games[0]!;
    const out = must(
      c,
      s,
      as("p2"),
      { type: "decline", gameId: g.id, pause: true },
      T0 + MINUTE,
    );
    const after = out.games.find((x) => x.id === g.id)!;
    expect(filled(after.slots)).toHaveLength(4);
    expect(after.slots).not.toContain("p2");
    expect(out.queue.some((q) => q.playerId === "p2")).toBe(false);
  });

  it("someone on a break is never called, and breaks are not counted as waiting", () => {
    const { c, s } = playing();
    const g = s.games[0]!;
    let x = must(c, s, as("p9"), { type: "pause" }, T0 + MINUTE);
    x = must(
      c,
      x,
      as("p1"),
      { type: "decline", gameId: g.id, pause: true },
      T0 + 2 * MINUTE,
    );
    expect(filled(x.games.find((q) => q.id === g.id)!.slots)).not.toContain(
      "p9",
    );
    void applySession;
  });
});

describe("fairness with eligibility", () => {
  it("names the eligible court the underplayed player should take next", () => {
    const { c, s } = setup(true, 3);
    c.courts[2]!.minLevel = "beginner";
    let x = playAll(c, s, ["p5", "p6", "p7", "p8"]);
    x.status = "live";
    const d = dashboard(c, x, T0 + 30 * MINUTE, {
      next: new Map(),
      line: [],
      freeing: [2, 1, 3],
    });
    const row = d.rows.find((r) => r.playerId === "p6")!;
    expect(row.eligible).toEqual([1, 3]);
    expect(row.next === null || row.next !== 2).toBe(true);
    x = night();
  });

  it("keeps statistics accurate when a game is corrected", () => {
    const { c, s } = setup(false);
    let x = playAll(c, s, ["p1", "p2", "p3", "p4"]);
    const g = x.games[0]!;
    x = must(c, x, ORG, { type: "start", gameId: g.id }, T0 + MINUTE);
    x = must(
      c,
      x,
      ORG,
      { type: "finish", gameId: g.id, score: [21, 9] },
      T0 + 21 * MINUTE,
    );
    const minutes = (st: typeof x, id: string) =>
      dashboard(c, st, T0 + 30 * MINUTE, {
        next: new Map(),
        line: [],
        freeing: [],
      }).rows.find((r) => r.playerId === id)!.played;
    expect(minutes(x, "p1")).toBe(20);
    const cmd: SessionCommand = {
      type: "correct",
      gameId: g.id,
      finishedAt: "20:11",
      reason: "Forgot to tap",
    };
    const fixed = must(c, x, ORG, cmd, T0 + 31 * MINUTE);
    expect(minutes(fixed, "p1")).toBe(10);
    expect(minutes(fixed, "p4")).toBe(10);
  });

  it("shows the organizer the mode, courts and unplaced players, and nothing about levels in open play", () => {
    const { c, s } = setup(false);
    const open = organizerView(c, s, T0);
    expect(open.mode).toBe("open");
    expect(open.placements).toEqual([]);
    c.rules.mode = "guided";
    const guided = organizerView(c, s, T0);
    expect(guided.mode).toBe("guided");
    expect(guided.placements.length).toBeGreaterThan(0);
  });
});

describe("a 25-player game night through the real engine", () => {
  const levels: (Level | null)[] = Array.from({ length: 25 }, (_, i) =>
    i < 9 ? "beginner" : i < 19 ? "intermediate" : "advanced",
  );

  function audit(r: ReturnType<typeof runNight>, guided: boolean) {
    const { club: c, session: s } = r;
    const games = s.games.filter((g) => g.status === "finished");
    for (const g of games) {
      expect(new Set(filled(g.slots)).size).toBe(4);
      if (guided) {
        const court = c.courts.find((x) => x.id === g.court)!;
        for (const p of filled(g.slots))
          expect(mayPlay(c, court, p)).toBe(true);
      }
    }
    return games;
  }

  it("open play: 4 courts, passes and breaks — everybody plays, spread is small, no instant repeats", () => {
    const r = runNight({
      seed: 7,
      passRate: 0.06,
      breakRate: 0.12,
      stallRate: 0.03,
    });
    const games = audit(r, false);
    expect(games.length).toBeGreaterThan(30);
    expect(r.passes).toBeGreaterThan(0);
    expect(r.breaks).toBeGreaterThan(0);
    const per = new Map<string, number>();
    for (const g of games)
      for (const p of filled(g.slots)) per.set(p, (per.get(p) ?? 0) + 1);
    const counts = Array.from(
      { length: 25 },
      (_, i) => per.get(`p${i + 1}`) ?? 0,
    );
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(5);
    // Nobody sits out while others play: and no foursome is ever repeated.
    const keys = games.map((g) => filled(g.slots).sort().join());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("guided play: beginners never reach the advanced court, intermediate court is intermediate-and-up", () => {
    const r = runNight({
      seed: 11,
      guided: true,
      levels,
      courtMins: [null, null, "intermediate", "advanced"],
      passRate: 0.05,
      breakRate: 0.1,
    });
    const games = audit(r, true);
    expect(games.length).toBeGreaterThan(30);
    const c = r.club;
    const advanced = games.filter((g) => g.court === 4);
    expect(advanced.length).toBeGreaterThan(0);
    for (const g of advanced)
      for (const p of filled(g.slots))
        expect(c.players[p]!.journey!.level).toBe("advanced");
    for (const g of games.filter((x) => x.court === 3))
      for (const p of filled(g.slots))
        expect(c.players[p]!.journey!.level).not.toBe("beginner");
    // Beginners still play a lot: courts 1 and 2 are theirs.
    const beginnerGames = games.filter((g) =>
      filled(g.slots).some((p) => c.players[p]!.journey!.level === "beginner"),
    );
    expect(beginnerGames.length).toBeGreaterThan(10);
  });

  it("guided play with five courts and a different layout", () => {
    const r = runNight({
      seed: 3,
      courts: 5,
      guided: true,
      levels,
      courtMins: [null, null, null, "intermediate", "advanced"],
    });
    const games = audit(r, true);
    expect(new Set(games.map((g) => g.court)).size).toBeGreaterThanOrEqual(4);
  });
});
