import { mayPlay } from "./eligibility";
import { averagePlayed, ledger, order } from "./fairness";
import { levelRank } from "./journey";
import {
  MINUTE,
  filled,
  partnerIn,
  playedMinutes,
  type Club,
  type Court,
  type Game,
  type Mood,
  type Session,
  type Slots,
} from "./model";

/**
 * **The fairness engine.** Who plays next, where, and with whom.
 *
 * The rule a person can say out loud: _whoever has waited longest goes first,
 * and court time breaks a close call_ (`fairness.ts`: someone far behind the
 * night's average moves up, someone far ahead steps back). The
 * most deserving player is the **anchor** and is always in the game; the
 * other three are picked from the next few in line to mix people up: new
 * partners, people they haven't played yet, a warm welcome for someone new,
 * and — only as a gentle tie-break — what each player said sounds fun today.
 *
 * **Who may play where** is the organizer's choice (2026-11-12, `eligibility.ts`).
 * In open play, the default, every court takes anybody and nothing here knows
 * how good anyone is. In guided play a court can ask for a lowest level, and
 * the line is filtered to the players that court may take **before** anyone
 * is anchored or mixed — so the longest-waiting *eligible* player goes first,
 * and an ineligible player at the front of the line neither blocks the court
 * nor is skipped for another court. Teams are never "balanced" by ability.
 */

/** A newcomer: registered in the three weeks before the night. */
const NEWCOMER_MS = 21 * 24 * 60 * MINUTE;

export interface Tonight {
  games: number;
  minutes: number;
  /** Minutes spent waiting in line before each game that was called. */
  waited: number;
  lastFinishedAt: number | null;
  /** Partner id → games together tonight. */
  partners: Map<string, number>;
  /** Every player shared a court with tonight → times. */
  met: Map<string, number>;
}

export function tonight(s: Session): Map<string, Tonight> {
  const out = new Map<string, Tonight>();
  const get = (id: string) => {
    let t = out.get(id);
    if (!t) {
      t = {
        games: 0,
        minutes: 0,
        waited: 0,
        lastFinishedAt: null,
        partners: new Map(),
        met: new Map(),
      };
      out.set(id, t);
    }
    return t;
  };
  for (const g of s.games) {
    if (g.status === "cancelled") continue;
    for (const id of filled(g.slots)) {
      const since = g.waitedSince[id];
      if (since !== undefined)
        get(id).waited += Math.max(
          0,
          Math.round((g.calledAt - since) / MINUTE),
        );
    }
    if (g.status !== "finished") continue;
    const ids = filled(g.slots);
    for (const id of ids) {
      const t = get(id);
      t.games += 1;
      t.minutes += playedMinutes(g);
      t.lastFinishedAt = Math.max(t.lastFinishedAt ?? 0, g.finishedAt ?? 0);
      const p = partnerIn(g, id);
      if (p) t.partners.set(p, (t.partners.get(p) ?? 0) + 1);
      for (const o of ids) if (o !== id) t.met.set(o, (t.met.get(o) ?? 0) + 1);
    }
  }
  return out;
}

const none: Tonight = {
  games: 0,
  minutes: 0,
  waited: 0,
  lastFinishedAt: null,
  partners: new Map(),
  met: new Map(),
};

export interface Waiting {
  readonly playerId: string;
  readonly since: number;
  readonly mood: Mood | null;
  readonly newcomer: boolean;
  readonly host: boolean;
  /** Wants a friendly partner who can show them a few things. */
  readonly learner: boolean;
  /** 0 … 2, or null when they haven't said. Never leaves the server. */
  readonly rank: number | null;
  readonly games: number;
  readonly minutes: number;
}

/** The queue in the order the fairness engine serves it. */
export function inOrder(
  club: Club,
  s: Session,
  now: number = Date.now(),
): Waiting[] {
  const t = tonight(s);
  const next = new Set(s.nextUp ?? []);
  const average = averagePlayed(ledger(s, now).values());
  const line = s.queue
    .filter((q) => club.players[q.playerId])
    .map((q) => {
      const me = t.get(q.playerId) ?? none;
      return {
        playerId: q.playerId,
        since: q.since,
        ...traits(club, s, q.playerId),
        games: me.games,
        minutes: me.minutes,
      };
    });
  // Organizer's "play next" first, then longest wait adjusted by court time.
  const byWait = order(
    line,
    (w) => ({
      waited: (now - w.since) / MINUTE,
      played: w.minutes,
      games: w.games,
      at: w.since,
    }),
    average,
  );
  return [
    ...byWait.filter((w) => next.has(w.playerId)),
    ...byWait.filter((w) => !next.has(w.playerId)),
  ];
}

