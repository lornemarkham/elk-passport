import type { WorkspaceCandidateSource } from "./workspaceData";
import type { IngestionEvent } from "./runData";
import type { EntityLike } from "./regionHealth";

/**
 * **Atlas performs work on sources. Curators perform work on entities.**
 *
 * That sentence is the operating model for Knowledge Domain ingestion, not a
 * layout preference. Atlas's queue is a list of URLs because reading a page is
 * what Atlas does. A curator's job is different: they are teaching Atlas about
 * *a thing*. So the operator interface organises ingestion work around the
 * entity being learned, with its sources beneath it as evidence and inputs.
 *
 * ## What went wrong
 *
 * `evidenceGapsFor` emitted one work item per candidate source. Thirteen
 * discovered pages about Big White Ski Resort therefore rendered as thirteen
 * rows, each headed *Big White Ski Resort*, and the curator was left asking
 * whether those were thirteen decisions, why the same name appeared thirteen
 * times, and when Big White would be finished.
 *
 * Every row was true. The storage view had simply leaked into the operator
 * experience. **Atlas already knows these pages are about one entity** —
 * `expectedTargets` says so, and it is the same field the reversibility gate
 * reads — so the interface has no business making a person infer it.
 *
 * ## More to learn is not the same as needs evidence
 *
 * | | Means |
 * |---|---|
 * | **Needs evidence** | Atlas does not know enough to trust the entity or the decision. |
 * | **More to learn** | Atlas already trusts the entity, and has sources waiting that would enrich it. |
 *
 * Big White is a valid entity with identity, location and provenance. Its
 * queued pages are not proving it exists; they are teaching Atlas about it.
 * Filing that under *needs evidence* told the curator their corpus was weaker
 * than it is, and buried the one thing they could actually act on.
 *
 * ## Grouping is hierarchy, never deletion
 *
 * Every URL, publisher, status, reason and failure stays — one level down,
 * behind a disclosure, available whenever provenance is the question.
 */

/* -------------------------------------------------------------------------
 * One source, as the curator needs to see it
 * ---------------------------------------------------------------------- */

/**
 * What has happened to one queued page.
 *
 * Derived from two places on purpose, because Atlas records them in two
 * places: `CandidateSourceStatus` carries the settled outcomes (`ingested`,
 * `rejected`) while a broken fetch leaves the candidate `queued` and reports
 * itself as a **failed event**. A page that failed is still queued in the
 * database and is emphatically not waiting quietly, so it gets a state of its
 * own rather than being counted with the untouched ones.
 */
export type SourceState = "queued" | "read" | "rejected" | "failed";

export interface LearningSource {
  readonly id: string;
  readonly url: string;
  /** The publisher, as a reader would name it. */
  readonly host: string;
  readonly sourceType: string;
  /** Atlas's own recorded reason for queueing it — what it expects to learn. */
  readonly reason: string;
  /** A short label drawn from that reason, for the learning-areas list. */
  readonly area: string;
  readonly status: string;
  readonly state: SourceState;
  /** The failure message, when this page's last attempt broke. */
  readonly failure?: string;
  /** How many other entities this same page also teaches. Usually zero. */
  readonly alsoTeaches: number;
}

export interface LearningOpportunity {
  readonly entityId: string;
  readonly entityName: string;
  /** Every discovered page naming this entity, in every state. */
  readonly sources: readonly LearningSource[];
  readonly queued: number;
  readonly read: number;
  readonly rejected: number;
  readonly failed: number;
  /** Short labels for what the outstanding pages would teach. */
  readonly learningAreas: readonly string[];
  /** Distinct publishers, not page count. */
  readonly publishers: readonly string[];
  /**
   * **No actionable source remains in this pass.**
   *
   * Deliberately narrow. It does not mean Atlas knows everything about this
   * entity — it means Atlas has processed the source set discovered so far.
   * Discovery finding more pages tomorrow makes this work again, and today's
   * completion will not have been wrong.
   */
  readonly complete: boolean;
}

/* -------------------------------------------------------------------------
 * Deriving it
 * ---------------------------------------------------------------------- */

/**
 * The strongest association Atlas actually supports.
 *
 * `expectedTargets` is the field `isAutomaticallyProcessable` reads to decide
 * whether a page may be processed without a human — a candidate with none is
 * refused precisely because *Atlas does not know who this page is about*. So
 * it is the right and only basis for saying a page belongs to an entity.
 *
 * `aboutEntityId` is the removed one-page-one-entity field, kept as a fallback
 * only because some rows may predate the change. It matches nothing in current
 * data and is documented as a known defect elsewhere.
 */
