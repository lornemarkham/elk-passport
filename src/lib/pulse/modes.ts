import { MIN_GROUP, kindOf, type Pulse } from "./model";
import {
  breakdown,
  shares,
  type Breakdown,
  type Share,
  type VoteRow,
} from "./tally";

/**
 * **What each Quick Ideas mode adds to a Pulse's results.** Pure, like
 * results.ts, and under the same privacy rules: anything about a subset — and,
 * for Is This Normal?, even everyone — shows only from MIN_GROUP votes and
 * moves in steps of MIN_GROUP, counted over the earliest votes, so one new
 * answer can never be read off a change.
 */

// ── Should I Do It? and anything else with reasons ──────────────────────────

export interface Word {
  readonly word: string;
  readonly n: number;
}

export interface ReasonGroup {
  readonly optionId: string;
  readonly label: string;
  /** Votes for this answer that carried a reason (of those counted). */
  readonly written: number;
  /** The reasons themselves, newest of the counted first, at most 30. */
  readonly quotes: readonly string[];
  /** Words that come up in two or more reasons, most first. */
  readonly words: readonly Word[];
}

export interface Reasons {
  /** Votes the reasons are drawn from: a multiple of MIN_GROUP. */
  readonly counted: number;
  readonly total: number;
  /** Null until MIN_GROUP votes are in. */
  readonly groups: readonly ReasonGroup[] | null;
  /** Reasons from your circle, without their answers, once it has MIN_GROUP. */
  readonly circle: readonly string[] | null;
}

const STOP = new Set(
  "a about after again all also am an and any are as at be because been but by can could did do does doing dont don't for from get got had has have he her him his how i i'm if in into is it it's its just like make me more most much my no not now of on one only or other our out over really said same she should so some than that that's the their them then there these they thing think this those to too up us very was way we well were what when where which who why will with would yes you your yeah yet go going want need im ive i've cant can't wont won't".split(
    " ",
  ),
);

/**
 * The plain, non-AI summary: which words more than one person used. It
 * counts each word once per reason, so one long rant can't dominate.
 */
export function commonWords(texts: readonly string[], top = 6): Word[] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    const words = new Set(
      t
        .toLowerCase()
        .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
        .split(/\s+/)
        .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
        .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)),
    );
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([word, n]) => ({ word, n }));
}

/** A fixed shuffle (by text), so a circle's newest reason isn't always last. */
const byText = (a: string, b: string) => {
  const h = (s: string) => {
    let x = 2166136261;
    for (let i = 0; i < s.length; i++)
      x = Math.imul(x ^ s.charCodeAt(i), 16777619);
    return x >>> 0;
  };
  return h(a) - h(b);
};

export function reasonsOf(
  pulse: Pulse,
  sortedOldestFirst: readonly VoteRow[],
  circleCodes: ReadonlySet<string> | null,
): Reasons {
  const total = sortedOldestFirst.length;
  const counted = Math.floor(total / MIN_GROUP) * MIN_GROUP;
  const pool = sortedOldestFirst.slice(0, counted);
  const groups =
    counted === 0
      ? null
      : pulse.options.map((o) => {
          const texts = pool
            .filter((v) => v.option === o.id && v.reason)
            .map((v) => v.reason!);
          return {
            optionId: o.id,
            label: o.label,
            written: texts.length,
            quotes: [...texts].reverse().slice(0, 30),
            words: commonWords(texts),
          };
        });
  let circle: string[] | null = null;
  if (circleCodes) {
    const members = sortedOldestFirst.filter((v) => circleCodes.has(v.circle));
    if (members.length >= MIN_GROUP) {
      const take = Math.floor(members.length / MIN_GROUP) * MIN_GROUP;
      circle = members
        .slice(0, take)
        .filter((v) => v.reason)
        .map((v) => v.reason!)
        .sort(byText);
    }
  }
  return { counted, total, groups, circle };
}

// ── Settle This ─────────────────────────────────────────────────────────────

export type Verdict =
  | { readonly status: "early"; readonly needed: number }
  | { readonly status: "tie"; readonly labels: readonly string[] }
  | {
      readonly status: "close" | "settled";
      readonly winner: string;
      readonly pct: number;
      /** Points ahead of the runner-up. */
      readonly margin: number;
    };

/** Under 10 points between the top two is called close, not settled. */
export const SETTLE_MARGIN = 10;

export function verdict(everyone: readonly Share[], total: number): Verdict {
  if (total < MIN_GROUP) return { status: "early", needed: MIN_GROUP - total };
  const sorted = [...everyone].sort((a, b) => b.n - a.n);
  const [first, second] = sorted as [Share, Share];
  if (first.n === second.n)
    return {
      status: "tie",
      labels: sorted.filter((s) => s.n === first.n).map((s) => s.label),
    };
  const margin = first.pct - second.pct;
  return {
    status: margin < SETTLE_MARGIN ? "close" : "settled",
    winner: first.label,
    pct: first.pct,
    margin,
  };
}

// ── Is This Normal? ─────────────────────────────────────────────────────────

export interface Distribution extends Breakdown {
  /** The range the middle voter picked (of those counted). */
  readonly median: string | null;
}

