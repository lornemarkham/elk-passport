import { describe, expect, it } from "vitest";
import { inOrder } from "./fair";
import { dashboard, ledger, priority } from "./fairness";
import { MINUTE, type Club, type Game, type Session } from "./model";
import { T0, as, club, must, night } from "./testkit";

function here(c: Club, s: Session, who: string[], now: number) {
  for (const id of who) {
    s = must(c, s, as(id), { type: "register" }, now);
    s = must(c, s, as(id), { type: "check-in" }, now);
  }
  return s;
}

/** A finished game, `from`..`to` minutes after T0, on a court. */
function played(
  slots: [string, string, string, string],
  court: 1 | 2 | 3,
  from: number,
  to: number,
): Game {
  return {
    id: `g${from}${court}`,
    court,
    slots,
    source: "fair",
    why: [],
    status: "finished",
    calledAt: T0 + from * MINUTE,
    accepted: {},
    declined: [],
    waitedSince: Object.fromEntries(
      slots.map((id) => [id, T0 + (from - 5) * MINUTE]),
    ),
    startedAt: T0 + from * MINUTE,
    finishedAt: T0 + to * MINUTE,
    kudos: [],
  };
}

describe("the ledger", () => {
  it("counts minutes, games, courts and partners from the games alone", () => {
    const c = club(8);
    const s = here(c, night(), ["p1", "p2", "p3", "p4", "p5", "p6"], T0);
    s.games.push(
      played(["p1", "p2", "p3", "p4"], 1, 5, 17),
      played(["p1", "p5", "p3", "p6"], 2, 25, 40),
    );
    const l = ledger(s, T0 + 60 * MINUTE).get("p1")!;
    expect(l.played).toBe(27);
    expect(l.games).toBe(2);
    expect(l.byCourt).toEqual({ 1: 12, 2: 15 });
    expect(l.partners).toEqual({ p2: 1, p5: 1 });
    expect(l.playedWith.sort()).toEqual(["p2", "p3", "p4", "p5", "p6"]);
    expect(l.lastEndedAt).toBe(T0 + 40 * MINUTE);
    expect(l.waited).toBe(10);
  });

  it("keeps a break out of waiting and out of played minutes", () => {
    const c = club(5);
    const s = here(c, night(), ["p1"], T0);
    s.games.push(played(["p1", "p2", "p3", "p4"], 1, 0, 12));
    // On a 12-minute game, then 20 minutes with a drink, then back in line.
    s.queue = [{ playerId: "p1", since: T0 + 32 * MINUTE }];
    const l = ledger(s, T0 + 40 * MINUTE).get("p1")!;
    expect(l.played).toBe(12);
    expect(l.waitingNow).toBe(8);
    expect(l.breakMinutes).toBe(40 - 12 - (5 + 8)); // here 40, on court 17 (incl. call), in line 13
  });
});

describe("priority", () => {
  it("is plain waiting when court time is close", () => {
    expect(priority(10, 30, 32)).toBe(10);
    expect(priority(10, 36, 32)).toBe(10);
  });
  it("rewards the underserved and holds back the over-served", () => {
    expect(priority(10, 10, 34)).toBeGreaterThan(priority(20, 34, 34));
    // 38 min played against a 22 average, 10 min longer in line.
    expect(priority(20, 38, 22)).toBeLessThan(priority(10, 22, 22));
  });
});

describe("the line", () => {
  it("serves the player far behind ahead of a longer waiter who has played a lot", () => {
    const c = club(8);
    const s = here(c, night(), ["p1", "p2", "p3", "p4"], T0);
    s.games.push(
      played(["p1", "p5", "p6", "p7"], 1, 0, 40),
      played(["p2", "p5", "p6", "p7"], 2, 0, 40),
      played(["p3", "p5", "p6", "p7"], 3, 0, 4),
    );
    s.queue = [
      { playerId: "p1", since: T0 + 41 * MINUTE },
      { playerId: "p3", since: T0 + 50 * MINUTE },
    ];
    const now = T0 + 60 * MINUTE;
    expect(inOrder(c, s, now).map((w) => w.playerId)).toEqual(["p3", "p1"]);
  });

  it("is first-come-first-served among players with similar court time", () => {
    const c = club(8);
    const s = here(c, night(), ["p1", "p2", "p3"], T0);
    s.queue = [
      { playerId: "p3", since: T0 + 5 * MINUTE },
      { playerId: "p1", since: T0 + 9 * MINUTE },
      { playerId: "p2", since: T0 + 1 * MINUTE },
    ];
    expect(inOrder(c, s, T0 + 20 * MINUTE).map((w) => w.playerId)).toEqual([
      "p2",
      "p3",
      "p1",
    ]);
  });
});

describe("the organizer's dashboard", () => {
  it("flags underserved players, says who is next, and ignores breaks", () => {
    const c = club(8);
    const s = here(c, night(), ["p1", "p2", "p3", "p4", "p5"], T0);
    s.games.push(
      played(["p2", "p3", "p4", "p6"], 1, 0, 40),
      played(["p2", "p3", "p4", "p6"], 2, 40, 50),
      played(["p1", "p7", "p8", "p6"], 3, 0, 8),
    );
    s.status = "live";
    // p1 is waiting; p5 has been out on a break and is not in the line.
    s.queue = [{ playerId: "p1", since: T0 + 55 * MINUTE }];
    const d = dashboard(c, s, T0 + 70 * MINUTE, new Map([["p1", 2]]));
    const row = (id: string) => d.rows.find((r) => r.playerId === id)!;
    expect(row("p1").need).toBe("red");
    expect(row("p1").next).toBe(2);
    expect(d.recommendations[0]).toMatch(/NEEDS COURT TIME/);
    expect(d.recommendations[0]).toMatch(/Court 2/);
    expect(row("p5").status).toBe("break");
    expect(row("p5").waiting).toBe(0);
    expect(row("p5").need).toBeNull(); // a break is never a grievance
  });
});