export function targetsOfCandidate(candidate: {
  expectedTargets?: readonly string[];
  aboutEntityId?: string;
}): readonly string[] {
  if (candidate.expectedTargets && candidate.expectedTargets.length > 0) {
    return candidate.expectedTargets;
  }
  return candidate.aboutEntityId ? [candidate.aboutEntityId] : [];
}

/** `https://www.bigwhite.com/summer` → `bigwhite.com`. Never invented. */
export function publisherOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return url;
  }
}

/**
 * A short label for what a page would teach, taken from Atlas's own recorded
 * reason rather than from the URL.
 *
 * The reason is a sentence — *"Summer operation — the season Atlas knows least
 * about."* The clause before the dash is the subject; the rest is why it
 * matters and belongs in the detail, not in a scannable list.
 */
export function learningArea(reason: string): string {
  const head = reason.split(/\s+[—–-]\s+/)[0] ?? reason;
  const sentence = head.split(/[.:]/)[0] ?? head;
  const trimmed = sentence.trim();
  if (!trimmed) return "Unstated";
  return trimmed.length > 48 ? `${trimmed.slice(0, 47)}…` : trimmed;
}

function stateOf(
  candidate: WorkspaceCandidateSource,
  failure: string | undefined,
): SourceState {
  if (candidate.status === "ingested") return "read";
  if (candidate.status === "rejected") return "rejected";
  return failure ? "failed" : "queued";
}

/**
 * **One work item per entity, from the pages that name it.**
 *
 * Scoped to `ids` — the entities this domain may be asked about — so a page
 * teaching something outside the domain never appears here. A page naming two
 * entities appears under both, which is correct: it is one read that teaches
 * two things, and `alsoTeaches` says so rather than letting the counts imply
 * two separate pages.
 */
export function buildLearningOpportunities(
  candidates: readonly WorkspaceCandidateSource[],
  events: readonly IngestionEvent[],
  ids: ReadonlySet<string>,
  byId: ReadonlyMap<string, EntityLike>,
): readonly LearningOpportunity[] {
  // A broken fetch reports itself against the candidate it was reading, so
  // the join is by id and never by URL or name.
  const failureByCandidate = new Map<string, string>();
  for (const event of events) {
    if (event.outcome !== "failed" || !event.candidateSourceId) continue;
    failureByCandidate.set(event.candidateSourceId, event.message);
  }

  const byEntity = new Map<string, LearningSource[]>();

  for (const candidate of candidates) {
    const targets = targetsOfCandidate(candidate).filter((id) => ids.has(id));
    if (targets.length === 0) continue;
    const failure = failureByCandidate.get(candidate.id);
    const source: LearningSource = {
      id: candidate.id,
      url: candidate.url,
      host: publisherOf(candidate.url),
      sourceType: candidate.sourceType,
      reason: candidate.reason,
      area: learningArea(candidate.reason),
      status: candidate.status,
      state: stateOf(candidate, failure),
      failure,
      alsoTeaches: targets.length - 1,
    };
    for (const id of targets) {
      byEntity.set(id, [...(byEntity.get(id) ?? []), source]);
    }
  }

  const opportunities: LearningOpportunity[] = [];
  for (const [entityId, sources] of byEntity) {
    const count = (state: SourceState) =>
      sources.filter((s) => s.state === state).length;
    const outstanding = sources.filter(
      (s) => s.state === "queued" || s.state === "failed",
    );
    opportunities.push({
      entityId,
      entityName: byId.get(entityId)?.name ?? entityId,
      sources,
      queued: count("queued"),
      read: count("read"),
      rejected: count("rejected"),
      failed: count("failed"),
      learningAreas: [...new Set(outstanding.map((s) => s.area))],
      publishers: [...new Set(sources.map((s) => s.host))].sort(),
      // Read and rejected are both settled. Queued and failed are both work —
      // a failure is a retry, not a finish, and folding it into "complete"
      // would report a pass as finished on the strength of a broken fetch.
      complete: outstanding.length === 0,
    });
  }

  // Most outstanding first: the entity with the most to learn is the one worth
  // running the operation for.
  return opportunities.sort(
    (a, b) => b.queued + b.failed - (a.queued + a.failed),
  );
}

/**
 * **Pages that name no entity at all.**
 *
 * Kept, counted, and deliberately not folded into any entity's group. Atlas
 * refuses to process them for exactly one reason — it does not know who they
 * are about — and guessing a target here would be the app inventing the
 * attribution the engine correctly declined to invent.
 */
export function unattributedCandidates(
  candidates: readonly WorkspaceCandidateSource[],
): readonly WorkspaceCandidateSource[] {
  return candidates.filter(
    (candidate) =>
      targetsOfCandidate(candidate).length === 0 &&
      (candidate.status === "queued" || candidate.status === "discovered"),
  );
}
