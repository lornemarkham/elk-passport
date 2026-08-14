import type { IngestionEvent, IngestionRun } from "./runData";

/**
 * Derives everything the Heartbeat renders — from persisted events only.
 *
 * ## The one rule
 *
 * Nothing here invents a number, a stage, or a step. Every count is a
 * filter over events Atlas actually wrote, and a stage that never happened
 * simply does not appear. A progress bar that advances because time passed
 * would be the exact opposite of what this screen is for: the Observatory
 * is how a curator decides whether to *trust* what Atlas did, so a single
 * simulated element would poison the whole surface.
 *
 * That constraint is also why this file is pure and separate from the
 * components. The interesting logic — what counts as attention, what the
 * run's story is, which entities a run touched — is testable without
 * rendering anything.
 */

export interface StageCount {
  readonly stage: string;
  readonly total: number;
  readonly ok: number;
  readonly skipped: number;
  readonly needsAttention: number;
  readonly failed: number;
}

export interface RunVitals {
  readonly sourcesDiscovered: number;
  readonly sourcesVerified: number;
  readonly verificationsRefused: number;
  readonly pagesFetched: number;
  readonly pagesReused: number;
  readonly entitiesCreated: number;
  readonly entitiesRecognised: number;
  readonly entitiesEnriched: number;
  readonly relationshipsCreated: number;
  readonly candidatesQueued: number;
  readonly candidatesResolved: number;
  readonly factsLearned: number;
  /**
   * Everything an entity gained, not only `keyFacts`.
   *
   * Counting facts alone under-reports, and the live BullWheel run proved
   * it: that run taught Atlas an address and opening hours — typed scalar
   * fields, not key facts — so a facts-only headline read "0 learned" on a
   * run that had just learned two real things. "Learned nothing" and
   * "learned two things that happen to be typed fields" must never render
   * the same way; that is the same class of error as an unexplained zero.
   */
  readonly thingsLearned: number;
  readonly needsAttention: number;
  readonly failed: number;
  readonly recovered: number;
}

/**
 * Counts the vitals. `factsLearned` is parsed out of the enrichment
 * messages Atlas itself wrote ("3 fact(s): …") rather than recomputed from
 * the entities — the run log is the record of what *this run* changed, and
 * reading the entity instead would report its whole history.
 */
export function computeVitals(events: readonly IngestionEvent[]): RunVitals {
  const at = (stage: string, outcome?: IngestionEvent["outcome"]) =>
    events.filter(
      (e) => e.stage === stage && (outcome ? e.outcome === outcome : true),
    );

  const enriched = at("entity-enriched", "ok");
  const factsLearned = enriched.reduce((total, e) => {
    const match = e.message.match(/(\d+)\s+fact\(s\)/);
    return total + (match ? Number(match[1]) : 0);
  }, 0);
  const thingsLearned = enriched.reduce(
    (total, e) => total + countAdditions(e.message),
    0,
  );

  return {
    sourcesDiscovered: at("source-discovered").length,
    sourcesVerified: at("source-verified", "ok").length,
    verificationsRefused: at("source-verified", "needs-attention").length,
    pagesFetched: at("source-fetched", "ok").length,
    pagesReused: at("source-fetched", "skipped").length,
    entitiesCreated: at("entity-created", "ok").length,
    entitiesRecognised: at("entity-matched", "ok").length,
    entitiesEnriched: enriched.length,
    relationshipsCreated: at("relationship-created", "ok").length,
    candidatesQueued: at("candidate-queued").length,
    candidatesResolved: at("candidate-resolved", "ok").length,
    factsLearned,
    thingsLearned,
    needsAttention: events.filter((e) => e.outcome === "needs-attention")
      .length,
    failed: events.filter((e) => e.outcome === "failed").length,
    // A run that hit failures and still finished kept going — worth
    // showing, because "one page was unreachable" and "the run died" are
    // completely different events and used to look identical.
    recovered: events.some(
      (e) => e.stage === "run-completed" && e.outcome === "ok",
    )
      ? events.filter((e) => e.outcome === "failed").length
      : 0,
  };
}

