import "server-only";
import type { PickerEntity } from "@/components/admin/entities/EntityPicker";
import { hasRealType } from "@/components/admin/entities/entityGaps";
import type { WorkspaceBundle } from "./workspaceData";
import type { IngestionRun } from "./runData";

/**
 * **What Atlas knows, what it doesn't, and what to do about it.**
 *
 * ## Why a diagnosis rather than more statistics
 *
 * A row of numbers makes a curator do the interpretation: *is 75% good?
 * is 6 untyped entities a problem?* Every one of those judgements is the
 * same each time, so the page should make it. **A metric states a fact; a
 * finding states what the fact means and what to do about it.**
 *
 * ## Every finding is measured, and none is a grade
 *
 * Each one counts something Atlas actually holds or actually lacks.
 * Nothing here scores the region, ranks it, or compares it to a target
 * nobody set — the thresholds that exist (50% coverage) are stated in the
 * finding's own words so a curator can disagree with the threshold rather
 * than with a hidden verdict.
 *
 * ## Absence of a problem is worth saying
 *
 * Findings that are *good* are returned too. A page that shows only
 * warnings leaves the curator unable to tell "nothing is wrong" from
 * "nothing was checked" — the same conflation as a fabricated zero, and
 * the reason this file returns `ok` findings instead of filtering them
 * out.
 */

export type FindingTone = "good" | "attention";

export interface Finding {
  readonly tone: FindingTone;
  readonly title: string;
  /** Plain English: what this means, in the curator's terms. Never jargon. */
  readonly detail: string;
  /** How many entities this concerns, when it concerns entities. */
  readonly count?: number;
}

export type ActionKind = "grow" | "review" | "nothing";

export interface RecommendedAction {
  readonly kind: ActionKind;
  readonly title: string;
  /** Why this is the next thing, in one sentence. */
  readonly why: string;
  /** What Atlas will actually do, step by step. Written before it happens. */
  readonly willDo: readonly string[];
  /** Real counts of work waiting. Never an invented estimate. */
  readonly queuedSources: number;
  /**
   * Seconds, derived from Atlas's **own** completed growth runs. `null`
   * when there is no history — an estimate with nothing behind it is the
   * same class of error as a fabricated identifier: a number that looks
   * like evidence.
   */
  readonly estimatedSeconds: number | null;
}

export interface RegionDiagnosis {
  readonly findings: readonly Finding[];
  readonly action: RecommendedAction;
}

export function diagnoseRegion(input: {
  readonly regionName: string;
  readonly rows: readonly PickerEntity[];
  readonly scopeIds: ReadonlySet<string>;
  readonly averageCompleteness: number | null;
  readonly waitingCount: number;
  readonly runningCount: number;
  readonly bundle: WorkspaceBundle | null;
  readonly runs: readonly IngestionRun[];
}): RegionDiagnosis {
  const {
    regionName,
    rows,
    scopeIds,
    averageCompleteness,
    waitingCount,
    runningCount,
    bundle,
    runs,
  } = input;

  const findings: Finding[] = [];

  const untyped = rows.filter((r) => !hasRealType(r)).length;
  const noSources = rows.filter((r) => r.sourceCount === 0).length;
  const noImage = rows.filter((r) => !r.hasImage).length;
  const thin = rows.filter((r) => r.score !== null && r.score < 50).length;
  const isolated = rows.filter((r) => r.relationshipCount === 0).length;

  if (averageCompleteness !== null) {
    findings.push(
      averageCompleteness >= 70
        ? {
            tone: "good",
            title: `Knowledge coverage is ${averageCompleteness}%`,
            detail:
              "Averaged across everything in this region. It measures how much of what Atlas tries to know it has, not how much exists in the world.",
          }
        : {
            tone: "attention",
            title: `Knowledge coverage is ${averageCompleteness}%`,
            detail:
              "Most entities here are missing things Atlas knows how to look for. Growing the region reads more of what it already knows exists.",
          },
    );
  }

  if (noSources > 0) {
    findings.push({
      tone: "attention",
      count: noSources,
      title: `${noSources} ${noSources === 1 ? "entity has" : "entities have"} no source`,
      detail:
        "Nothing Atlas has read mentions them, so everything on their page came from somewhere else. These are the least trustworthy entries in the region.",
    });
  } else if (rows.length > 0) {
    findings.push({
      tone: "good",
      title: "Every entity has evidence behind it",
      detail:
        "Each one is described by at least one source Atlas fetched and stored.",
    });
  }

  if (untyped > 0) {
    findings.push({
      tone: "attention",
      count: untyped,
      title: `${untyped} ${untyped === 1 ? "entity has" : "entities have"} no type`,
      detail:
        "Atlas never established what kind of place these are. Type will decide which layout, completeness rules and research a page gets, so untyped entities cannot be improved systematically.",
    });
  }

  if (thin > 0) {
    findings.push({
      tone: "attention",
      count: thin,
      title: `${thin} below 50% coverage`,
      detail:
        "Atlas holds less than half of what it looks for on these. They are the highest-value things to grow.",
    });
  }

  if (isolated > 0) {
    findings.push({
      tone: "attention",
      count: isolated,
      title: `${isolated} connected to nothing`,
      detail:
        "No relationship links these to anything else in the region, so they cannot be reached by exploring — only by searching for them by name.",
    });
  }

  if (noImage > 0) {
    findings.push({
      tone: "attention",
      count: noImage,
      title: `${noImage} without an image`,
      detail:
        "Atlas only uses images a source published — it never constructs an image URL — so these need a source that carries one.",
    });
  }

  if (waitingCount > 0) {
    findings.push({
      tone: "attention",
      count: waitingCount,
      title: `${waitingCount} research ${waitingCount === 1 ? "finding" : "findings"} waiting on you`,
      detail:
        "Atlas researched something and stopped before writing it. It proposes; a person decides.",
    });
  }

  if (runningCount > 0) {
    findings.push({
      tone: "good",
      count: runningCount,
      title: `${runningCount} research ${runningCount === 1 ? "mission" : "missions"} in progress`,
      detail:
        "Requested and not yet back. Run them with `npm run run-missions`.",
    });
  }

  // Queued work inside this region's scope. Real rows in the queue, not an
  // estimate of how much there might be.
  const queuedSources = (bundle?.candidateSources ?? []).filter(
    (c) =>
      c.status === "queued" &&
      typeof c.aboutEntityId === "string" &&
      scopeIds.has(c.aboutEntityId),
  ).length;

  const action = recommend({
    regionName,
    queuedSources,
    waitingCount,
    untyped,
    runs,
  });

  return { findings, action };
}

