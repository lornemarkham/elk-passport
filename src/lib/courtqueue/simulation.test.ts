import { describe, expect, it } from "vitest";
import { localHHMM } from "./clock";
import { applySession, unsound, type SessionCommand } from "./engine";
import {
  MINUTE,
  filled,
  isActiveGame,
  playedMinutes,
  type Session,
} from "./model";
import { registrationOpensAt } from "./schedule";
import { nightBalance } from "./stats";
import { ORG, T0, as, club, must, night, setMentor } from "./testkit";

/**
 * **A simulated Thursday.** 25 sign up on the day after 8:00 am, 24 turn
 * up, three courts, two hours. Players accept, walk on, play 10–18 minutes,
 * report a score, and tap BACK IN THE QUEUE when they've caught their breath
 * — nobody is put back in line for them; now and then someone sits one out. Four expert friends keep challenging each other. Two quiet
 * players are slow to tap anything. One player leaves early, one game
 * forgets START, one forgets FINISH and the organizer fixes it.
 *
 * The night is checked after every single step: never two games on a court,
 * never a player in two places, nobody is held off a court.
 */

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// p1..p4 are friends who like to play together; p5, p6 are quiet newcomers;
// p25 registers but doesn't come. 25 people, nobody rated.
const PLAYERS = 25;

export function simulate(seed = 7) {
  const random = rng(seed);
  let c = club(PLAYERS);
  c = setMentor(c, "p16");
  c = setMentor(c, "p24");
  let s: Session = night();
  const ids = Array.from({ length: PLAYERS }, (_, i) => `p${i + 1}`);
  const quiet = new Set(["p5", "p6"]);
  const friends = ["p1", "p2", "p3", "p4"];
  const step = (actor: typeof ORG, cmd: SessionCommand, now: number) => {
    const out = applySession(c, s, actor, cmd, now);
    if (out.ok) s = out.value;
    const broken = unsound(c, s);
    if (broken)
      throw new Error(`unsound at ${(now - T0) / MINUTE} min: ${broken}`);
    return out.ok;
  };
  // Sign-up opens at 8:00 am on the day; nobody can before.
  const opens = registrationOpensAt(s.date);
  for (const id of ids)
    if (step(as(id), { type: "register" }, opens - MINUTE))
      throw new Error("registered before 8:00 am");
  for (const id of ids) step(as(id), { type: "register" }, opens + MINUTE);
  // Arrivals over the first 15 minutes; quiet players come in and tap last.
  const arriveAt = new Map(
    ids
      .slice(0, 24)
      .map((id) => [
        id,
        T0 + Math.floor((quiet.has(id) ? 10 : 15 * random()) * MINUTE),
      ]),
  );
  const plan = new Map<string, { start: number; length: number }>();
  let forgotStart = false;
  let forgotFinish: string | null = null;
  let challengeRuns = 0;
  let firstWaitMax = 0;
  const rejoinAt = new Map<string, number>();
  for (let m = 0; m <= 120; m++) {
    const now = T0 + m * MINUTE;
    for (const [id, at] of arriveAt)
      if (at <= now && !s.present[id]) {
        step(as(id), { type: "check-in" }, now);
        step(as(id), { type: "play" }, now + (quiet.has(id) ? 2 * MINUTE : 0));
      }
    if (m === 60) step(as("p20"), { type: "leave" }, now);
    // The friends want to play together whenever all four are free.
    const free = (id: string) =>
      !s.games.some((g) => isActiveGame(g) && g.slots.includes(id));
    const open = s.challenges.some(
      (ch) => ch.status === "pending" || ch.status === "ready",
    );
    // p1 invites the other three; each accepts once they're off court and
    // steps out of line. A challenge needs all four in the queue together,
    // so the friends wait for each other and tap PLAY in the same minute.
    if (m > 20 && free("p1") && !open) {
      if (
        step(
          as("p1"),
          { type: "challenge", slots: ["p1", "p2", "p3", "p4"] },
          now,
        )
      )
        challengeRuns++;
    }
    for (const ch of s.challenges.filter((x) => x.status === "pending")) {
      for (const f of friends)
        if (ch.accepted[f] === undefined && free(f))
          step(as(f), { type: "challenge-accept", challengeId: ch.id }, now);
      if (friends.every(free)) {
        for (const f of friends) step(as(f), { type: "play" }, now);
      } else
        for (const f of friends)
          if (free(f)) step(as(f), { type: "pause" }, now);
    }
    for (const g of s.games.filter(isActiveGame)) {
      const four = filled(g.slots);
      if (g.status === "called" && four.length === 4 && !plan.has(g.id)) {
        const walk = four.some((id) => quiet.has(id)) ? 4 : 2;
        if (now - g.calledAt >= walk * MINUTE) {
          if (!forgotStart && m > 30) {
            // This group just plays and forgets to tap START.
            forgotStart = true;
            plan.set(g.id, { start: now, length: 14 });
          } else {
            step(as(four[0]!), { type: "accept", gameId: g.id }, now);
            step(as(four[1]!), { type: "start", gameId: g.id }, now);
            plan.set(g.id, {
              start: now,
              length: 10 + Math.floor(8 * random()),
            });
          }
        }
      }
      const p = plan.get(g.id);
      if (p && now >= p.start + p.length * MINUTE) {
        if (g.status === "called") {
          step(
            as(four[2]!),
            {
              type: "finish",
              gameId: g.id,
              startedMinutesAgo: Math.round((now - p.start) / MINUTE),
              score: [21, 15],
            },
            now,
          );
        } else if (!forgotFinish && m > 50) {
          // Nobody taps FINISH: they wander off; the organizer fixes it later.
          forgotFinish = g.id;
          step(as(four[0]!), { type: "leave" }, now); // refused: still playing
          plan.delete(g.id);
        } else {
          const a = 21;
          const b = Math.floor(10 + 10 * random());
          step(
            as(four[0]!),
            {
              type: "finish",
              gameId: g.id,
              score: random() < 0.5 ? [a, b] : [b, a],
            },
            now,
          );
          step(as(four[3]!), { type: "confirm", gameId: g.id }, now);
        }
      }
    }
    // Off court and out of line: back in when ready, never by itself.
    for (const id of Object.keys(s.present)) {
      const p = s.present[id]!;
      const busy =
        p.leftAt !== undefined ||
        s.queue.some((q) => q.playerId === id) ||
        !free(id) ||
        s.challenges.some(
          (c) =>
            (c.status === "ready" || c.status === "pending") &&
            c.slots.includes(id),
        );
      const played = s.games.some(
        (g) => g.status === "finished" && g.slots.includes(id),
      );
      if (busy || !played) {
        rejoinAt.delete(id);
        continue;
      }
      if (!rejoinAt.has(id))
        rejoinAt.set(
          id,
          now + (random() < 0.1 ? 5 : Math.floor(3 * random())) * MINUTE,
        );
      if (now >= rejoinAt.get(id)!) {
        step(as(id), { type: "play" }, now);
        rejoinAt.delete(id);
      }
    }
    if (forgotFinish && m === 75) {
      const g = s.games.find((x) => x.id === forgotFinish)!;
      const hhmm = localHHMM(g.startedAt! + 15 * MINUTE);
      step(
        ORG,
        {
          type: "correct",
          gameId: g.id,
          finishedAt: hhmm,
          reason: "Forgot to finish",
        },
        now,
      );
    }
    // How long anyone has waited for a first game.
    for (const q of s.queue) {
      const played = s.games.some(
        (g) =>
          g.status !== "cancelled" &&
          g.slots.includes(q.playerId) &&
          g.status !== "called",
      );
      if (!played)
        firstWaitMax = Math.max(firstWaitMax, (now - q.since) / MINUTE);
    }
  }
  return { c, s, challengeRuns, firstWaitMax, forgotFinish };
}