export function computeStages(
  events: readonly IngestionEvent[],
  order: readonly string[],
): StageCount[] {
  const byStage = new Map<string, StageCount>();
  for (const event of events) {
    if (event.stage === "run-started" || event.stage === "run-completed")
      continue;
    const current = byStage.get(event.stage) ?? {
      stage: event.stage,
      total: 0,
      ok: 0,
      skipped: 0,
      needsAttention: 0,
      failed: 0,
    };
    byStage.set(event.stage, {
      ...current,
      total: current.total + 1,
      ok: current.ok + (event.outcome === "ok" ? 1 : 0),
      skipped: current.skipped + (event.outcome === "skipped" ? 1 : 0),
      needsAttention:
        current.needsAttention + (event.outcome === "needs-attention" ? 1 : 0),
      failed: current.failed + (event.outcome === "failed" ? 1 : 0),
    });
  }
  return [...byStage.values()].sort((a, b) => {
    const ai = order.indexOf(a.stage);
    const bi = order.indexOf(b.stage);
    return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
  });
}

/** A line of the run's story. Omitted entirely when its count is zero — a story does not narrate what did not happen. */
export interface StoryLine {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly tone: "neutral" | "growth" | "attention";
}

export function buildStory(
  vitals: RunVitals,
  events: readonly IngestionEvent[],
): StoryLine[] {
  const lines: StoryLine[] = [];
  const push = (
    label: string,
    count: number,
    value: string,
    tone: StoryLine["tone"] = "neutral",
    detail?: string,
  ) => {
    if (count > 0) lines.push({ label, value, tone, detail });
  };

  const started = events.find((e) => e.stage === "run-started");
  if (started)
    lines.push({
      label: "Started with",
      value: started.subject,
      tone: "neutral",
    });

  push(
    "Atlas discovered",
    vitals.sourcesDiscovered,
    `${vitals.sourcesDiscovered} source${plural(vitals.sourcesDiscovered)}`,
  );
  push(
    "Atlas verified",
    vitals.sourcesVerified,
    `${vitals.sourcesVerified} constructed source${plural(vitals.sourcesVerified)}`,
    "neutral",
    "Checked against the page itself — never accepted on a name match.",
  );
  push(
    "Atlas refused",
    vitals.verificationsRefused,
    `${vitals.verificationsRefused} unverified guess${vitals.verificationsRefused === 1 ? "" : "es"}`,
    "attention",
    "Nothing on the page proved it was about the right entity, so nothing was extracted.",
  );
  push(
    "Atlas read",
    vitals.pagesFetched,
    `${vitals.pagesFetched} page${plural(vitals.pagesFetched)}`,
  );
  push(
    "Atlas reused",
    vitals.pagesReused,
    `${vitals.pagesReused} source${plural(vitals.pagesReused)} it already held`,
    "neutral",
    "Byte-identical to evidence already stored — no duplicate created.",
  );
  push(
    "Atlas recognised",
    vitals.entitiesRecognised,
    `${vitals.entitiesRecognised} existing entit${vitals.entitiesRecognised === 1 ? "y" : "ies"}`,
  );
  push(
    "Atlas created",
    vitals.entitiesCreated,
    `${vitals.entitiesCreated} new entit${vitals.entitiesCreated === 1 ? "y" : "ies"}`,
    "growth",
  );
  push(
    "Atlas learned",
    vitals.thingsLearned,
    `${vitals.thingsLearned} new thing${plural(vitals.thingsLearned)}`,
    "growth",
    vitals.factsLearned > 0
      ? `Including ${vitals.factsLearned} key fact${plural(vitals.factsLearned)}.`
      : undefined,
  );
  push(
    "Atlas enriched",
    vitals.entitiesEnriched,
    `${vitals.entitiesEnriched} entit${vitals.entitiesEnriched === 1 ? "y" : "ies"}`,
    "growth",
  );
  push(
    "Atlas connected",
    vitals.relationshipsCreated,
    `${vitals.relationshipsCreated} relationship${plural(vitals.relationshipsCreated)}`,
    "growth",
  );
  push(
    "Atlas queued next",
    vitals.candidatesQueued,
    `${vitals.candidatesQueued} learning opportunit${vitals.candidatesQueued === 1 ? "y" : "ies"}`,
    "neutral",
    "Discovered during this run — deliberately left for the next one.",
  );
  push(
    "Wants a human",
    vitals.needsAttention,
    `${vitals.needsAttention}`,
    "attention",
  );
  push(
    "Failed",
    vitals.failed,
    `${vitals.failed} source${plural(vitals.failed)}`,
    "attention",
    vitals.recovered > 0 ? "The run continued past them." : undefined,
  );

  return lines;
}

