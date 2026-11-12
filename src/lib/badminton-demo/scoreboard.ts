/**
 * **Badminton Game Night — the scoreboard demonstration.**
 *
 * A fictional club night for showing what a scored, levelled game night
 * looks like: 25 made-up players, 4 courts, doubles, player levels 1–5,
 * match scores, wins and losses, a waiting queue with estimated waits, and
 * automatic rotation. It is pure (no I/O, no clock, no `Math.random`): the
 * caller keeps the state (the page keeps it in `localStorage`) and moves the
 * demo clock forward itself.
 *
 * This is deliberately **not** the CourtQueue engine (`src/lib/courtqueue`).
 * The real club app still never rates, ranks or compares its real players
 * (ADR 017; `belong.test.ts`). The owner's decision of 2026-11-11 — "The latest
 * owner requirements supersede the old doctrine prohibiting scores and player
 * comparisons." — is answered here, in a simulator nobody real is part of
 * (doctrine §10, ADR 017 amendment 2026-11-11).
 */

export const DEMO_VERSION = 1;
export const COURT_COUNT = 4;
/** The night starts at 7:00 pm; `now` counts demo minutes from then. */
export const START_MINUTES = 19 * 60;
/** Used for estimating waits before a court has a finish time of its own. */
export const TYPICAL_MATCH_MINUTES = 16;

export type Level = 1 | 2 | 3 | 4 | 5;
export type PlayerStatus = "waiting" | "playing" | "resting";

export interface DemoPlayer {
  readonly id: string;
  readonly name: string;
  readonly level: Level;
  readonly status: PlayerStatus;
  /** Demo minute this player joined the back of the queue; null unless waiting. */
  readonly queuedAt: number | null;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly minutesPlayed: number;
  readonly minutesWaiting: number;
  /** The id of this player's last finished match. */
  readonly lastMatch: string | null;
}

export type Team = readonly [string, string];

export interface Match {
  readonly id: string;
  readonly court: number;
  readonly teams: readonly [Team, Team];
  readonly startedAt: number;
  /** When the simulation will finish it if nobody enters a score first. */
  readonly endsAt: number;
  /** Final score, team A first. */
  readonly score?: readonly [number, number];
  readonly endedAt?: number;
}

export interface Demo {
  readonly v: typeof DEMO_VERSION;
  /** Seeded generator state; every random choice advances it. */
  readonly seed: number;
  readonly now: number;
  readonly players: readonly DemoPlayer[];
  /** One entry per court; null when the court is free. */
  readonly courts: readonly (Match | null)[];
  /** Finished matches, newest first. */
  readonly results: readonly Match[];
  readonly matchCount: number;
}

const NAMES: readonly (readonly [string, Level])[] = [
  ["Ava Chen", 4],
  ["Ben Okafor", 3],
  ["Chloé Martin", 2],
  ["Dev Patel", 5],
  ["Ella Nakamura", 3],
  ["Finn O'Brien", 1],
  ["Grace Liu", 4],
  ["Hugo Silva", 2],
  ["Isla Fraser", 3],
  ["Jonah Weiss", 5],
  ["Kira Thompson", 2],
  ["Leo Rossi", 3],
  ["Maya Singh", 4],
  ["Noah Kim", 1],
  ["Olive Dubois", 3],
  ["Priya Raman", 5],
  ["Quinn Murphy", 2],
  ["Ravi Mehta", 4],
  ["Sofia Alvarez", 3],
  ["Theo Park", 2],
  ["Uma Johansson", 4],
  ["Victor Nguyen", 3],
  ["Willa Grant", 1],
  ["Xander Cole", 4],
  ["Yuki Tanaka", 3],
];

// ── seeded randomness (mulberry32) ───────────────────────────────────────────