describe("a simulated 24-player Thursday", () => {
  for (const seed of [7, 11, 42]) {
    it(`is fair, never double-books, and times games right (seed ${seed})`, () => {
      const { c, s, challengeRuns, firstWaitMax, forgotFinish } =
        simulate(seed);
      const finished = s.games.filter((g) => g.status === "finished");
      const balance = nightBalance(c, s);
      // The four friends sit out of the line until all four can join it
      // together (that is what a challenge asks), so they may play fewer
      // games by their own choice — but never none.
      for (const f of ["p1", "p2", "p3", "p4"])
        expect(balance.find((r) => r.id === f)!.games).toBeGreaterThanOrEqual(
          1,
        );
      const here = balance.filter(
        (r) => r.id !== "p20" && !["p1", "p2", "p3", "p4"].includes(r.id),
      );
      const games = here.map((r) => r.games);
      const fewest = Math.min(...games);
      const most = Math.max(...games);
      // Everyone who stayed played several games, within two of each other.
      expect(fewest).toBeGreaterThanOrEqual(2);
      expect(most - fewest).toBeLessThanOrEqual(2);
      // The quiet players are not left behind.
      const median = [...games].sort((a, b) => a - b)[
        Math.floor(games.length / 2)
      ]!;
      for (const id of ["p5", "p6"])
        expect(balance.find((r) => r.id === id)!.games).toBeGreaterThanOrEqual(
          median - 1,
        );
      // Nobody waits long for a first game.
      expect(firstWaitMax).toBeLessThanOrEqual(25);
      // The friends got to play together, but not at everyone else's expense.
      expect(challengeRuns).toBeGreaterThanOrEqual(1);
      expect(
        finished.filter((g) => g.source === "challenge").length,
      ).toBeGreaterThanOrEqual(1);
      // Duration is exactly start to finish, for every game.
      for (const g of finished) {
        expect(g.finishedAt! > g.startedAt!).toBe(true);
        expect(playedMinutes(g)).toBe(
          Math.round((g.finishedAt! - g.startedAt!) / MINUTE),
        );
        expect(playedMinutes(g)).toBeLessThanOrEqual(20);
      }
      // The forgotten finish was corrected to 15 minutes, on the record.
      const fixed = s.games.find((g) => g.id === forgotFinish)!;
      expect(playedMinutes(fixed)).toBe(15);
      expect(s.audit.some((a) => /Forgot to finish/.test(a.what))).toBe(true);
      expect(s.games.some((g) => g.startEstimated)).toBe(true);
      // Three courts were used all night.
      for (const court of [1, 2, 3])
        expect(
          finished.filter((g) => g.court === court).length,
        ).toBeGreaterThanOrEqual(4);
      expect(unsound(c, s)).toBeNull();
    });
  }

  it("organizer can end the night cleanly", () => {
    const { c, s } = simulate(3);
    const ended = must(c, s, ORG, { type: "end" }, T0 + 121 * MINUTE);
    expect(ended.status).toBe("ended");
    expect(ended.games.filter(isActiveGame)).toHaveLength(0);
    expect(ended.queue).toHaveLength(0);
  });
});
