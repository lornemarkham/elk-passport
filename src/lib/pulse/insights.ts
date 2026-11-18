import { MIN_GROUP, PROVINCES, type Pulse } from "./model";
import {
  breakdown,
  wholePercents,
  type Breakdown,
  type VoteRow,
} from "./tally";

/**
 * **What the votes add up to beyond the totals**: a map of provinces, how
 * the answers moved as more people voted, and how the Pulse spread.
 *
 * Everything here is an aggregate. No voter is named, no referral code
 * leaves the server, and every group obeys the same rule as the rest of
 * Pulse: nothing is shown under MIN_GROUP votes, and then only in steps of
 * MIN_GROUP. Spread counts people by how many links they are from the
 * start; it never says what any of them answered.
 */

export interface MapProvince {
  readonly code: string;
  readonly name: string;
  /** "hidden" means fewer than MIN_GROUP votes: not even a count is shown. */
  readonly state: "shown" | "hidden";
  readonly breakdown: Breakdown | null;
}

export interface Shifts {
  /** Option ids, in the order of each point's `pct`. */
  readonly options: readonly string[];
  /** After the first `n` votes, each answer's whole percentage. */
  readonly points: readonly { readonly n: number; readonly pct: number[] }[];
}

export interface NetworkRow extends Breakdown {
  /** "Network 1", "Network 2" … by size; never derived from a code. */
  readonly label: string;
  /** The network your own link belongs to. */
  readonly mine: boolean;
}

export interface Generation {
  /** 0 arrived directly; 1 through one link; 2 through a friend of a friend … */
  readonly gen: number;
  readonly votes: number;
}

export interface Spread {
  readonly generations: readonly Generation[];
  readonly networks: readonly NetworkRow[];
  /** Votes in networks too small to show on their own, plus direct visits. */
  readonly pooled: number;
  readonly referred: number;
  readonly direct: number;
  /** Provinces large enough to be named. */
  readonly provincesReached: number;
  /** The same count of generations, for the people your own link reached. */
  readonly mine: readonly Generation[] | null;
}

export interface Insights {
  readonly map: readonly MapProvince[];
  readonly shifts: Shifts;
  readonly spread: Spread;
}

/** The earliest point on the shifts chart: fewer votes say nothing. */
export const SHIFTS_FROM = 10;
const SHIFT_POINTS = 40;

export function computeShifts(
  options: readonly { readonly id: string }[],
  votesOldestFirst: readonly Pick<VoteRow, "option">[],
): Shifts {
  const ids = options.map((o) => o.id);
  const total = votesOldestFirst.length;
  if (total < SHIFTS_FROM) return { options: ids, points: [] };
  const step = Math.max(
    1,
    Math.ceil((total - SHIFTS_FROM) / (SHIFT_POINTS - 2)),
  );
  const marks = new Set<number>([SHIFTS_FROM, total]);
  for (let n = SHIFTS_FROM + step; n < total; n += step) marks.add(n);
  const counts = new Array<number>(ids.length).fill(0);
  const points: { n: number; pct: number[] }[] = [];
  votesOldestFirst.forEach((v, i) => {
    const at = ids.indexOf(v.option);
    if (at >= 0) counts[at]! += 1;
    if (marks.has(i + 1)) points.push({ n: i + 1, pct: wholePercents(counts) });
  });
  return { options: ids, points };
}

interface Walked {
  readonly gen: number;
  /** The top of the chain: who started this network. Never leaves the server. */
  readonly root: string;
}

/**
 * For each vote, how many links from the start it is and which network it
 * belongs to. A loop (A through B's link, B through A's) ends where it
 * closes instead of spinning.
 */
function walk(votes: readonly VoteRow[]): Map<string, Walked> {
  const byCircle = new Map(votes.map((v) => [v.circle, v]));
  const done = new Map<string, Walked>();
  for (const start of votes) {
    if (done.has(start.circle)) continue;
    const path: VoteRow[] = [];
    const seen = new Set<string>();
    let cur: VoteRow | undefined = start;
    let base: Walked | undefined;
    while (cur) {
      const known = done.get(cur.circle);
      if (known) {
        base = known;
        break;
      }
      if (seen.has(cur.circle)) break;
      seen.add(cur.circle);
      path.push(cur);
      cur = cur.via ? byCircle.get(cur.via) : undefined;
    }
    // `cur` is where the chain stopped: known, a loop, or the top.
    const top = path[path.length - 1]!;
    let gen = base ? base.gen + 1 : top.via ? 1 : 0;
    const root = base ? base.root : (top.via ?? top.circle);
    for (let i = path.length - 1; i >= 0; i--) {
      done.set(path[i]!.circle, { gen, root });
      gen += 1;
    }
  }
  return done;
}

const generationCounts = (gens: Iterable<number>): Generation[] => {
  const by = new Map<number, number>();
  for (const g of gens) by.set(g, (by.get(g) ?? 0) + 1);
  return [...by]
    .sort((a, b) => a[0] - b[0])
    .map(([gen, votes]) => ({ gen, votes }));
};

/** Counts of the people reached through `root`'s link, level by level. */
function reachedFrom(votes: readonly VoteRow[], root: string): Generation[] {
  const out: Generation[] = [];
  const seen = new Set([root]);
  let level = new Set([root]);
  for (let gen = 1; level.size > 0 && gen <= 12; gen++) {
    const next = new Set<string>();
    for (const v of votes)
      if (v.via && level.has(v.via) && !seen.has(v.circle)) next.add(v.circle);
    if (next.size === 0) break;
    out.push({ gen, votes: next.size });
    next.forEach((c) => seen.add(c));
    level = next;
  }
  return out;
}

export function computeInsights(
  pulse: Pick<Pulse, "options">,
  votesOldestFirst: readonly VoteRow[],
  myCircle: string | null,
): Insights {
  const votes = votesOldestFirst;

  const map: MapProvince[] = PROVINCES.map((p) => {
    const rows = votes.filter((v) => v.province === p.code);
    return rows.length < MIN_GROUP
      ? { code: p.code, name: p.name, state: "hidden", breakdown: null }
      : {
          code: p.code,
          name: p.name,
          state: "shown",
          breakdown: breakdown(pulse.options, rows),
        };
  });

  const walked = walk(votes);
  const groups = new Map<string, VoteRow[]>();
  for (const v of votes) {
    const w = walked.get(v.circle)!;
    const list = groups.get(w.root);
    if (list) list.push(v);
    else groups.set(w.root, [v]);
  }
  const mineRoot = myCircle ? (walked.get(myCircle)?.root ?? myCircle) : null;
  const big = [...groups]
    .filter(([, rows]) => rows.length >= MIN_GROUP)
    .sort(
      (a, b) =>
        b[1].length - a[1].length || a[1][0]!.at.localeCompare(b[1][0]!.at),
    );
  const networks: NetworkRow[] = big.map(([root, rows], i) => ({
    label: `Network ${i + 1}`,
    mine: root === mineRoot,
    ...breakdown(pulse.options, rows),
  }));
  const named = big.reduce((n, [, rows]) => n + rows.length, 0);

  const referred = votes.filter((v) => v.via).length;
  return {
    map,
    shifts: computeShifts(pulse.options, votes),
    spread: {
      generations: generationCounts([...walked.values()].map((w) => w.gen)),
      networks,
      pooled: votes.length - named,
      referred,
      direct: votes.length - referred,
      provincesReached: map.filter((m) => m.state === "shown").length,
      mine: myCircle ? reachedFrom(votes, myCircle) : null,
    },
  };
}
