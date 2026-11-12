import { describe, expect, it } from "vitest";
import { as, club, must, night, ORG, T0 } from "./testkit";
import { playerStats, clubTable } from "./stats";
import { cleanEmail } from "./service";
import { emptyClub, tidyClub, type Club } from "./model";
import { nightView } from "./view";

/** The live launch (2026-11-12): 25 players, four doubles courts, scores. */

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

function fullRoom() {
  const c = club(25, undefined, 4);
  let s = night();
  for (const id of ids(25)) {
    s = must(c, s, as(id), { type: "register" }, T0);
    s = must(c, s, as(id), { type: "check-in" }, T0);
  }
  for (const id of ids(25)) s = must(c, s, as(id), { type: "play" }, T0);
  return { c, s };
}

describe("four courts, 25 players", () => {
  it("calls four games at once, 16 players, nobody twice", () => {
    const { s } = fullRoom();
    const called = s.games.filter((g) => g.status === "called");
    expect(called.map((g) => g.court).sort()).toEqual([1, 2, 3, 4]);
    const all = called.flatMap((g) => g.slots);
    expect(new Set(all).size).toBe(16);
    expect(s.queue).toHaveLength(9);
  });

  it("upgrades a stored three-court club to four, once", () => {
    const old = emptyClub() as Club;
    old.courts = old.courts.slice(0, 3);
    const t = tidyClub(old);
    expect(t.courts.map((x) => x.id)).toEqual([1, 2, 3, 4]);
    expect(tidyClub(t)).toBe(t);
  });

  it("rotates: a finished court is refilled from the line, never double-booked", () => {
    const room = fullRoom();
    const c = room.c;
    let s = room.s;
    const g1 = s.games.find((g) => g.court === 1)!;
    for (const g of s.games)
      s = must(c, s, ORG, { type: "start", gameId: g.id }, T0 + 60_000);
    s = must(
      c,
      s,
      as(g1.slots[0]!),
      { type: "finish", gameId: g1.id, score: [21, 15] },
      T0 + 20 * 60_000,
    );
    // the four tap back in themselves
    for (const id of g1.slots)
      s = must(c, s, as(id!), { type: "play" }, T0 + 21 * 60_000);
    const active = s.games.filter(
      (g) => g.status === "called" || g.status === "playing",
    );
    expect(active).toHaveLength(4);
    const players = active.flatMap((g) => g.slots);
    expect(new Set(players).size).toBe(players.length);
    expect(new Set(active.map((g) => g.court)).size).toBe(4);
  });
});

describe("scores, wins and losses", () => {
  it("records the final score, shows it to the four, and counts wins and losses", () => {
    const room = fullRoom();
    const c = room.c;
    let s = room.s;
    const g = s.games.find((x) => x.court === 2)!;
    s = must(c, s, ORG, { type: "start", gameId: g.id }, T0 + 60_000);
    s = must(
      c,
      s,
      as(g.slots[2]!),
      { type: "finish", gameId: g.id, score: [18, 21] },
      T0 + 25 * 60_000,
    );
    const done = s.games.find((x) => x.id === g.id)!;
    expect(done.score).toEqual([18, 21]);
    expect(done.winner).toBe(1);
    const win = playerStats(c, [s], g.slots[3]!);
    const lose = playerStats(c, [s], g.slots[0]!);
    expect([win.wins, win.losses, win.games]).toEqual([1, 0, 1]);
    expect([lose.wins, lose.losses, lose.games]).toEqual([0, 1, 1]);
    const v = nightView(c, s, g.slots[0]!, T0 + 26 * 60_000);
    expect(v.recent[0]!.score).toEqual([18, 21]);
    const rows = clubTable(c, [s]);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.name)).toEqual(
      [...rows.map((r) => r.name)].sort((a, b) => a.localeCompare(b)),
    );
  });

  it("lets a score be added or fixed afterwards; refuses ties and junk", () => {
    const room = fullRoom();
    const c = room.c;
    let s = room.s;
    const g = s.games.find((x) => x.court === 1)!;
    s = must(c, s, ORG, { type: "start", gameId: g.id }, T0 + 60_000);
    s = must(
      c,
      s,
      as(g.slots[0]!),
      { type: "finish", gameId: g.id },
      T0 + 25 * 60_000,
    );
    expect(s.games.find((x) => x.id === g.id)!.score).toBeUndefined();
    s = must(
      c,
      s,
      as(g.slots[1]!),
      { type: "score", gameId: g.id, score: [21, 19] },
      T0 + 26 * 60_000,
    );
    expect(s.games.find((x) => x.id === g.id)!.winner).toBe(0);
    const bad = (score: unknown) =>
      expect(
        (() => {
          try {
            must(
              c,
              s,
              as(g.slots[1]!),
              { type: "score", gameId: g.id, score: score as [number, number] },
              T0 + 27 * 60_000,
            );
            return "ok";
          } catch {
            return "refused";
          }
        })(),
      ).toBe("refused");
    bad([21, 21]);
    bad([-1, 5]);
    bad([1.5, 3]);
    bad("21-19");
  });

  it("only the four (or an organizer) can score a game", () => {
    const room = fullRoom();
    const c = room.c;
    let s = room.s;
    const g = s.games.find((x) => x.court === 1)!;
    s = must(c, s, ORG, { type: "start", gameId: g.id }, T0 + 60_000);
    s = must(c, s, ORG, { type: "finish", gameId: g.id }, T0 + 20 * 60_000);
    const outsider = ids(25).find((id) => !g.slots.includes(id))!;
    expect(() =>
      must(
        c,
        s,
        as(outsider),
        { type: "score", gameId: g.id, score: [21, 10] },
        T0 + 21 * 60_000,
      ),
    ).toThrow();
    expect(() =>
      must(
        c,
        s,
        ORG,
        { type: "score", gameId: g.id, score: [21, 10] },
        T0 + 21 * 60_000,
      ),
    ).not.toThrow();
  });
});

describe("email", () => {
  it("accepts a real address and refuses the rest", () => {
    expect(cleanEmail("  Ann@Example.COM ")).toBe("ann@example.com");
    for (const bad of ["", "ann", "ann@", "a b@c.com", "ann@x", 5, null])
      expect(cleanEmail(bad)).toBeNull();
  });
});