/**
 * True when a run completed cleanly and changed nothing.
 *
 * Kept as its own concept because "did nothing because it is already
 * current" and "did nothing because it is broken" are opposite outcomes
 * that used to render identically as a column of zeros — and were in fact
 * mistaken for one another.
 */
export function isAlreadyCurrent(
  run: IngestionRun | undefined,
  vitals: RunVitals,
): boolean {
  return (
    run?.status === "completed" &&
    vitals.failed === 0 &&
    vitals.needsAttention === 0 &&
    vitals.entitiesCreated === 0 &&
    vitals.entitiesEnriched === 0 &&
    vitals.relationshipsCreated === 0 &&
    vitals.candidatesQueued === 0
  );
}

export type AttentionReason =
  | "Identity"
  | "Source conflict"
  | "Unsupported field"
  | "Ambiguous extraction"
  | "Relationship uncertainty"
  | "Failed source"
  | "Other";

export interface AttentionGroup {
  readonly reason: AttentionReason;
  readonly why: string;
  readonly events: readonly IngestionEvent[];
}

/**
 * Groups what wants a human **by why**, not by stage.
 *
 * A flat list of warnings makes a curator re-derive the same
 * classification every time they look. The groups below are the real
 * categories Atlas produces today; `Other` exists so a message no rule
 * recognises is still shown rather than silently dropped — the same
 * discipline the stage ordering follows.
 */
export function groupAttention(
  events: readonly IngestionEvent[],
): AttentionGroup[] {
  const flagged = events.filter(
    (e) => e.outcome === "needs-attention" || e.outcome === "failed",
  );

  const classify = (event: IngestionEvent): AttentionReason => {
    const m = event.message.toLowerCase();
    if (
      event.outcome === "failed" ||
      /could not read|unreachable|http \d/.test(m)
    )
      return "Failed source";
    if (
      event.stage === "source-verified" ||
      /deterministically identifies/.test(m)
    )
      return "Identity";
    if (/resembles|shares no deterministic key|identity gate/.test(m))
      return "Identity";
    if (/disagrees|atlas holds .* this page says/.test(m))
      return "Source conflict";
    if (/no such field|nowhere to store/.test(m)) return "Unsupported field";
    if (/no extractable proposals|cannot prove which|proposal/.test(m))
      return "Ambiguous extraction";
    if (/relationship|contains|describes/.test(m))
      return "Relationship uncertainty";
    return "Other";
  };

  const why: Record<AttentionReason, string> = {
    Identity:
      "Atlas could not prove two things are the same, so it changed nothing. Deciding this is a human judgement.",
    "Source conflict":
      "Two sources disagree. Atlas kept what it already held and is telling you rather than picking a winner.",
    "Unsupported field":
      "The page stated something Atlas has nowhere to store. The evidence is kept; nothing reached the entity.",
    "Ambiguous extraction":
      "Extraction produced nothing Atlas could safely attribute to the target entity.",
    "Relationship uncertainty":
      "A connection was suggested but not established deterministically.",
    "Failed source":
      "A page could not be read. The run continued; the candidate stays queued.",
    Other:
      "Recorded for review and not matched by any known category — shown rather than hidden.",
  };

  const order: AttentionReason[] = [
    "Identity",
    "Source conflict",
    "Ambiguous extraction",
    "Unsupported field",
    "Relationship uncertainty",
    "Failed source",
    "Other",
  ];

  const groups = new Map<AttentionReason, IngestionEvent[]>();
  for (const event of flagged) {
    const reason = classify(event);
    groups.set(reason, [...(groups.get(reason) ?? []), event]);
  }

  return order
    .filter((reason) => groups.has(reason))
    .map((reason) => ({
      reason,
      why: why[reason],
      events: groups.get(reason)!,
    }));
}

