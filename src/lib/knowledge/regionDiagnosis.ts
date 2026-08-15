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

/**
 * What a curator can do about a finding, right now.
 *
 * **Every finding carries one.** A finding without an action is a
 * complaint — it tells a curator something is wrong and leaves them to
 * work out where to go, which is the "what am I supposed to do?" this
 * page exists to end.
 *
 * Four kinds, in descending order of how much they do:
 *
 * - `run` — starts a real region operation.
 * - `link` — goes to the surface that resolves it.
 * - `filter` — shows exactly the entities concerned, in the table below.
 *   Weaker than it sounds and available for almost everything: *"show me
 *   the six"* is the first thing a curator wants, and it is always
 *   truthful because the filter runs on the same measurement the finding
 *   counted.
 * - `planned` — named, visibly not built, and honest about it. A button
 *   that pretends would be worse than none; a button that says what it
 *   will do keeps the shape of the product visible.
 */
export type FindingAction =
  | { readonly kind: "run"; readonly label: string }
  | { readonly kind: "link"; readonly label: string; readonly href: string }
  | { readonly kind: "filter"; readonly label: string; readonly gap: string }
  | { readonly kind: "planned"; readonly label: string; readonly note: string };

export interface Finding {
  readonly tone: FindingTone;
  readonly title: string;
  /** Plain English: what this means, in the curator's terms. Never jargon. */
  readonly detail: string;
  /** How many entities this concerns, when it concerns entities. */
  readonly count?: number;
  /** The primary thing to do about it. */
  readonly action?: FindingAction;
  /** A second, weaker option — almost always "show me which ones". */
  readonly secondary?: FindingAction;
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

/**
 * **Today's mission — the single highest-impact thing to do next.**
 *
 * ## Why one, and why it dominates the page
 *
 * A list of eight findings is a list of eight decisions. A curator who
 * opens the workspace has already decided to do *something*; what they
 * lack is which. Picking one and defending the pick is the whole job of
 * this object.
 *
 * ## What "impact" means here, exactly
 *
 * **How many entities in this region the work would affect**, as a share
 * of the region. Not a rating, not a score, not a guess — five stars
 * means "this concerns nearly everything here", one means "this concerns
 * a few". The page prints the count next to the stars so a curator can
 * check the arithmetic and disagree with the ranking rather than with a
 * hidden verdict.
 *
 * There is deliberately no "estimated time" unless Atlas has measured
 * one. A plausible "~2 minutes" is the same class of error as a
 * fabricated identifier: a number that looks like evidence.
 */
export interface Mission {
  readonly title: string;
  /** The curator-facing statement of the problem. Names Atlas as the actor. */
  readonly headline: string;
  /** What Atlas cannot do until this is resolved. Concrete, never abstract. */
  readonly blocks: readonly string[];
  /** Entities affected. The number behind the stars. */
  readonly affected: number;
  /** Entities in the region, so the share is checkable. */
  readonly outOf: number;
  /** 1–5, derived from `affected / outOf`. Stated, never felt. */
  readonly impact: number;
  readonly action?: FindingAction;
  readonly secondary?: FindingAction;
}

export interface RegionDiagnosis {
  readonly findings: readonly Finding[];
  readonly action: RecommendedAction;
  /** `null` when nothing needs a human — which is itself worth saying. */
  readonly mission: Mission | null;
}

export function diagnoseRegion(input: {
  readonly regionName: string;
  readonly rows: readonly PickerEntity[];
  readonly scopeIds: ReadonlySet<string>;
  readonly averageCompleteness: number | null;
  /** Scores failed to load — not the same as the region having none. */
  readonly scoresUnavailable?: boolean;
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
    scoresUnavailable,
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

  if (scoresUnavailable) {
    // Say so. Before this, a failed score fetch made the coverage finding
    // vanish silently — and a missing finding reads as "nothing to report",
    // which is a claim about the region rather than about the fetch.
    findings.push({
      tone: "attention",
      title: "Knowledge coverage could not be loaded",
      detail:
        "Atlas did not return the completeness scores, so this says nothing about how complete the region actually is. Reload, or check that the Atlas API is running.",
    });
  } else if (averageCompleteness !== null) {
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
            action: { kind: "run", label: "Grow this region" },
            secondary: {
              kind: "filter",
              label: "Show the thinnest",
              gap: "thin",
            },
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
      action: { kind: "run", label: "Grow this region" },
      secondary: {
        kind: "filter",
        label: `Show the ${noSources}`,
        gap: "no-sources",
      },
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
      // Real now: opens the in-place Fix Types workflow, which writes
      // through `EnrichmentService` and records the curator's decision as
      // its own editorial source record.
      action: { kind: "link", label: "Fix them now", href: "#your-work" },
      secondary: {
        kind: "filter",
        label: `Show the ${untyped}`,
        gap: "no-type",
      },
    });
  }

  if (thin > 0) {
    findings.push({
      tone: "attention",
      count: thin,
      title: `${thin} below 50% coverage`,
      detail:
        "Atlas holds less than half of what it looks for on these. They are the highest-value things to grow.",
      action: { kind: "run", label: "Grow this region" },
      secondary: { kind: "filter", label: `Show the ${thin}`, gap: "thin" },
    });
  }

