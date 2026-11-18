import {
  MIN_GROUP,
  PROVINCES,
  provinceName,
  type Pulse,
  type PulseOption,
} from "./model";

/**
 * **Turning votes into results without giving anyone away.**
 *
 * The server reads a Pulse's votes (answer, self-reported place, time, and
 * the two referral codes, never who) and this file decides what may be shown:
 *
 *   - Everyone: live, exact.
 *   - A subset (a circle, a province, a city) is shown only once it has
 *     MIN_GROUP votes, and then **in steps of MIN_GROUP**: its answers are
 *     counted over its earliest `floor(n / 5) * 5` votes. Watching your circle
 *     while a friend votes therefore shows nothing until four more people have
 *     voted too, so no single person's answer can be read off a change.
 *   - Places with fewer than MIN_GROUP votes are not named at all.
 *
 * Pure: the same votes give the same results, so the tests can pin it.
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

export interface Place extends Breakdown {
  readonly key: string;
  readonly name: string;
}

export interface Results {
  readonly total: number;
  readonly everyone: readonly Share[];
  readonly circle: (Breakdown & { readonly joinedViaYou: number }) | null;
  readonly provinces: readonly Place[];
  /** Provinces with too few votes to name, pooled into one honest line. */
  readonly otherPlaces: number;
  readonly cities: readonly Place[];
  /** Voters who chose not to say where they are. */
  readonly unplaced: number;
  readonly timeline: Timeline;
  readonly claim: ClaimComparison | null;
  readonly minGroup: number;
}

export interface Timeline {
  readonly bucket: "hour" | "day";
  /** Cumulative votes at the end of each bucket. */
  readonly points: readonly { readonly t: string; readonly total: number }[];
}

export interface ClaimComparison {
  readonly optionId: string;
  readonly label: string;
  readonly claimed: number;
  readonly pulse: number | null;
  readonly source: string;
  readonly url: string;
  readonly text: string;
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

export function timeline(
  votesOldestFirst: readonly VoteRow[],
  since: string,
  now: Date,
): Timeline {
  const start = new Date(since).getTime();
  const span = now.getTime() - start;
  const bucket: Timeline["bucket"] = span <= 72 * 3_600_000 ? "hour" : "day";
  const size = bucket === "hour" ? 3_600_000 : 86_400_000;
  const first = Math.floor(start / size) * size;
  const last = Math.floor(now.getTime() / size) * size;
  const buckets = Math.min(400, Math.floor((last - first) / size) + 1);
  const counts = new Array<number>(buckets).fill(0);
  for (const v of votesOldestFirst) {
    const i = Math.floor((new Date(v.at).getTime() - first) / size);
    counts[Math.max(0, Math.min(buckets - 1, i))]! += 1;
  }
  let running = 0;
  return {
    bucket,
    points: counts.map((n, i) => {
      running += n;
      return { t: new Date(first + i * size).toISOString(), total: running };
    }),
  };
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function computeResults(
  pulse: Pulse,
  votes: readonly VoteRow[],
  myCircle: string | null,
  now: Date,
): Results {
  const sorted = [...votes].sort(
    (a, b) => a.at.localeCompare(b.at) || a.circle.localeCompare(b.circle),
  );
  const everyone = shares(pulse.options, sorted);

  let circle: Results["circle"] = null;
  if (myCircle) {
    const codes = circleCodes(sorted, myCircle);
    const members = sorted.filter((v) => codes.has(v.circle));
    circle = {
      ...breakdown(pulse.options, members),
      joinedViaYou: sorted.filter((v) => v.via === myCircle).length,
    };
  }

  const byProvince = new Map<string, VoteRow[]>();
  const byCity = new Map<string, VoteRow[]>();
  let unplaced = 0;
  for (const v of sorted) {
    if (!v.province) {
      unplaced += 1;
      continue;
    }
    push(byProvince, v.province, v);
    if (v.city) push(byCity, `${v.city}, ${v.province}`, v);
  }
  const order = (a: Place, b: Place) =>
    b.total - a.total || a.name.localeCompare(b.name);
  let otherPlaces = 0;
  const provinces: Place[] = [];
  for (const p of PROVINCES) {
    const rows = byProvince.get(p.code);
    if (!rows) continue;
    if (rows.length < MIN_GROUP) {
      otherPlaces += rows.length;
      continue;
    }
    provinces.push({
      key: p.code,
      name: provinceName(p.code),
      ...breakdown(pulse.options, rows),
    });
  }
  const cities: Place[] = [...byCity]
    .filter(([, rows]) => rows.length >= MIN_GROUP)
    .map(([key, rows]) => ({
      key,
      name: key,
      ...breakdown(pulse.options, rows),
    }));

  let claim: ClaimComparison | null = null;
  if (pulse.claim && pulse.claim.percent !== null && pulse.claim.optionId) {
    const share = everyone.find((s) => s.optionId === pulse.claim!.optionId);
    claim = {
      optionId: pulse.claim.optionId,
      label: share?.label ?? "",
      claimed: pulse.claim.percent,
      pulse: sorted.length >= MIN_GROUP ? (share?.pct ?? 0) : null,
      source: pulse.claim.source,
      url: pulse.claim.url,
      text: pulse.claim.text,
    };
  }

  return {
    total: sorted.length,
    everyone,
    circle,
    provinces: provinces.sort(order),
    otherPlaces,
    cities: cities.sort(order),
    unplaced,
    timeline: timeline(sorted, pulse.createdAt, now),
    claim,
    minGroup: MIN_GROUP,
  };
}
