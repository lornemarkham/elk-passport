import {
  MINUTE,
  filled,
  isActiveGame,
  playedMinutes,
  type Club,
  type Session,
} from "./model";

/**
 * **Fairness intelligence.** Who has had court time tonight, who has waited,
 * and who should go next. Nothing here is stored: it is read back out of the
 * night's games, so a corrected start or finish time corrects every figure.
 *
 * The rule, in words a player can say out loud: _whoever has waited longest
 * goes first — but court time breaks a close call, and nobody who has played
 * a lot more than someone willing to play is picked ahead of them._
 *
 * What counts as waiting is **time in the line** — and only that. A player
 * who steps out to catch their breath, take a break or wait for a friend is
 * not in the line, so that time is never waiting and never earns priority.
 * Their played minutes are still counted exactly, break or no break.
 *
 * Like the rest of the engine, this never asks how good anyone is and never
 * keeps anyone off a court. "Underserved" is about **court time tonight**
 * and nothing else; it is shown to the organizer, and each player sees only
 * their own figures.
 */

export interface Ledger {
  readonly playerId: string;
  /** Minutes on court tonight, finished games only. */
  readonly played: number;
  readonly games: number;
  /** Minutes spent in the line while available, called games plus right now. */
  readonly waited: number;
  /** How long they have been in the line right now, or null. */
  readonly waitingNow: number | null;
  /** Minutes played on each court. */
  readonly byCourt: Readonly<Record<number, number>>;
  readonly lastEndedAt: number | null;
  /** Times they said "not this one" to a called game. */
  readonly passes: number;
  /** Minutes here but neither in the line nor on court. Never counted as waiting. */
  readonly breakMinutes: number;
  /** Everyone they have partnered tonight, with the count. */
  readonly partners: Readonly<Record<string, number>>;
  /** Everyone they have shared a court with (partners and opponents). */
  readonly playedWith: readonly string[];
  readonly onCourt: boolean;
  readonly present: boolean;
}

export function ledger(s: Session, now: number): Map<string, Ledger> {
  const rows = new Map<
    string,
    {
      played: number;
      games: number;
      waited: number;
      byCourt: Record<number, number>;
      lastEndedAt: number | null;
      passes: number;
      courtMs: number;
      partners: Record<string, number>;
      met: Set<string>;
    }
  >();
  const get = (id: string) => {
    let r = rows.get(id);
    if (!r) {
      r = {
        played: 0,
        games: 0,
        waited: 0,
        byCourt: {},
        lastEndedAt: null,
        passes: 0,
        courtMs: 0,
        partners: {},
        met: new Set(),
      };
      rows.set(id, r);
    }
    return r;
  };
  for (const id of Object.keys(s.present)) get(id);
  for (const g of s.games) {
    if (g.status === "cancelled") {
      continue;
    }
    for (const id of g.declined) get(id).passes += 1;
    for (const id of filled(g.slots)) {
      const r = get(id);
      const since = g.waitedSince[id];
      if (since !== undefined) r.waited += Math.max(0, g.calledAt - since);
      const end = g.finishedAt ?? (isActiveGame(g) ? now : g.calledAt);
      r.courtMs += Math.max(0, end - g.calledAt);
    }
    if (g.status !== "finished") continue;
    const ids = filled(g.slots);
    const mins = playedMinutes(g);
    for (const id of ids) {
      const r = get(id);
      r.games += 1;
      r.played += mins;
      r.byCourt[g.court] = (r.byCourt[g.court] ?? 0) + mins;
      r.lastEndedAt = Math.max(r.lastEndedAt ?? 0, g.finishedAt ?? 0);
      const i = g.slots.indexOf(id);
      const partner = g.slots[i ^ 1];
      if (partner) r.partners[partner] = (r.partners[partner] ?? 0) + 1;
      for (const o of ids) if (o !== id) r.met.add(o);
    }
  }
  const out = new Map<string, Ledger>();
  for (const [id, r] of rows) {
    const q = s.queue.find((x) => x.playerId === id);
    const waitingMs = q ? Math.max(0, now - q.since) : 0;
    const p = s.present[id];
    const spanMs = p ? Math.max(0, (p.leftAt ?? now) - p.at) : 0;
    const waitedMs = r.waited + waitingMs;
    out.set(id, {
      playerId: id,
      played: r.played,
      games: r.games,
      waited: Math.round(waitedMs / MINUTE),
      waitingNow: q ? Math.round(waitingMs / MINUTE) : null,
      byCourt: r.byCourt,
      lastEndedAt: r.lastEndedAt,
      passes: r.passes,
      // Whatever part of the time here was on court or in the line is
      // accounted for; the rest was the player's own (a break, a drink, a
      // wait for friends).
      breakMinutes: Math.max(
        0,
        Math.round((spanMs - r.courtMs - waitedMs) / MINUTE),
      ),
      partners: r.partners,
      playedWith: [...r.met],
      onCourt: s.games.some((g) => isActiveGame(g) && g.slots.includes(id)),
      present: !!p && p.leftAt === undefined,
    });
  }
  return out;
}