  if (isolated > 0) {
    findings.push({
      tone: "attention",
      count: isolated,
      title: `${isolated} connected to nothing`,
      detail:
        "No relationship links these to anything else in the region, so they cannot be reached by exploring — only by searching for them by name.",
      action: {
        kind: "planned",
        label: "Suggest connections",
        note: "Atlas already proposes relationships it finds while reading (`RelationshipCandidate`), and a curator confirms them. Proposing connections for entities nothing has mentioned is a different job and is not built.",
      },
      secondary: {
        kind: "filter",
        label: `Show the ${isolated}`,
        gap: "no-relationships",
      },
    });
  }

  if (noImage > 0) {
    findings.push({
      tone: "attention",
      count: noImage,
      title: `${noImage} without an image`,
      detail:
        "Atlas only uses images a source published — it never constructs an image URL — so these need a source that carries one.",
      action: { kind: "run", label: "Grow this region" },
      secondary: {
        kind: "filter",
        label: `Show the ${noImage}`,
        gap: "no-image",
      },
    });
  }

  if (waitingCount > 0) {
    findings.push({
      tone: "attention",
      count: waitingCount,
      title: `${waitingCount} research ${waitingCount === 1 ? "finding" : "findings"} waiting on you`,
      detail:
        "Atlas researched something and stopped before writing it. It proposes; a person decides.",
      action: { kind: "link", label: "Review them", href: "/admin/review" },
      secondary: {
        kind: "filter",
        label: `Show the ${waitingCount}`,
        gap: "needs-review",
      },
    });
  }

  if (runningCount > 0) {
    findings.push({
      tone: "good",
      count: runningCount,
      title: `${runningCount} research ${runningCount === 1 ? "mission" : "missions"} in progress`,
      detail:
        "Requested and not yet back. Run them with `npm run run-missions`.",
      secondary: {
        kind: "filter",
        label: `Show the ${runningCount}`,
        gap: "researching",
      },
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

  return { findings, action, mission: chooseMission(findings, rows.length) };
}

/**
 * The one finding that becomes today's mission.
 *
 * **Ordered by how much of the region it blocks, not by severity.** A
 * severity scale would be a judgement nobody agreed on; "affects six of
 * seven entities" is a fact. Ties break toward the finding that blocks
 * the most other work — type before image, because layouts, completeness
 * rules and research all key on type while an image blocks only itself.
 */
function chooseMission(
  findings: readonly Finding[],
  totalRows: number,
): Mission | null {
  const BLOCKS: Record<string, { headline: string; blocks: string[] }> = {
    "no type": {
      headline: "Atlas cannot classify these places yet.",
      blocks: [
        "Choose the right page layout for them",
        "Apply the completeness rules that fit what they are",
        "Run the research that suits their kind",
        "Group and recommend them alongside similar places",
      ],
    },
    "no source": {
      headline: "Atlas has read nothing that mentions these.",
      blocks: [
        "Show a traveller where any of it came from",
        "Notice when the facts go stale",
        "Improve them — there is nothing to re-read",
      ],
    },
    "connected to nothing": {
      headline: "Nothing links these to the rest of the region.",
      blocks: [
        "Let a traveller find them by exploring",
        "Suggest them alongside nearby places",
        "Include them in anything built from the region's shape",
      ],
    },
    "without an image": {
      headline: "These have no picture a source published.",
      blocks: [
        "Give a traveller anything to look at",
        "Use them anywhere presentation depends on an image",
      ],
    },
    "below 50%": {
      headline: "Atlas holds less than half of what it looks for here.",
      blocks: [
        "Answer most of what a traveller would ask",
        "Fill the sections a Passport page expects",
      ],
    },
    "waiting on you": {
      headline: "Atlas researched something and needs your decision.",
      blocks: [
        "Write what it found — Atlas proposes, a person decides",
        "Move on to the next question until this one is closed",
      ],
    },
  };

  const ranked = findings
    .filter((f) => f.tone === "attention" && (f.count ?? 0) > 0)
    .map((f) => {
      const key = Object.keys(BLOCKS).find((k) => f.title.includes(k));
      return key ? { finding: f, ...BLOCKS[key]! } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // A decision waiting on a human always outranks machine work: growing
    // while findings sit unreviewed adds to a queue nobody is draining.
    .sort((a, b) => {
      const aWaiting = a.finding.title.includes("waiting on you") ? 1 : 0;
      const bWaiting = b.finding.title.includes("waiting on you") ? 1 : 0;
      return (
        bWaiting - aWaiting || (b.finding.count ?? 0) - (a.finding.count ?? 0)
      );
    });

  const top = ranked[0];
  if (!top || totalRows === 0) return null;

  const affected = top.finding.count ?? 0;
  const share = affected / totalRows;
  return {
    title: top.finding.title,
    headline: top.headline,
    blocks: top.blocks,
    affected,
    outOf: totalRows,
    // Derived from the share, so it is checkable against the count
    // printed beside it. Never a feeling.
    impact: Math.max(1, Math.min(5, Math.ceil(share * 5))),
    action: top.finding.action,
    secondary: top.finding.secondary,
  };
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
