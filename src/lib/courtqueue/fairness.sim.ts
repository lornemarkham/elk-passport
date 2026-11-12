import { priority } from "./fairness";

/**
 * **The fairness simulation.** 25 players, three courts, 60–120 minutes, the
 * same seeded night played twice: once with plain first-in-first-out rotation
 * and once with the fairness priority from `fairness.ts` (the very function
 * the engine uses).
 *
 * Groups A, B and C stand for the three private-guide levels (newer, steady,
 * experienced) and exist **only here**, as a way to ask "does the rule treat
 * groups differently?" — group A plays short games, group C long ones, so a
 * rule blind to minutes drifts. The product never reads a level to place
 * anyone. The restricted-courts scenario likewise exists only to measure how
 * much a court limit would cost; CourtQueue has no court limits.
 */

export type Level = "A" | "B" | "C";
export type Policy = "fifo" | "fair";

export interface Options {
  readonly seed: number;
  readonly minutes: number;
  readonly courts?: number;
  /** Per court (1-based), the levels allowed on it. Absent = everyone. */
  readonly eligible?: Readonly<Record<number, readonly Level[]>>;
}

interface P {
  id: number;
  level: Level;
  arrive: number;
  played: number;
  games: number;
  waitedTotal: number;
  maxWait: number;
  since: number | null;
  freeAt: number;
  breakUntil: number;
  onCourt: boolean;
  courts: number[];
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const LEVELS: Level[] = [
  ...Array<Level>(8).fill("A"),
  ...Array<Level>(11).fill("B"),
  ...Array<Level>(6).fill("C"),
];

export interface Result {
  readonly policy: Policy;
  readonly played: number[];
  readonly games: number[];
  readonly maxWait: number;
  readonly byLevel: Record<Level, { n: number; played: number; wait: number }>;
  /** Court-minutes with a free court and fewer than four eligible waiting. */
  readonly idleCourtMinutes: number;
  readonly perCourtGames: number[];
  readonly players: {
    id: number;
    level: Level;
    played: number;
    games: number;
  }[];
}

export function simulate(policy: Policy, o: Options): Result {
  const rand = rng(o.seed);
  const courts = o.courts ?? 3;
  const players: P[] = LEVELS.slice(0, 25).map((level, i) => ({
    id: i + 1,
    level,
    arrive: i < 18 ? Math.floor(rand() * 6) : 5 + Math.floor(rand() * 25),
    played: 0,
    games: 0,
    waitedTotal: 0,
    maxWait: 0,
    since: null,
    freeAt: 0,
    breakUntil: 0,
    onCourt: false,
    courts: [],
  }));
  // Shuffle which ids hold which level so id order never decides anything.
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [players[i]!.level, players[j]!.level] = [
      players[j]!.level,
      players[i]!.level,
    ];
  }
  const busyUntil = new Array<number>(courts).fill(0);
  const group: (P[] | null)[] = new Array(courts).fill(null);
  let idle = 0;
  const perCourtGames = new Array<number>(courts).fill(0);
  const wait = (p: P, now: number) => (p.since === null ? 0 : now - p.since);
  const allowed = (p: P, court: number) =>
    !o.eligible?.[court + 1] || o.eligible[court + 1]!.includes(p.level);