function draw(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

// ── the night ────────────────────────────────────────────────────────────────

/** A fresh night: everyone in line in arrival order, the courts filled. */
export function newDemo(seed = 737): Demo {
  const players: DemoPlayer[] = NAMES.map(([name, level], i) => ({
    id: `p${i + 1}`,
    name,
    level,
    status: "waiting",
    // Arrived in this order before the doors opened, so anyone who finishes
    // a game before the clock moves joins the back, not the front.
    queuedAt: i - NAMES.length,
    games: 0,
    wins: 0,
    losses: 0,
    minutesPlayed: 0,
    minutesWaiting: 0,
    lastMatch: null,
  }));
  return fillCourts({
    v: DEMO_VERSION,
    seed,
    now: 0,
    players,
    courts: Array.from({ length: COURT_COUNT }, () => null),
    results: [],
    matchCount: 0,
  });
}

/** Anything else (an older version, a hand-edited value) starts fresh. */
export function restore(raw: string | null): Demo | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Demo;
    if (
      d?.v !== DEMO_VERSION ||
      !Array.isArray(d.players) ||
      d.players.length !== NAMES.length ||
      !Array.isArray(d.courts) ||
      d.courts.length !== COURT_COUNT
    )
      return null;
    return d;
  } catch {
    return null;
  }
}

/** The waiting line, first in line first (longest wait, then arrival order). */
export function queue(d: Demo): DemoPlayer[] {
  return d.players
    .filter((p) => p.status === "waiting")
    .sort(
      (a, b) =>
        (a.queuedAt ?? 0) - (b.queuedAt ?? 0) || order(a.id) - order(b.id),
    );
}

const order = (id: string) => Number(id.slice(1));

/**
 * **Who plays next.** The player at the front of the line always plays.
 * The other three come from the next five in line, choosing the closest
 * levels to the front player's, and then whoever has waited longest.
 */
export function pickFour(line: readonly DemoPlayer[]): DemoPlayer[] | null {
  if (line.length < 4) return null;
  const [anchor, ...rest] = line;
  const pool = rest.slice(0, 5);
  let best: { four: DemoPlayer[]; spread: number; wait: number } | null = null;
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++) {
        const four = [anchor!, pool[i]!, pool[j]!, pool[k]!];
        const levels = four.map((p) => p.level);
        const spread = Math.max(...levels) - Math.min(...levels);
        const wait = i + j + k;
        if (
          !best ||
          spread < best.spread ||
          (spread === best.spread && wait < best.wait)
        )
          best = { four, spread, wait };
      }
  return best!.four;
}

/** The pairing of four whose level totals are closest. */
export function balance(four: readonly DemoPlayer[]): [Team, Team] {
  const [a, b, c, d] = four as [DemoPlayer, DemoPlayer, DemoPlayer, DemoPlayer];
  const options: [Team, Team][] = [
    [
      [a.id, b.id],
      [c.id, d.id],
    ],
    [
      [a.id, c.id],
      [b.id, d.id],
    ],
    [
      [a.id, d.id],
      [b.id, c.id],
    ],
  ];
  const level = new Map(four.map((p) => [p.id, p.level]));
  const gap = ([x, y]: [Team, Team]) =>
    Math.abs(
      level.get(x[0])! + level.get(x[1])! - level.get(y[0])! - level.get(y[1])!,
    );
  return options.reduce((best, o) => (gap(o) < gap(best) ? o : best));
}

/** Seat four from the line on every free court. */
export function fillCourts(d: Demo): Demo {
  let next = d;
  for (let court = 0; court < next.courts.length; court++) {
    if (next.courts[court]) continue;
    const four = pickFour(queue(next));
    if (!four) break;
    const [r, seed] = draw(next.seed);
    const id = `m${next.matchCount + 1}`;
    const match: Match = {
      id,
      court: court + 1,
      teams: balance(four),
      startedAt: next.now,
      endsAt: next.now + 12 + Math.floor(r * 9),
    };
    const seated = new Set(four.map((p) => p.id));
    next = {
      ...next,
      seed,
      matchCount: next.matchCount + 1,
      courts: next.courts.map((m, i) => (i === court ? match : m)),
      players: next.players.map((p) =>
        seated.has(p.id) ? { ...p, status: "playing", queuedAt: null } : p,
      ),
    };
  }
  return next;
}

