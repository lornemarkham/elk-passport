import type { SessionCommand } from "./engine";
import type { Level } from "./journey";
import { MINUTE, filled, type Club, type Session } from "./model";
import { as, club, must, night, ORG, T0 } from "./testkit";

/**
 * A club night run through the **real** engine (`applySession`), minute by
 * minute, with people who finish games, tap back in, take breaks and pass.
 * Seeded, so a failure replays. Test support only — not used by the app.
 */

export interface NightOptions {
  players?: number;
  courts?: number;
  minutes?: number;
  seed?: number;
  /** Level of each player, by index; omitted = nobody has said (open play). */
  levels?: (Level | null)[];
  /** `minLevel` of each court, by index. */
  courtMins?: (Level | null)[];
  guided?: boolean;
  /** Chance a called player passes, per call. */
  passRate?: number;
  /** Chance a finished player takes a break instead of tapping back in. */
  breakRate?: number;
  /** Chance a called game is never started (a no-show on court). */
  stallRate?: number;
}

export const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

export interface NightResult {
  club: Club;
  session: Session;
  /** Every game, in the order called, with the level of each player. */
  passes: number;
  breaks: number;
  idleCourtMinutes: number;
}

export function runNight(o: NightOptions = {}): NightResult {
  const n = o.players ?? 25;
  const rand = rng(o.seed ?? 1);
  const c = club(n, undefined, Math.min(o.courts ?? 4, 4));
  // `club()` only builds up to the original four; grow to the asked count.
  c.courts = Array.from({ length: o.courts ?? 4 }, (_, i) => ({
    id: i + 1,
    name: `Court ${i + 1}`,
    where: "",
  }));
  c.courtsSet = true;
  if (o.guided) c.rules.mode = "guided";
  (o.levels ?? []).forEach((l, i) => {
    if (l)
      c.players[`p${i + 1}`]!.journey = {
        level: l,
        goals: [],
        practising: [],
        done: [],
      };
  });
  (o.courtMins ?? []).forEach((l, i) => {
    if (l) c.courts[i]!.minLevel = l;
  });

  let s = night();
  const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
  let now = T0;
  for (const id of ids) {
    s = must(c, s, as(id), { type: "register" }, now);
    s = must(c, s, as(id), { type: "check-in" }, now);
  }
  s = must(c, s, ORG, { type: "go-live" }, now);
  const go = (id: string, cmd: SessionCommand) => {
    s = must(c, s, as(id), cmd, now);
  };
  for (const id of ids) go(id, { type: "play" });

  let passes = 0;
  let breaks = 0;
  let idle = 0;
  const backAt = new Map<string, number>(); // finished, will tap in at
  const breakUntil = new Map<string, number>();
  const length = new Map<string, number>(); // game id → minutes
  const stalled = new Set<string>();
  const minutes = o.minutes ?? 180;

  for (let m = 1; m <= minutes; m++) {
    now = T0 + m * MINUTE;
    // Back from a break or after a game.
    for (const [id, at] of [...backAt, ...breakUntil]) {
      if (at > now) continue;
      backAt.delete(id);
      breakUntil.delete(id);
      const here = s.present[id];
      const queued = s.queue.some((q) => q.playerId === id);
      const busy = s.games.some(
        (g) =>
          (g.status === "called" || g.status === "playing") &&
          g.slots.includes(id),
      );
      if (here && !queued && !busy) go(id, { type: "play" });
    }
    for (const g of [...s.games]) {
      if (g.status === "called" && filled(g.slots).length === 4) {
        if (g.accepted && Object.keys(g.accepted).length === 0) {
          // First sight of this call: someone may pass, someone may stall.
          const passer = g.slots.find(() => rand() < (o.passRate ?? 0));
          if (passer) {
            passes++;
            go(passer, { type: "decline", gameId: g.id });
            continue;
          }
          for (const id of filled(g.slots)) g.accepted[id] = now; // mark seen
          if (rand() < (o.stallRate ?? 0)) stalled.add(g.id);
        }
        if (!stalled.has(g.id) && now - g.calledAt >= MINUTE) {
          go(g.slots[0]!, { type: "start", gameId: g.id });
          length.set(g.id, 12 + Math.floor(rand() * 10));
        }
      }
      if (g.status === "playing") {
        const len = length.get(g.id) ?? 16;
        if (now - (g.startedAt ?? now) >= len * MINUTE) {
          go(g.slots[0]!, {
            type: "finish",
            gameId: g.id,
            score: [21, 10 + Math.floor(rand() * 10)],
          });
          for (const id of filled(g.slots)) {
            if (rand() < (o.breakRate ?? 0)) {
              breaks++;
              breakUntil.set(id, now + (5 + Math.floor(rand() * 10)) * MINUTE);
            } else backAt.set(id, now + Math.floor(rand() * 3) * MINUTE);
          }
        }
      }
    }
    // A stalled game is cancelled by the organizer after five minutes.
    for (const g of s.games)
      if (
        g.status === "called" &&
        stalled.has(g.id) &&
        now - g.calledAt > 5 * MINUTE
      ) {
        s = must(c, s, ORG, { type: "cancel-game", gameId: g.id }, now);
        stalled.delete(g.id);
      }
    const active = s.games.filter(
      (g) => g.status === "called" || g.status === "playing",
    );
    idle += c.courts.filter(
      (x) => !active.some((g) => g.court === x.id),
    ).length;
  }
  return { club: c, session: s, passes, breaks, idleCourtMinutes: idle };
}
