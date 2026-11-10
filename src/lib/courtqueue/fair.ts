import {
  MINUTE,
  SKILL_NAMES,
  filled,
  isBeginnerRated,
  partnerIn,
  playedMinutes,
  type Club,
  type Court,
  type Game,
  type Session,
  type Skill,
  type Slots,
} from "./model";

/**
 * **The fairness engine.** Who plays next, where, and with whom.
 *
 * The rule a person can say out loud: _fewest games tonight goes first; among
 * equals, fewest minutes on court; then whoever has waited longest._ Close
 * skill levels and new partners decide who joins them. The most deserving player who
 * may use the free court is the **anchor** and is always in the game; the
 * other three are picked from the next few in line for close skill, even
 * teams and new partners. Nobody is skipped for being quiet — a player only
 * slides behind someone if they cannot play on that court, and they become
 * the anchor themselves soon enough.
 */

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
  readonly skill: Skill;
  readonly games: number;
  readonly minutes: number;
}

/** The queue in the order the fairness engine serves it. */
export function inOrder(club: Club, s: Session): Waiting[] {
  const t = tonight(s);
  return s.queue
    .filter((q) => club.players[q.playerId])
    .map((q) => {
      const me = t.get(q.playerId) ?? none;
      return {
        playerId: q.playerId,
        since: q.since,
        skill: club.players[q.playerId]!.skill,
        games: me.games,
        minutes: me.minutes,
      };
    })
    .sort(
      (a, b) =>
        a.games - b.games ||
        a.minutes - b.minutes ||
        a.since - b.since ||
        a.playerId.localeCompare(b.playerId),
    );
}

/** Could this player be on this court with *some* partner? */
export function mayUse(court: Court, skill: number): boolean {
  if (court.kind === "expert" && isBeginnerRated(skill)) return false;
  if (skill >= court.minSkill && skill <= court.maxSkill) return true;
  return (
    court.stretchPartnerMin !== null &&
    skill === court.minSkill - 1 &&
    skill <= court.maxSkill
  );
}

/** May these two play this court as partners? */
export function teamMayUse(court: Court, a: number, b: number): boolean {
  const ok = (me: number, partner: number) => {
    if (court.kind === "expert" && isBeginnerRated(me)) return false;
    if (me >= court.minSkill && me <= court.maxSkill) return true;
    return (
      court.stretchPartnerMin !== null &&
      me === court.minSkill - 1 &&
      partner >= court.stretchPartnerMin
    );
  };
  return ok(a, b) && ok(b, a);
}

export function slotsMayUse(
  court: Court,
  slots: readonly (string | null)[],
  skillOf: (id: string) => number,
): boolean {
  const s = slots.map((id) => (id ? skillOf(id) : null));
  for (const [a, b] of [
    [0, 1],
    [2, 3],
  ] as const) {
    const x = s[a];
    const y = s[b];
    if (x != null && y != null) {
      if (!teamMayUse(court, x, y)) return false;
    } else if (x != null && !mayUse(court, x)) return false;
    else if (y != null && !mayUse(court, y)) return false;
  }
  return true;
}

const SPREAD_COST = [0, 1, 3, 7, 12];

interface Pick {
  readonly slots: Slots;
  readonly cost: number;
}

/**
 * The best way to seat four people on a court, or none if no seating is
 * allowed there. Costs: uneven teams, repeat partners, repeat foursomes,
 * and players outside what the court is for.
 */
function seat(
  court: Court,
  four: readonly Waiting[],
  t: Map<string, Tonight>,
  mentors: ReadonlySet<string>,
): Pick | null {
  const [a, b, c, d] = four as [Waiting, Waiting, Waiting, Waiting];
  const splits: [Waiting, Waiting, Waiting, Waiting][] = [
    [a, b, c, d],
    [a, c, b, d],
    [a, d, b, c],
  ];
  const skills = four.map((w) => w.skill);
  const spread = Math.max(...skills) - Math.min(...skills);
  const hasBeginner = skills.some(isBeginnerRated);
  const mentoring =
    hasBeginner &&
    four.some((w) => mentors.has(w.playerId) && w.skill >= 4) &&
    court.kind !== "expert";
  let base = SPREAD_COST[spread]! * (mentoring ? 0.4 : 1);
  if (court.kind === "intermediate") base *= 0.7;
  for (const w of four) {
    if (w.skill < court.idealMin) base += 2 * (court.idealMin - w.skill);
    if (w.skill > court.idealMax) base += 2 * (w.skill - court.idealMax);
  }
  // The same four again tonight is the established-group pattern.
  const allMet = four.every((x, i) =>
    four.every(
      (y, j) =>
        j <= i || ((t.get(x.playerId) ?? none).met.get(y.playerId) ?? 0) > 0,
    ),
  );
  if (allMet) base += 10;

  let best: Pick | null = null;
  for (const [p, q, r, s] of splits) {
    if (!teamMayUse(court, p.skill, q.skill)) continue;
    if (!teamMayUse(court, r.skill, s.skill)) continue;
    let cost = base;
    cost += 2 * Math.abs(p.skill + q.skill - (r.skill + s.skill));
    cost += 4 * ((t.get(p.playerId) ?? none).partners.get(q.playerId) ?? 0);
    cost += 4 * ((t.get(r.playerId) ?? none).partners.get(s.playerId) ?? 0);
    if (!best || cost < best.cost)
      best = {
        slots: [p.playerId, q.playerId, r.playerId, s.playerId],
        cost,
      };
  }
  return best;
}

