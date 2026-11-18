import {
  MIN_GROUP,
  PROVINCES,
  kindOf,
  provinceName,
  type Pulse,
} from "./model";
import { computeInsights, type Insights } from "./insights";
import { modeResults, type ModeResults } from "./modes";
import {
  breakdown,
  circleCodes,
  shares,
  type Breakdown,
  type Share,
  type VoteRow,
} from "./tally";

export { breakdown, circleCodes, shares, wholePercents } from "./tally";
export type { Breakdown, Share, VoteRow } from "./tally";

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
  /** The map, how answers moved, and how the Pulse spread. */
  readonly insights: Insights;
  /** What the Pulse's kind adds: reasons, a verdict, a distribution, a ranking. */
  readonly modes: ModeResults;
  readonly minGroup: number;
}

export interface Timeline {
  readonly bucket: "hour" | "day";
  /** Cumulative votes at the end of each bucket, and how many of them arrived through a shared link. */
  readonly points: readonly {
    readonly t: string;
    readonly total: number;
    readonly referred: number;
  }[];
}

export interface ClaimComparison {
  readonly optionId: string;
  readonly label: string;
  readonly claimed: number;
  readonly pulse: number | null;
  readonly source: string;
  readonly url: string;
  readonly text: string;
  /** What the creator says about the claim; never checked by Pulse. */
  readonly published: string | null;
  readonly measures: string | null;
  readonly method: string | null;
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
  const referred = new Array<number>(buckets).fill(0);
  for (const v of votesOldestFirst) {
    const i = Math.max(
      0,
      Math.min(
        buckets - 1,
        Math.floor((new Date(v.at).getTime() - first) / size),
      ),
    );
    counts[i]! += 1;
    if (v.via) referred[i]! += 1;
  }
  let running = 0;
  let viaLink = 0;
  return {
    bucket,
    points: counts.map((n, i) => {
      running += n;
      viaLink += referred[i]!;
      return {
        t: new Date(first + i * size).toISOString(),
        total: running,
        referred: viaLink,
      };
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
  mine: string | null = null,
): Results {
  const all = [...votes].sort(
    (a, b) => a.at.localeCompare(b.at) || a.circle.localeCompare(b.circle),
  );
  // Is This Normal? asks about money and time, so even Everyone is released
  // only in steps of MIN_GROUP: every view below is drawn from that pool.
  const sorted =
    kindOf(pulse) === "normal"
      ? all.slice(0, Math.floor(all.length / MIN_GROUP) * MIN_GROUP)
      : all;
  const everyone = shares(pulse.options, sorted);

  let circle: Results["circle"] = null;
  const codes = myCircle ? circleCodes(sorted, myCircle) : null;
  if (myCircle && codes) {
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
      published: pulse.claim.published ?? null,
      measures: pulse.claim.measures ?? null,
      method: pulse.claim.method ?? null,
    };
  }

  return {
    total: all.length,
    everyone,
    circle,
    provinces: provinces.sort(order),
    otherPlaces,
    cities: cities.sort(order),
    unplaced,
    timeline: timeline(sorted, pulse.createdAt, now),
    claim,
    insights: computeInsights(pulse, sorted, myCircle),
    modes: modeResults(pulse, sorted, everyone, codes, mine),
    minGroup: MIN_GROUP,
  };
}