/**
 * Is this a finished badminton game? Rally scoring to 21, win by two, and at
 * 29–29 the next point wins (30–29).
 */
export function validScore(a: number, b: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0)
    return false;
  const [hi, lo] = a > b ? [a, b] : [b, a];
  if (hi === 30) return lo === 28 || lo === 29;
  if (hi === 21) return lo <= 19;
  return hi > 21 && hi < 30 && hi - lo === 2;
}

/** A likely final score: the stronger pair wins more often, never always. */
function simulatedScore(d: Demo, m: Match): [[number, number], number] {
  const level = new Map(d.players.map((p) => [p.id, p.level]));
  const total = (t: Team) => level.get(t[0])! + level.get(t[1])!;
  const edge = total(m.teams[0]) - total(m.teams[1]);
  const chanceA = 1 / (1 + Math.pow(10, -edge / 4));
  const [r1, s1] = draw(d.seed);
  const [r2, s2] = draw(s1);
  const [r3, s3] = draw(s2);
  let loser = 8 + Math.floor(r2 * 13); // 8..20
  let winner = 21;
  if (loser >= 20) {
    loser = 20 + Math.floor(r3 * 10); // a deuce, 22–20 up to 30–29
    winner = loser === 29 ? 30 : loser + 2;
  }
  return [r1 < chanceA ? [winner, loser] : [loser, winner], s3];
}

/**
 * Finish the match on a court with this score (or a simulated one), credit
 * all four players, put them at the back of the line, and refill the court.
 */
export function finishMatch(
  d: Demo,
  court: number,
  score?: readonly [number, number],
): { ok: true; demo: Demo } | { ok: false; error: string } {
  const m = d.courts[court - 1];
  if (!m) return { ok: false, error: `Court ${court} has no match on.` };
  let seed = d.seed;
  let final: readonly [number, number];
  if (score) {
    if (!validScore(score[0], score[1]))
      return {
        ok: false,
        error:
          "That isn't a finished game: first to 21, win by two, 30 at most.",
      };
    final = score;
  } else {
    [final, seed] = simulatedScore(d, m);
  }
  const aWon = final[0] > final[1];
  const done: Match = { ...m, score: final, endedAt: d.now };
  const played = Math.max(d.now - m.startedAt, 0);
  const winners = new Set(aWon ? m.teams[0] : m.teams[1]);
  const four = new Set([...m.teams[0], ...m.teams[1]]);
  return {
    ok: true,
    demo: fillCourts({
      ...d,
      seed,
      courts: d.courts.map((c, i) => (i === court - 1 ? null : c)),
      results: [done, ...d.results].slice(0, 40),
      players: d.players.map((p) =>
        four.has(p.id)
          ? {
              ...p,
              status: "waiting",
              queuedAt: d.now,
              games: p.games + 1,
              wins: p.wins + (winners.has(p.id) ? 1 : 0),
              losses: p.losses + (winners.has(p.id) ? 0 : 1),
              minutesPlayed: p.minutesPlayed + played,
              lastMatch: m.id,
            }
          : p,
      ),
    }),
  };
}

/** Move the demo clock on, a minute at a time, finishing matches as they end. */
export function advance(d: Demo, minutes: number): Demo {
  let next = d;
  for (let i = 0; i < minutes; i++) {
    next = {
      ...next,
      now: next.now + 1,
      players: next.players.map((p) =>
        p.status === "waiting"
          ? { ...p, minutesWaiting: p.minutesWaiting + 1 }
          : p,
      ),
    };
    for (const m of next.courts)
      if (m && m.endsAt <= next.now) {
        const out = finishMatch(next, m.court);
        if (out.ok) next = out.demo;
      }
    next = fillCourts(next);
  }
  return next;
}