function traits(club: Club, s: Session, id: string) {
  const p = club.players[id];
  return {
    mood: s.moods?.[id] ?? null,
    newcomer: !!p && p.createdAt >= Date.parse(s.date) - NEWCOMER_MS,
    // "Happy to Help" tonight, or a standing volunteer.
    host: !!p?.mentor || s.moods?.[id] === "help",
    learner: !!p?.journey?.wantsHelp || levelRank(p?.journey?.level) === 0,
    rank: levelRank(p?.journey?.level),
  };
}

interface Pick {
  readonly slots: Slots;
  readonly cost: number;
}

/**
 * The best way to seat four people on a court. Costs: repeat partners,
 * people who have already shared a court tonight, the very same four again,
 * two newcomers together with no one to welcome them, and (lightly) very
 * different answers to "what sounds fun today?".
 */
function seat(four: readonly Waiting[], t: Map<string, Tonight>): Pick {
  const [a, b, c, d] = four as [Waiting, Waiting, Waiting, Waiting];
  const splits: [Waiting, Waiting, Waiting, Waiting][] = [
    [a, b, c, d],
    [a, c, b, d],
    [a, d, b, c],
  ];
  let base = 0;
  // Mixing: every pair here who have already shared a court tonight.
  let metPairs = 0;
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++)
      metPairs +=
        ((t.get(four[i]!.playerId) ?? none).met.get(four[j]!.playerId) ?? 0)
          ? 1
          : 0;
  base += 1.5 * metPairs;
  // The same four again tonight is the established-group pattern.
  if (metPairs === 6) base += 10;
  // A warm welcome: a newcomer with a volunteer host is better than without;
  // a table of only newcomers is not penalised, just not helped.
  const newcomers = four.filter((w) => w.newcomer).length;
  const hosts = four.filter((w) => w.host && !w.newcomer).length;
  if (newcomers > 0 && hosts > 0) base -= 3;
  // Someone who asked for a friendly partner is better off with a helper than
  // without — but a mixed game is never a requirement and never a rank.
  const learners = four.filter((w) => w.learner && !w.newcomer).length;
  if (learners > 0 && hosts > 0 && newcomers === 0) base -= 2;
  // Gentle: "Challenge Me" and "Just Here to Play" both get the game they
  // asked for more often when they are not forced together.
  const moods = new Set(four.map((w) => w.mood).filter((m) => m !== null));
  if (moods.has("fun") && moods.has("challenge")) base += 2;
  // "Challenge Me": a game with someone whose experience is at least theirs.
  // "Find My Rhythm": a steady game, so a wide spread of experience costs a little.
  const ranks = four.map((w) => w.rank).filter((r): r is number => r !== null);
  const top = ranks.length ? Math.max(...ranks) : 0;
  for (const w of four) {
    if (
      w.mood === "challenge" &&
      w.rank !== null &&
      four.some((o) => o !== w && o.rank !== null && o.rank >= w.rank!)
    )
      base -= 1.5;
    if (
      w.mood === "rallies" &&
      ranks.length > 1 &&
      top - Math.min(...ranks) >= 2
    )
      base += 1.5;
  }

  let best: Pick | null = null;
  for (const [p, q, r, s] of splits) {
    let cost = base;
    cost += 4 * ((t.get(p.playerId) ?? none).partners.get(q.playerId) ?? 0);
    cost += 4 * ((t.get(r.playerId) ?? none).partners.get(s.playerId) ?? 0);
    // Newcomers partner someone who is not also new, when there's a choice.
    if (p.newcomer && q.newcomer) cost += 1.5;
    if (r.newcomer && s.newcomer) cost += 1.5;
    // A helper alongside someone who asked for one.
    for (const [x, y] of [
      [p, q],
      [r, s],
    ] as const)
      if ((x.host && y.learner) || (y.host && x.learner)) cost -= 1;
    if (!best || cost < best.cost)
      best = {
        slots: [p.playerId, q.playerId, r.playerId, s.playerId],
        cost,
      };
  }
  return best!;
}

