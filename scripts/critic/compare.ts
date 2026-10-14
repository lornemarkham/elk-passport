import {
  DIMENSIONS,
  type Finding,
  type ScenarioResult,
  type Scores,
} from "./checks";

/**
 * **One run, as stored, and what changed since the last one.**
 *
 * A run says where its evidence came from before it says anything else,
 * because a score over a fixture and a score over live Atlas are not the same
 * measurement, and a comparison between them is mostly a comparison of data.
 * So every comparison names its cause: the code changed, the data changed,
 * the cohort changed, or several at once.
 */
export interface Run {
  readonly schema: "ghad-critic/1";
  readonly runId: string;
  readonly startedAt: string;
  readonly today: string;
  readonly source: {
    /** `live-atlas` · `atlas-snapshot` · `fixture`. Printed on every page. */
    readonly kind: "live-atlas" | "atlas-snapshot" | "fixture";
    readonly where: string;
    readonly sha256: string;
    readonly candidates: number;
    readonly fetchedAt?: string;
    /** The `on=` and `childAge=` the body answers (the oracle's questions). */
    readonly onDate?: string;
    readonly childAge?: number;
  };
  readonly code: {
    readonly commit: string;
    readonly branch: string;
    readonly dirty: boolean;
    /** Hash of the files that decide what a day is. */
    readonly fingerprint: string;
  };
  readonly cohortFingerprint: string;
  /** What `/go` asked Atlas for, recorded from the page itself. */
  readonly pageAsked: { readonly on: boolean; readonly childAge: boolean };
  readonly scenarios: readonly (ScenarioResult & {
    readonly scores: Scores;
    readonly judgement?: Judged;
  })[];
  readonly totals: Scores & {
    readonly objectiveFindings: number;
    readonly distinctStops: Readonly<Record<string, number>>;
  };
  readonly screenshots?: readonly string[];
}

export interface Judged {
  readonly by: string;
  readonly on: string;
  /** Whether the judged stops are still the stops. */
  readonly current: boolean;
  readonly scores: Readonly<Record<string, number>>;
  readonly notes: string;
}

export interface Delta {
  readonly against: string;
  readonly causes: readonly ("code" | "data" | "cohort" | "source-kind")[];
  readonly totals: Readonly<Record<string, number>>;
  readonly scenarios: readonly {
    readonly id: string;
    readonly scores: Readonly<Record<string, number>>;
    readonly added: readonly string[];
    readonly removed: readonly string[];
  }[];
  readonly newFindings: readonly Finding[];
  readonly resolvedFindings: readonly Finding[];
  /** True when something got worse that a person should look at. */
  readonly regressed: boolean;
}

/** Score movement smaller than this is noise from a rounding rule, not news. */
const NOISE = 2;

export function compare(now: Run, before: Run): Delta {
  const causes: Delta["causes"][number][] = [];
  if (now.code.fingerprint !== before.code.fingerprint) causes.push("code");
  if (now.source.sha256 !== before.source.sha256) causes.push("data");
  if (now.cohortFingerprint !== before.cohortFingerprint) causes.push("cohort");
  if (now.source.kind !== before.source.kind) causes.push("source-kind");

  const keys = [...DIMENSIONS, "overall"] as const;
  const diff = (a: Scores, b: Scores) =>
    Object.fromEntries(keys.map((k) => [k, a[k] - b[k]]));

  const prior = new Map(before.scenarios.map((s) => [s.id, s]));
  const scenarios = now.scenarios.flatMap((s) => {
    const p = prior.get(s.id);
    if (!p) return [];
    const ids = new Set(s.stops.map((x) => x.title));
    const was = new Set(p.stops.map((x) => x.title));
    return [
      {
        id: s.id,
        scores: diff(s.scores, p.scores),
        added: [...ids].filter((t) => !was.has(t)),
        removed: [...was].filter((t) => !ids.has(t)),
      },
    ];
  });

  const all = (r: Run) => r.scenarios.flatMap((s) => s.findings);
  const beforeKeys = new Set(all(before).map((f) => f.key));
  const nowKeys = new Set(all(now).map((f) => f.key));
  const newFindings = all(now).filter((f) => !beforeKeys.has(f.key));
  const resolvedFindings = all(before).filter((f) => !nowKeys.has(f.key));

  const totals = diff(now.totals, before.totals);
  const regressed =
    newFindings.some((f) => !f.check.startsWith("harness.")) ||
    keys.some((k) => (totals[k] ?? 0) <= -NOISE);

  return {
    against: before.runId,
    causes,
    totals,
    scenarios,
    newFindings,
    resolvedFindings,
    regressed,
  };
}