function recommend(input: {
  regionName: string;
  queuedSources: number;
  waitingCount: number;
  untyped: number;
  runs: readonly IngestionRun[];
}): RecommendedAction {
  const { regionName, queuedSources, waitingCount, runs } = input;

  const estimatedSeconds = estimateFromHistory(runs);

  // A decision waiting on a human outranks more machine work. Growing
  // while findings sit unreviewed adds to a queue nobody is draining.
  if (waitingCount > 0) {
    return {
      kind: "review",
      title: `Review ${waitingCount} finding${waitingCount === 1 ? "" : "s"}`,
      why: "Atlas has already done the research and is waiting on a decision. Deciding first means growth builds on knowledge you have accepted.",
      willDo: [
        "Show you what Atlas found, and the source it came from",
        "Write it to the entity only if you accept it",
        "Leave the evidence in place either way",
      ],
      queuedSources,
      estimatedSeconds,
    };
  }

  if (queuedSources > 0) {
    return {
      kind: "grow",
      title: `Grow ${regionName}`,
      why: `Atlas already knows about ${queuedSources} page${queuedSources === 1 ? "" : "s"} in this region it has not read yet.`,
      willDo: [
        `Read ${queuedSources} page${queuedSources === 1 ? "" : "s"} Atlas already discovered`,
        "Add facts to entities that are already here",
        "Create entities for anything new it finds inside them",
        "Queue further pages it discovers — for the next run, never this one",
      ],
      queuedSources,
      estimatedSeconds,
    };
  }

  return {
    kind: "nothing",
    title: "Nothing is waiting",
    why: `Atlas has read everything it currently knows about in ${regionName}. Growth would find nothing new.`,
    willDo: [
      "Give Atlas a new source to start from, with `npm run define-region`",
      "Or request research on a specific gap from an entity's page",
    ],
    queuedSources: 0,
    estimatedSeconds,
  };
}

/**
 * How long past growth runs actually took.
 *
 * Derived from Atlas's own completed runs and nothing else. With no
 * history it returns `null` and the page says so, rather than producing a
 * confident guess — the same rule `RegionLearningPlanner` already follows,
 * and for the same reason: **a number that looks like evidence and isn't
 * is the most expensive kind of wrong.**
 */
function estimateFromHistory(runs: readonly IngestionRun[]): number | null {
  const finished = runs.filter(
    (r) =>
      r.kind === "region-growth" && r.status === "completed" && r.finishedAt,
  );
  if (finished.length === 0) return null;

  const total = finished.reduce(
    (sum, r) =>
      sum +
      (new Date(r.finishedAt!).getTime() - new Date(r.startedAt).getTime()) /
        1000,
    0,
  );
  return Math.round(total / finished.length);
}
