import { MIN_GROUP, type PulseOption } from "./model";

/**
 * The small counting rules every results view shares: whole percentages that
 * add to 100, a subset released only at MIN_GROUP votes and in steps of
 * MIN_GROUP, and who belongs to whose circle. Pure.
 */

export interface VoteRow {
  readonly option: string;
  readonly province: string | null;
  readonly city: string | null;
  readonly at: string;
  /** This voter's own referral code on this Pulse. */
  readonly circle: string;
  /** The referral code of the link they arrived through, if any. */
  readonly via: string | null;
}

export interface Share {
  readonly optionId: string;
  readonly label: string;
  readonly n: number;
  /** Whole percentages that add up to 100 (or all 0 with no votes). */
  readonly pct: number;
}

export interface Breakdown {
  /** Votes in the group. */
  readonly total: number;
  /** How many of them the shares are counted over (a multiple of MIN_GROUP). */
  readonly counted: number;
  /** Null while the group is too small to show. */
  readonly shares: readonly Share[] | null;
}

/** Largest-remainder rounding: whole numbers that sum to exactly 100. */
export function wholePercents(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((n) => (n * 100) / total);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, rem: r - Math.floor(r) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floor[i]! += 1;
    left -= 1;
  }
  return floor;
}

export function shares(
  options: readonly PulseOption[],
  votes: readonly Pick<VoteRow, "option">[],
): Share[] {
  const counts = options.map(
    (o) => votes.filter((v) => v.option === o.id).length,
  );
  const pct = wholePercents(counts);
  return options.map((o, i) => ({
    optionId: o.id,
    label: o.label,
    n: counts[i]!,
    pct: pct[i]!,
  }));
}

/** A subset, released in steps of `min` and only once it has `min` votes. */
export function breakdown(
  options: readonly PulseOption[],
  votesOldestFirst: readonly VoteRow[],
  min = MIN_GROUP,
): Breakdown {
  const total = votesOldestFirst.length;
  if (total < min) return { total, counted: 0, shares: null };
  const counted = Math.floor(total / min) * min;
  return {
    total,
    counted,
    shares: shares(options, votesOldestFirst.slice(0, counted)),
  };
}

/**
 * Everyone who arrived through `root`'s link, through theirs, and so on —
 * plus `root` itself. A code is a set member, so a loop (A shared with B, B
 * back with A) ends instead of spinning.
 */
export function circleCodes(
  votes: readonly VoteRow[],
  root: string,
): Set<string> {
  const codes = new Set([root]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const v of votes) {
      if (v.via && codes.has(v.via) && !codes.has(v.circle)) {
        codes.add(v.circle);
        grew = true;
      }
    }
  }
  return codes;
}