/** How many players after the anchor are considered for the other three. */
const WINDOW = 7;

export interface Proposal {
  readonly slots: Slots;
  readonly why: string[];
}

/**
 * The next game for a free court, from the queue — or `null` when fewer than
 * four people are waiting.
 */
export function propose(
  club: Club,
  s: Session,
  court: Court,
  now: number,
  exclude: ReadonlySet<string> = new Set(),
): Proposal | null {
  const t = tonight(s);
  const line = inOrder(club, s, now).filter(
    (w) => !exclude.has(w.playerId) && mayPlay(club, court, w.playerId),
  );
  if (line.length < 4) return null;
  // The most deserving player in line anchors the game.
  const anchor = line[0]!;
  const pool = line.slice(1, WINDOW + 1);
  const best = bestAround(anchor, pool, t);
  return {
    slots: best.slots,
    why: explain(club, s, best.slots, anchor, t, now),
  };
}

function bestAround(
  anchor: Waiting,
  pool: readonly Waiting[],
  t: Map<string, Tonight>,
): Pick {
  const firstTimers = new Set(
    pool.filter((w) => w.games === 0).map((w) => w.playerId),
  );
  let best: { pick: Pick; cost: number } | null = null;
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++) {
        const chosen = [pool[i]!, pool[j]!, pool[k]!];
        const pick = seat([anchor, ...chosen], t);
        // Being further back in line costs; passing over someone who has not
        // played yet, for someone who has, costs a lot more.
        let cost = pick.cost + (i + j + k) * 1.2;
        const skippedFirst = [...firstTimers].filter(
          (id) => !chosen.some((w) => w.playerId === id),
        ).length;
        const choseVeteran = chosen.filter((w) => w.games > 0).length;
        cost += 9 * Math.min(skippedFirst, choseVeteran);
        if (!best || cost < best.cost) best = { pick, cost };
      }
  return best!.pick;
}

/** One more player for a called game that lost one. */
export function replacement(
  club: Club,
  s: Session,
  court: Court,
  game: Game,
  now: number = Date.now(),
): string | null {
  const t = tonight(s);
  const gone = new Set([...filled(game.slots), ...game.declined]);
  const empty = game.slots.indexOf(null);
  if (empty < 0) return null;
  const others = filled(game.slots);
  const line = inOrder(club, s, now).filter(
    (w) => !gone.has(w.playerId) && mayPlay(club, court, w.playerId),
  );
  let best: { id: string; cost: number } | null = null;
  line.slice(0, WINDOW + 1).forEach((w, rank) => {
    const repeat = others.reduce(
      (n, o) => n + ((t.get(w.playerId) ?? none).partners.get(o) ?? 0),
      0,
    );
    const met = others.filter((o) =>
      (t.get(w.playerId) ?? none).met.get(o),
    ).length;
    const cost = rank * 1.2 + 2 * repeat + 0.5 * met;
    if (!best || cost < best.cost) best = { id: w.playerId, cost };
  });
  return best ? (best as { id: string }).id : null;
}

/** Re-mix a full four after a replacement joined. */
export function rebalance(
  club: Club,
  s: Session,
  _court: Court,
  slots: Slots,
): Slots {
  const ids = filled(slots);
  if (ids.length !== 4) return slots;
  const t = tonight(s);
  const four = ids.map((id) => ({
    playerId: id,
    since: 0,
    ...traits(club, s, id),
    games: 0,
    minutes: 0,
  }));
  return seat(four, t).slots;
}