  for (let now = 0; now < o.minutes; now++) {
    // Games ending.
    for (let c = 0; c < courts; c++) {
      const g = group[c];
      if (g && now >= busyUntil[c]!) {
        for (const p of g) {
          p.onCourt = false;
          p.freeAt = now;
          // Some take a breather (voluntary, not waiting); most tap back in.
          p.breakUntil =
            rand() < 0.18 ? now + 5 + Math.floor(rand() * 10) : now;
        }
        group[c] = null;
      }
    }
    // Arrivals and return from break join the line.
    for (const p of players)
      if (
        !p.onCourt &&
        p.since === null &&
        now >= p.arrive &&
        now >= p.breakUntil
      )
        p.since = now;
    const line = players.filter((p) => p.since !== null && !p.onCourt);
    const here = players.filter((p) => now >= p.arrive);
    const avg =
      here.reduce((n, p) => n + p.played, 0) / Math.max(1, here.length);
    for (let c = 0; c < courts; c++) {
      if (group[c]) continue;
      const pool = line.filter((p) => p.since !== null && allowed(p, c));
      if (pool.length < 4) {
        if (line.length >= 4) idle += 1;
        continue;
      }
      pool.sort((a, b) =>
        policy === "fifo"
          ? a.since! - b.since! || a.id - b.id
          : priority(wait(b, now), b.played, avg) -
              priority(wait(a, now), a.played, avg) ||
            a.games - b.games ||
            a.since! - b.since!,
      );
      const four = pool.slice(0, 4);
      let len = 0;
      for (const p of four) {
        p.maxWait = Math.max(p.maxWait, wait(p, now));
        p.waitedTotal += wait(p, now);
        p.since = null;
        p.onCourt = true;
        len += p.level === "A" ? 0 : p.level === "B" ? 3 : 6;
      }
      // 11–19 minutes, longer when stronger players are on.
      const mins = 11 + Math.floor(rand() * 5) + Math.round(len / 4);
      group[c] = four;
      busyUntil[c] = now + mins;
      for (const p of four) {
        p.played += Math.min(mins, o.minutes - now); // cut off at closing
        p.games += 1;
        p.courts.push(c + 1);
      }
      perCourtGames[c]! += 1;
      for (const p of line)
        if (four.includes(p)) line.splice(line.indexOf(p), 1);
    }
  }
  const arrived = players.filter((p) => p.arrive < o.minutes);
  const byLevel = {
    A: { n: 0, played: 0, wait: 0 },
    B: { n: 0, played: 0, wait: 0 },
    C: { n: 0, played: 0, wait: 0 },
  };
  for (const p of arrived) {
    const l = byLevel[p.level];
    l.n += 1;
    l.played += p.played;
    l.wait += p.maxWait;
  }
  return {
    policy,
    played: arrived.map((p) => p.played),
    games: arrived.map((p) => p.games),
    maxWait: Math.max(...arrived.map((p) => p.maxWait)),
    byLevel,
    idleCourtMinutes: idle,
    perCourtGames,
    players: arrived.map((p) => ({
      id: p.id,
      level: p.level,
      played: p.played,
      games: p.games,
    })),
  };
}

export interface Summary {
  readonly policy: Policy;
  readonly runs: number;
  readonly avgPlayed: number;
  readonly fewest: number;
  readonly most: number;
  /** Mean of each run's spread (most − fewest). */
  readonly spread: number;
  readonly stdev: number;
  readonly barelyPlayed: number;
  readonly disproportionate: number;
  readonly maxWait: number;
  readonly avgMaxWait: number;
  readonly idleCourtMinutes: number;
  readonly levelAvg: Record<Level, number>;
  readonly levelGap: number;
}

/** Many seeded nights, one summary. */
export function summarise(policy: Policy, o: Omit<Options, "seed">, runs = 60) {
  const results = Array.from({ length: runs }, (_, i) =>
    simulate(policy, { ...o, seed: 1000 + i * 17 }),
  );
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  let barely = 0,
    disp = 0,
    sd = 0,
    spread = 0,
    least = Infinity,
    most = 0,
    idle = 0,
    maxWait = 0,
    avgMax = 0;
  const lv = {
    A: [0, 0],
    B: [0, 0],
    C: [0, 0],
  } as Record<Level, number[]>;
  const avgs: number[] = [];
  for (const r of results) {
    const m = mean(r.played);
    avgs.push(m);
    sd += Math.sqrt(mean(r.played.map((x) => (x - m) ** 2)));
    // Barely played: under 60% of that night's average. Disproportionate: over 140%.
    barely += r.played.filter((x) => x < 0.6 * m).length;
    disp += r.played.filter((x) => x > 1.4 * m).length;
    spread += Math.max(...r.played) - Math.min(...r.played);
    least = Math.min(least, ...r.played);
    most = Math.max(most, ...r.played);
    idle += r.idleCourtMinutes;
    maxWait = Math.max(maxWait, r.maxWait);
    avgMax += r.maxWait;
    for (const l of Object.keys(r.byLevel) as Level[]) {
      lv[l]![0]! += r.byLevel[l].played;
      lv[l]![1]! += r.byLevel[l].n;
    }
  }
  const levelAvg = Object.fromEntries(
    (Object.keys(lv) as Level[]).map((l) => [l, lv[l]![0]! / lv[l]![1]!]),
  ) as Record<Level, number>;
  const vals = Object.values(levelAvg);
  return {
    policy,
    runs,
    avgPlayed: mean(avgs),
    fewest: least,
    most,
    spread: spread / runs,
    stdev: sd / runs,
    barelyPlayed: barely / runs,
    disproportionate: disp / runs,
    maxWait,
    avgMaxWait: avgMax / runs,
    idleCourtMinutes: idle / runs,
    levelAvg,
    levelGap: Math.max(...vals) - Math.min(...vals),
  } satisfies Summary;
}