/** Average minutes played by everyone still here. */
export function averagePlayed(rows: Iterable<Ledger>): number {
  const here = [...rows].filter((r) => r.present);
  if (here.length === 0) return 0;
  return here.reduce((n, r) => n + r.played, 0) / here.length;
}

/** Court-time differences smaller than this are not a reason to reorder. */
export const CLOSE_MINUTES = 5;
/** A player this far under the average is underserved (orange, then red). */
export const UNDERSERVED_MINUTES = 8;
export const NEEDS_MINUTES = 15;
/** A late arrival can't be owed more than this by being behind. */
const CREDIT_CAP = 25;

/**
 * **Priority**, in minutes: longest wait first, court time as the adjustment.
 * Inside a few minutes of the average nothing changes (a close call is
 * decided by the wait); beyond that, being behind earns credit and being well
 * ahead costs a little more than it earns, so nobody who has played a lot is
 * picked again over someone willing who has played far less.
 */
export function priority(waited: number, played: number, average: number) {
  const gap = average - played;
  const past = Math.max(0, Math.abs(gap) - CLOSE_MINUTES);
  const credit =
    gap > 0 ? 0.75 * Math.min(past, CREDIT_CAP) : -1.25 * Math.min(past, 40);
  return waited + credit;
}

/** The line in the order the fairness engine serves it. */
export function order<T>(
  waiting: readonly T[],
  by: (w: T) => { waited: number; played: number; games: number; at: number },
  average: number,
): T[] {
  return [...waiting].sort((a, b) => {
    const x = by(a);
    const y = by(b);
    return (
      priority(y.waited, y.played, average) -
        priority(x.waited, x.played, average) ||
      x.games - y.games ||
      x.at - y.at
    );
  });
}

export type Need = "red" | "orange" | null;

export interface FairnessRow {
  readonly playerId: string;
  readonly name: string;
  readonly played: number;
  readonly average: number;
  readonly waiting: number;
  readonly waited: number;
  readonly games: number;
  readonly passes: number;
  readonly breakMinutes: number;
  readonly byCourt: Readonly<Record<number, number>>;
  readonly status: "playing" | "waiting" | "break" | "gone";
  /** Needs court time: derived from court time alone. */
  readonly need: Need;
  /** The court they should take next, or null ("Wait"). */
  readonly next: number | null;
  readonly note: string | null;
}

export interface FairnessDashboard {
  readonly average: number;
  readonly rows: FairnessRow[];
  /** The organizer's headline: who has played least and who waited longest. */
  readonly least: string | null;
  readonly longest: string | null;
  /** Plain-words recommendations, most urgent first. */
  readonly recommendations: string[];
}

/**
 * The organizer's glance: everyone checked in, least court time first, with
 * the court each should take next. `next` maps a player id to the court
 * they're prepared for (from the engine's prepared games).
 */
export function dashboard(
  club: Club,
  s: Session,
  now: number,
  next: ReadonlyMap<string, number>,
): FairnessDashboard {
  const led = ledger(s, now);
  const average = averagePlayed(led.values());
  const rows: FairnessRow[] = [];
  for (const r of led.values()) {
    const p = club.players[r.playerId];
    if (!p || !s.present[r.playerId]) continue;
    const gap = average - r.played;
    const need: Need =
      !r.present || r.onCourt || r.waitingNow === null
        ? null
        : gap >= NEEDS_MINUTES
          ? "red"
          : gap >= UNDERSERVED_MINUTES
            ? "orange"
            : null;
    const court = next.get(r.playerId) ?? null;
    rows.push({
      playerId: r.playerId,
      name: p.name,
      played: r.played,
      average: Math.round(average),
      waiting: r.waitingNow ?? 0,
      waited: r.waited,
      games: r.games,
      passes: r.passes,
      breakMinutes: r.breakMinutes,
      byCourt: r.byCourt,
      status: !r.present
        ? "gone"
        : r.onCourt
          ? "playing"
          : r.waitingNow !== null
            ? "waiting"
            : "break",
      need,
      next: court,
      note:
        r.waitingNow === null && !r.onCourt && r.present
          ? "Taking a break — not counted as waiting"
          : null,
    });
  }
  // Least court time first; then longest wait.
  rows.sort(
    (a, b) =>
      a.played - b.played ||
      b.waiting - a.waiting ||
      a.name.localeCompare(b.name),
  );
  const line = rows.filter((r) => r.status === "waiting");
  const longest = [...line].sort((a, b) => b.waiting - a.waiting)[0];
  const leastPlayed = rows.find((r) => r.status !== "gone");
  const recommendations = rows
    .filter((r) => r.need && r.status === "waiting")
    .map(
      (r) =>
        `${r.name.toUpperCase()} — NEEDS COURT TIME: played ${r.played} min, session average ${r.average} min, waiting ${r.waiting} min.` +
        (r.next
          ? ` Prioritize for Court ${r.next}.`
          : " Next court that opens."),
    );
  return {
    average: Math.round(average),
    rows,
    least: leastPlayed?.name ?? null,
    longest: longest && longest.waiting > 0 ? longest.name : null,
    recommendations,
  };
}