function explain(
  club: Club,
  s: Session,
  slots: Slots,
  anchor: Waiting,
  t: Map<string, Tonight>,
  now: number,
): string[] {
  const name = (id: string) => club.players[id]?.name ?? "Someone";
  const why: string[] = [];
  const firsts = filled(slots).filter((id) => (t.get(id) ?? none).games === 0);
  if (firsts.length === 4) why.push("Everyone's first game tonight");
  else if (firsts.length > 0)
    why.push(`First game tonight for ${firsts.map(name).join(" and ")}`);
  else
    why.push(
      `${name(anchor.playerId)} was next: longest wait, balanced with court time tonight`,
    );
  const waited = Math.round((now - anchor.since) / MINUTE);
  if (waited >= 3)
    why.push(`${name(anchor.playerId)} has waited ${waited} min`);
  const fresh = [
    [slots[0], slots[1]],
    [slots[2], slots[3]],
  ].every(([p, q]) => p && q && !((t.get(p) ?? none).partners.get(q) ?? 0));
  if (fresh) why.push("New partners");
  const ids = filled(slots);
  const host = ids.find((id) => club.players[id]?.mentor);
  const newcomer = ids.find(
    (id) => id !== host && traits(club, s, id).newcomer,
  );
  if (host && newcomer) why.push(`${name(host)} is here to say hello`);
  else {
    // Said in words that name no one's level.
    const ranks = new Set(
      ids.map((id) => traits(club, s, id).rank).filter((r) => r !== null),
    );
    if (ranks.size > 1)
      why.push("A mixed-experience game: everyone can learn something");
    else if (
      ids.some((id) => s.moods?.[id] === "challenge") &&
      ranks.size === 1
    )
      why.push("A game with a bit of spark");
  }
  if (why.length === 0) why.push("A fresh mix of players");
  return why;
}

/** Typical length of a game tonight, in minutes, or a sensible default. */
export function typicalGameMinutes(s: Session): number {
  const done = s.games
    .filter((g) => g.status === "finished")
    .map(playedMinutes)
    .filter((m) => m > 0);
  if (done.length === 0) return 14;
  const recent = done.slice(-9);
  return Math.max(
    6,
    Math.round(recent.reduce((a, b) => a + b, 0) / recent.length),
  );
}

/**
 * Roughly when the nth person in line (0-based) gets on a court: the open
 * courts' next free moments, handed out four people at a time.
 */
export function estimateWaitMinutes(
  s: Session,
  courtsOpen: number,
  position: number,
  now: number,
): number {
  const typical = typicalGameMinutes(s);
  const frees: number[] = [];
  const busy = s.games.filter(
    (g) =>
      (g.status === "called" || g.status === "playing") &&
      !s.closedCourts.includes(g.court),
  );
  for (const g of busy) {
    const start = g.startedAt ?? now;
    frees.push(Math.max(now, start + typical * MINUTE));
  }
  while (frees.length < courtsOpen) frees.push(now);
  if (frees.length === 0) return 0;
  frees.sort((a, b) => a - b);
  const group = Math.floor(position / 4);
  let at = now;
  for (let i = 0; i <= group; i++) {
    at = frees.shift()!;
    frees.push(at + typical * MINUTE);
    frees.sort((a, b) => a - b);
  }
  return Math.max(0, Math.round((at - now) / MINUTE));
}

export interface Prepared {
  readonly court: number;
  readonly slots: Slots;
  readonly why: readonly string[];
  /** Roughly when that court frees up. */
  readonly at: number;
}

/**
 * **The next games, already prepared.** For each court that is busy, in the
 * order they should free up, the four the engine would call there if it
 * freed now — each four taken out before the next court is filled. When a
 * court does free, `tick` asks the same question of the same line, so these
 * are the people called unless the line changed in between (someone took a
 * break, or a court freed out of order). A projection, never stored: nobody
 * is held out of the line by it.
 */
export function prepared(club: Club, s: Session, now: number): Prepared[] {
  if (s.status !== "live") return [];
  const typical = typicalGameMinutes(s) * MINUTE;
  const busy = club.courts
    .filter((c) => !s.closedCourts.includes(c.id))
    .map((c) => {
      const g = s.games.find(
        (x) =>
          x.court === c.id && (x.status === "called" || x.status === "playing"),
      );
      return g
        ? { court: c, at: Math.max(now, (g.startedAt ?? now) + typical) }
        : null;
    })
    .filter((x): x is { court: Court; at: number } => x !== null)
    .sort((a, b) => a.at - b.at);
  const taken = new Set<string>();
  const out: Prepared[] = [];
  for (const { court, at } of busy) {
    const p = propose(club, s, court, now, taken);
    if (!p) continue;
    for (const id of filled(p.slots)) taken.add(id);
    out.push({ court: court.id, slots: p.slots, why: p.why, at });
  }
  return out;
}