export interface Normal {
  readonly everyone: Distribution;
  /** Where your range sits among those counted: below, same, above (%). */
  readonly you: {
    readonly below: number;
    readonly same: number;
    readonly above: number;
  } | null;
  readonly groupLabel: string | null;
  readonly groups: readonly (Distribution & {
    readonly key: string;
    readonly name: string;
  })[];
  /** Voters in categories too small to show. */
  readonly hiddenGroups: number;
}

function distribution(pulse: Pulse, rows: readonly VoteRow[]): Distribution {
  const b = breakdown(pulse.options, rows);
  if (!b.shares) return { ...b, median: null };
  const counts = b.shares.map((s) => s.n);
  const half = b.counted / 2;
  let run = 0;
  let median: string | null = null;
  for (let i = 0; i < counts.length; i++) {
    run += counts[i]!;
    if (run >= half) {
      median = b.shares[i]!.label;
      break;
    }
  }
  return { ...b, median };
}

export function normalOf(
  pulse: Pulse,
  sortedOldestFirst: readonly VoteRow[],
  mine: string | null,
): Normal {
  const everyone = distribution(pulse, sortedOldestFirst);
  let you: Normal["you"] = null;
  const at = pulse.options.findIndex((o) => o.id === mine);
  if (everyone.shares && at >= 0) {
    const n = everyone.counted;
    const ns = everyone.shares.map((s) => s.n);
    const below = ns.slice(0, at).reduce((a, b) => a + b, 0);
    const same = ns[at]!;
    const pct = (x: number) => Math.round((x * 100) / n);
    you = {
      below: pct(below),
      same: pct(same),
      above: Math.max(0, 100 - pct(below) - pct(same)),
    };
  }
  const groups: Normal["groups"][number][] = [];
  let hiddenGroups = 0;
  for (const g of pulse.group?.options ?? []) {
    const rows = sortedOldestFirst.filter((v) => v.group === g.id);
    if (rows.length < MIN_GROUP) {
      hiddenGroups += rows.length;
      continue;
    }
    groups.push({ key: g.id, name: g.label, ...distribution(pulse, rows) });
  }
  return {
    everyone,
    you,
    groupLabel: pulse.group?.label ?? null,
    groups,
    hiddenGroups,
  };
}

// ── Rank These ──────────────────────────────────────────────────────────────

export interface Ranked {
  readonly optionId: string;
  readonly label: string;
  /** Borda points: last place 0, first place (options − 1). */
  readonly points: number;
  /** Average position, 1 = first. */
  readonly average: number;
  /** Share of rankings that put it first. */
  readonly firstPct: number;
}

export interface Ranking {
  readonly total: number;
  readonly items: readonly Ranked[];
  /** Your circle's order, once it has MIN_GROUP rankings, in steps of MIN_GROUP. */
  readonly circle: readonly Ranked[] | null;
}

export function rankItems(pulse: Pulse, rows: readonly VoteRow[]): Ranked[] {
  const n = pulse.options.length;
  const ranked = rows.filter((v) => v.ranking && v.ranking.length === n);
  const firsts = shares(
    pulse.options,
    ranked.map((v) => ({ option: `o${v.ranking![0]}` })),
  );
  return pulse.options
    .map((o, i) => {
      const digit = String(i + 1);
      let points = 0;
      let positions = 0;
      for (const v of ranked) {
        const pos = v.ranking!.indexOf(digit);
        points += n - 1 - pos;
        positions += pos + 1;
      }
      return {
        optionId: o.id,
        label: o.label,
        points,
        average: ranked.length
          ? Math.round((positions / ranked.length) * 10) / 10
          : 0,
        firstPct: firsts[i]!.pct,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.firstPct - a.firstPct ||
        a.label.localeCompare(b.label),
    );
}

export function rankingOf(
  pulse: Pulse,
  sortedOldestFirst: readonly VoteRow[],
  circleCodes: ReadonlySet<string> | null,
): Ranking {
  let circle: Ranked[] | null = null;
  if (circleCodes) {
    const members = sortedOldestFirst.filter((v) => circleCodes.has(v.circle));
    if (members.length >= MIN_GROUP)
      circle = rankItems(
        pulse,
        members.slice(0, Math.floor(members.length / MIN_GROUP) * MIN_GROUP),
      );
  }
  return {
    total: sortedOldestFirst.filter((v) => v.ranking).length,
    items: rankItems(pulse, sortedOldestFirst),
    circle,
  };
}

// ── Together ────────────────────────────────────────────────────────────────

export interface ModeResults {
  readonly reasons: Reasons | null;
  readonly verdict: Verdict | null;
  readonly normal: Normal | null;
  readonly ranking: Ranking | null;
}

export function modeResults(
  pulse: Pulse,
  sortedOldestFirst: readonly VoteRow[],
  everyone: readonly Share[],
  circleCodes: ReadonlySet<string> | null,
  mine: string | null,
): ModeResults {
  const kind = kindOf(pulse);
  return {
    reasons: pulse.reasons
      ? reasonsOf(pulse, sortedOldestFirst, circleCodes)
      : null,
    verdict:
      kind === "settle" ? verdict(everyone, sortedOldestFirst.length) : null,
    normal: kind === "normal" ? normalOf(pulse, sortedOldestFirst, mine) : null,
    ranking:
      kind === "rank" ? rankingOf(pulse, sortedOldestFirst, circleCodes) : null,
  };
}