export interface BranchNode {
  readonly entityId?: string;
  readonly name: string;
  readonly hasFirstPartySource: boolean;
  readonly factsLearned: number;
  readonly outcome: "created" | "enriched" | "recognised" | "refused";
  readonly detail?: string;
}

/**
 * The branch of knowledge this run grew — the entities it touched, each
 * with what actually changed.
 *
 * Built from events rather than by querying the graph, because the graph
 * shows what is true *now* and this must show what *this run* did. Two
 * levels deep by design: a run has one subject and the things beneath it.
 */
export function buildBranch(events: readonly IngestionEvent[]): {
  root: string;
  nodes: BranchNode[];
} {
  const root =
    events.find((e) => e.stage === "run-started")?.subject ?? "This run";
  const byName = new Map<string, BranchNode>();

  const upsert = (
    name: string,
    patch: Partial<BranchNode> & { outcome?: BranchNode["outcome"] },
  ) => {
    const current = byName.get(name) ?? {
      name,
      hasFirstPartySource: false,
      factsLearned: 0,
      outcome: "recognised" as const,
    };
    byName.set(name, { ...current, ...patch, name });
  };

  for (const event of events) {
    if (event.stage === "entity-created" && event.outcome === "ok") {
      upsert(event.subject, { entityId: event.entityId, outcome: "created" });
    }
    if (event.stage === "entity-matched" && event.outcome === "ok") {
      upsert(event.subject, {
        entityId: event.entityId,
        outcome: "recognised",
      });
    }
    if (event.stage === "entity-rejected") {
      upsert(event.subject, { outcome: "refused", detail: event.message });
    }
    if (event.stage === "entity-enriched" && event.outcome === "ok") {
      const facts = Number(event.message.match(/(\d+)\s+fact\(s\)/)?.[1] ?? 0);
      const existing = byName.get(event.subject);
      upsert(event.subject, {
        entityId: event.entityId,
        outcome: "enriched",
        factsLearned: (existing?.factsLearned ?? 0) + facts,
        detail: event.message,
      });
    }
    if (event.stage === "source-fetched" && event.entityId) {
      const owner = events.find(
        (e) => e.entityId === event.entityId && e.stage === "entity-enriched",
      );
      if (owner) upsert(owner.subject, { hasFirstPartySource: true });
    }
  }

  return { root, nodes: [...byName.values()] };
}

/** Wall-clock duration, or undefined while a run is still going. Never estimated. */
export function runDuration(run: IngestionRun | undefined): string | undefined {
  if (!run?.finishedAt) return undefined;
  const ms =
    new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Human title for a run. The npm command is execution detail, not a headline. */
export function runTitle(run: IngestionRun): string {
  // Product language, not implementation language: a curator thinks in
  // missions and discoveries, not runs and candidates. The technical names
  // still exist on IngestionRun.kind — they are just not what a person
  // reads first.
  const kind: Record<string, string> = {
    "directory-expansion": "Discovery mission",
    "candidate-processing": "Learning mission",
    "queue-run": "Learning mission",
    "batch-ingest": "Bulk learning mission",
    probe: "Source check",
  };
  return kind[run.kind] ?? run.kind;
}

/**
 * How many distinct things one enrichment event reported learning.
 *
 * Parses the message Atlas itself wrote — `"Learned from its own page: A ·
 * B"` — because the run log is the only record of what *this run* changed.
 * Reading the entity instead would report its entire history, which is a
 * different question and would inflate every re-run.
 *
 * Falls back to 1 for an enrichment whose message doesn't carry the
 * separator: something was learned, and reporting zero would be worse than
 * reporting an imprecise one.
 */
export function countAdditions(message: string): number {
  const body = message.replace(/^[^:]*:\s*/, "");
  if (body.length === 0) return 0;
  return body.split(" · ").filter((part) => part.trim().length > 0).length || 1;
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}