/** Sit out (off the line, keeping your stats) or come back to the back of it. */
export function toggleRest(d: Demo, id: string): Demo {
  const p = d.players.find((x) => x.id === id);
  if (!p || p.status === "playing") return d;
  const back = p.status === "resting";
  return fillCourts({
    ...d,
    players: d.players.map((x) =>
      x.id === id
        ? {
            ...x,
            status: back ? "waiting" : "resting",
            queuedAt: back ? d.now : null,
          }
        : x,
    ),
  });
}

/**
 * **An extra game.** Put someone at the front of the line (bringing them back
 * from a break if need be), so they take the next free court.
 */
export function playNext(d: Demo, id: string): Demo {
  const p = d.players.find((x) => x.id === id);
  if (!p || p.status === "playing") return d;
  const front = Math.min(0, ...queue(d).map((x) => x.queuedAt ?? 0)) - 1;
  return fillCourts({
    ...d,
    players: d.players.map((x) =>
      x.id === id ? { ...x, status: "waiting", queuedAt: front } : x,
    ),
  });
}

/**
 * **Override an assignment.** Swap someone waiting (or on a break) onto the
 * court in place of a player on it, on the same side. The player taken off
 * takes the other's place in the line.
 */
export function swapIn(
  d: Demo,
  courtNo: number,
  outId: string,
  inId: string,
): { ok: true; demo: Demo } | { ok: false; error: string } {
  const m = d.courts[courtNo - 1];
  const out = d.players.find((p) => p.id === outId);
  const inn = d.players.find((p) => p.id === inId);
  if (!m || !out || !inn || ![...m.teams[0], ...m.teams[1]].includes(outId))
    return {
      ok: false,
      error: `${out?.name ?? "That player"} isn't on court ${courtNo}.`,
    };
  if (inn.status === "playing")
    return { ok: false, error: `${inn.name} is already on a court.` };
  const sub = (t: Team): Team =>
    t[0] === outId ? [inId, t[1]] : t[1] === outId ? [t[0], inId] : t;
  const match: Match = { ...m, teams: [sub(m.teams[0]), sub(m.teams[1])] };
  return {
    ok: true,
    demo: {
      ...d,
      courts: d.courts.map((c, i) => (i === courtNo - 1 ? match : c)),
      players: d.players.map((p) =>
        p.id === outId
          ? { ...p, status: "waiting", queuedAt: inn.queuedAt ?? d.now }
          : p.id === inId
            ? { ...p, status: "playing", queuedAt: null }
            : p,
      ),
    },
  };
}

/** **Rotate**: finish every game on court now and call the next four on. */
export function rotateAll(d: Demo): Demo {
  let next = d;
  for (const m of d.courts) {
    if (!m) continue;
    const out = finishMatch(next, m.court);
    if (out.ok) next = out.demo;
  }
  return next;
}

/**
 * **Estimated wait**, in minutes, for everyone in line: four go on each time
 * a court comes free, courts free up at their finish times, and after that
 * every TYPICAL_MATCH_MINUTES.
 */
export function estimatedWaits(d: Demo): Map<string, number> {
  const free = d.courts.map((m) => (m ? Math.max(m.endsAt - d.now, 0) : 0));
  const out = new Map<string, number>();
  const line = queue(d);
  for (let g = 0; g * 4 < line.length; g++) {
    let i = 0;
    for (let c = 1; c < free.length; c++) if (free[c]! < free[i]!) i = c;
    const at = free[i]!;
    free[i] = at + TYPICAL_MATCH_MINUTES;
    for (const p of line.slice(g * 4, g * 4 + 4)) out.set(p.id, at);
  }
  return out;
}

/** "7:42 pm" for a demo minute. */
export function clockLabel(minute: number): string {
  const total = START_MINUTES + minute;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export const playerById = (d: Demo, id: string) =>
  d.players.find((p) => p.id === id)!;