/** How many players after the anchor are considered for the other three. */
const WINDOW = 7;

export interface Proposal {
  readonly slots: Slots;
  readonly why: string[];
}

/**
 * The next game for a free court, from the queue — or `null` when fewer than
 * four people who may use it are waiting.
 */
export function propose(
  club: Club,
  s: Session,
  court: Court,
  now: number,
  exclude: ReadonlySet<string> = new Set(),
): Proposal | null {
  const t = tonight(s);
  const line = inOrder(club, s).filter(
    (w) => !exclude.has(w.playerId) && mayUse(court, w.skill),
  );
  if (line.length < 4) return null;
  const mentors = new Set(
    Object.values(club.players)
      .filter((p) => p.mentor)
      .map((p) => p.id),
  );
  // The most deserving player who can actually be seated here anchors the
  // game; someone who can't (an intermediate with no expert to partner on
  // the expert court) waits for a court that suits them instead.
  for (let at = 0; at + 4 <= line.length; at++) {
    const anchor = line[at]!;
    const pool = [...line.slice(0, at), ...line.slice(at + 1)].slice(0, WINDOW);
    const best = bestAround(court, anchor, pool, t, mentors);
    if (best)
      return {
        slots: best.slots,
        why: explain(club, best.slots, anchor, t, mentors, now),
      };
  }
  return null;
}

function bestAround(
  court: Court,
  anchor: Waiting,
  pool: readonly Waiting[],
  t: Map<string, Tonight>,
  mentors: ReadonlySet<string>,
): Pick | null {
  const firstTimers = new Set(
    pool.filter((w) => w.games === 0).map((w) => w.playerId),
  );
  let best: { pick: Pick; cost: number } | null = null;
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++) {
        const chosen = [pool[i]!, pool[j]!, pool[k]!];
        const pick = seat(court, [anchor, ...chosen], t, mentors);
        if (!pick) continue;
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
  return best?.pick ?? null;
}

/** One more player for a called game that lost one. */
export function replacement(
  club: Club,
  s: Session,
  court: Court,
  game: Game,
): string | null {
  const t = tonight(s);
  const gone = new Set([...filled(game.slots), ...game.declined]);
  const skillOf = (id: string) => club.players[id]?.skill ?? 3;
  const empty = game.slots.indexOf(null);
  if (empty < 0) return null;
  const others = filled(game.slots);
  const line = inOrder(club, s).filter(
    (w) => !gone.has(w.playerId) && mayUse(court, w.skill),
  );
  let best: { id: string; cost: number } | null = null;
  line.slice(0, WINDOW + 1).forEach((w, rank) => {
    const trial = [...game.slots] as Slots;
    trial[empty] = w.playerId;
    if (!slotsMayUse(court, trial, skillOf)) return;
    const skills = [...others.map(skillOf), w.skill];
    const spread = Math.max(...skills) - Math.min(...skills);
    const repeat = others.reduce(
      (n, o) => n + ((t.get(w.playerId) ?? none).partners.get(o) ?? 0),
      0,
    );
    const cost = rank * 1.2 + SPREAD_COST[spread]! + 2 * repeat;
    if (!best || cost < best.cost) best = { id: w.playerId, cost };
  });
  return best ? (best as { id: string }).id : null;
}

/** Re-balance a full four after a replacement joined. */
export function rebalance(
  club: Club,
  s: Session,
  court: Court,
  slots: Slots,
): Slots {
  const ids = filled(slots);
  if (ids.length !== 4) return slots;
  const t = tonight(s);
  const four = ids.map((id) => ({
    playerId: id,
    since: 0,
    skill: club.players[id]?.skill ?? 3,
    games: 0,
    minutes: 0,
  }));
  return seat(court, four, t, new Set())?.slots ?? slots;
}

function explain(
  club: Club,
  slots: Slots,
  anchor: Waiting,
  t: Map<string, Tonight>,
  mentors: ReadonlySet<string>,
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
      `${name(anchor.playerId)} was next: fewest games and minutes tonight`,
    );
  const waited = Math.round((now - anchor.since) / MINUTE);
  if (waited >= 3)
    why.push(`${name(anchor.playerId)} has waited ${waited} min`);
  const skill = (id: string | null) =>
    id ? (club.players[id]?.skill ?? 3) : 3;
  const a = skill(slots[0]) + skill(slots[1]);
  const b = skill(slots[2]) + skill(slots[3]);
  if (a === b) why.push("Evenly matched teams");
  else if (Math.abs(a - b) === 1) why.push("Closely matched teams");
  const fresh = [
    [slots[0], slots[1]],
    [slots[2], slots[3]],
  ].every(([p, q]) => p && q && !((t.get(p) ?? none).partners.get(q) ?? 0));
  if (fresh) why.push("New partners");
  const skills = filled(slots).map(skill);
  if (
    skills.some(isBeginnerRated) &&
    filled(slots).some((id) => mentors.has(id) && skill(id) >= 4)
  ) {
    const m = filled(slots).find((id) => mentors.has(id) && skill(id) >= 4)!;
    why.push(`${name(m)} is mentoring`);
  }
  if (why.length === 0)
    why.push(
      `Close skill levels (${SKILL_NAMES[Math.min(...skills) as Skill]}–${SKILL_NAMES[Math.max(...skills) as Skill]})`,
    );
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
