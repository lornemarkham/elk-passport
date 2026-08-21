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
 * **What actually happened to one discovered page.**
 *
 * `CandidateSourceStatus` has four values and only ever reaches two of them
 * from a queue run: `ingested` when knowledge was applied, `rejected` when a
 * curator refused it. **Every other outcome leaves the row `queued`** —
 * including the ones where Atlas fetched the page, extracted from it, and
 * could not attribute what it found. `ProcessCandidateSourceService` calls
 * `resolveCandidate` on exactly three paths (already-current, proposed,
 * enriched) and returns early on all the rest.
 *
 * So `queued` means two opposite things, and the page was reporting the wrong
 * one. On the live corpus, ten of Big White's thirteen pages had a
 * `SourceRecord` — Atlas had read every one of them — while all thirteen still
 * said *waiting to be read*.
 *
 * ## Attempted is derived from evidence, not from status
 *
 * A `SourceRecord` exists **because Atlas fetched that URL**. It is written
 * before extraction, it is durable, and it is the one fact that cannot be
 * faked by a status field nobody updated. So *attempted* is a join on the
 * canonical URL, and it needs no schema change to be true today.
 *
 * | State | Meaning | Derived from |
 * |---|---|---|
 * | `unread` | Atlas has not fetched this page | no `SourceRecord`, candidate open |
 * | `applied` | knowledge reached the entity | candidate `ingested` |
 * | `read-not-applied` | fetched and extracted; nothing could be applied | `SourceRecord` exists, candidate still open |
 * | `failed` | the fetch itself broke | a `failed` event against this candidate |
 * | `rejected` | a curator refused it | candidate `rejected` |
 *
 * **Running an operation and learning nothing is still a completed
 * operation.** `read-not-applied` is a finished attempt with an unmet outcome,
 * and calling it *waiting* told the operator to run a command that would
 * change nothing.
 */
export type SourceState =
  "unread" | "applied" | "read-not-applied" | "rejected" | "failed";

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
  /** Every page discovered for this entity, whatever became of it. */
  readonly discovered: number;
  /**
   * **What Atlas attempted.** Fetched, or tried to fetch, and recorded the
   * outcome — whether or not anything was learned. This is the number that
   * answers *did the operation run*.
   */
  readonly processed: number;
  /** Never fetched. The only pages a queue run would actually act on. */
  readonly unread: number;
  /** Knowledge reached the entity. */
  readonly applied: number;
  /** Fetched and extracted; nothing could be applied. A finished attempt, not a waiting page. */
  readonly readNotApplied: number;
  readonly rejected: number;
  readonly failed: number;
  /** Short labels for what the unread pages would teach. */
  readonly learningAreas: readonly string[];
  /** Distinct publishers, not page count. */
  readonly publishers: readonly string[];
  /**
   * **Atlas has attempted every page discovered so far.**
   *
   * Deliberately about *attempts*, not gains. The mission asks whether Atlas
   * processed the discovered pages, and running an operation that learns
   * nothing is still a completed operation — treating an unproductive read as
   * unfinished work told the operator to run a command that would change
   * nothing.
   *
   * A broken fetch is the exception, and it is not an exception to the
   * principle: it is an attempt whose outcome is *retry*, and re-running the
   * queue genuinely does act on it.
   */
  readonly complete: boolean;
  /**
   * True when Atlas read pages here and applied none of them. Not a failure of
   * the operation — a result from it, and a different kind of work.
   */
  readonly learnedNothing: boolean;
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

/**
 * The canonical form Atlas itself stores candidate URLs in — host without
 * `www.`, path without a trailing slash, query dropped. Used only to join a
 * candidate to the `SourceRecord` its fetch produced.
 */
export function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.host.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

function stateOf(
  candidate: WorkspaceCandidateSource,
  failure: string | undefined,
  fetched: boolean,
): SourceState {
  // Order matters. A curator's refusal and an applied ingestion are settled
  // facts and outrank anything derived; a broken fetch outranks the mere
  // existence of an older SourceRecord for the same URL.
  if (candidate.status === "rejected") return "rejected";
  if (candidate.status === "ingested") return "applied";
  if (failure) return "failed";
  // Still open, but Atlas holds a record of having fetched it. It was read;
  // nothing could be applied. This is the state that did not exist before,
  // and the one the whole defect turned on.
  return fetched ? "read-not-applied" : "unread";
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
  /**
   * Every `SourceRecord` Atlas holds. Their URLs are the durable proof of what
   * Atlas has actually fetched — the fact `CandidateSourceStatus` fails to
   * record when a read produces nothing applicable.
   */
  sources: readonly { readonly source: string }[] = [],
): readonly LearningOpportunity[] {
  const fetchedUrls = new Set(sources.map((s) => canonicalUrl(s.source)));
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
    const fetched = fetchedUrls.has(canonicalUrl(candidate.url));
    const source: LearningSource = {
      id: candidate.id,
      url: candidate.url,
      host: publisherOf(candidate.url),
      sourceType: candidate.sourceType,
      reason: candidate.reason,
      area: learningArea(candidate.reason),
      status: candidate.status,
      state: stateOf(candidate, failure, fetched),
      failure,
      alsoTeaches: targets.length - 1,
    };
    for (const id of targets) {
      byEntity.set(id, [...(byEntity.get(id) ?? []), source]);
    }
  }

  const opportunities: LearningOpportunity[] = [];
  for (const [entityId, entitySources] of byEntity) {
    const count = (state: SourceState) =>
      entitySources.filter((s) => s.state === state).length;
    const unread = count("unread");
    const failed = count("failed");
    const applied = count("applied");
    const readNotApplied = count("read-not-applied");
    const rejected = count("rejected");
    // Only the pages a queue run would actually act on. A page already read
    // will not be read again, so listing what it *would* have taught reads as
    // a promise the operation cannot keep.
    const actionable = entitySources.filter(
      (s) => s.state === "unread" || s.state === "failed",
    );
    opportunities.push({
      entityId,
      entityName: byId.get(entityId)?.name ?? entityId,
      sources: entitySources,
      discovered: entitySources.length,
      // Everything Atlas has an outcome for. A rejection is a curator's
      // outcome rather than Atlas's, and is counted separately below.
      processed: applied + readNotApplied + failed,
      unread,
      applied,
      readNotApplied,
      rejected,
      failed,
      learningAreas: [...new Set(actionable.map((s) => s.area))],
      publishers: [...new Set(entitySources.map((s) => s.host))].sort(),
      // Attempts, not gains. A page read and not applied is finished work with
      // an unmet outcome; a broken fetch is an attempt whose outcome is retry,
      // and re-running the queue genuinely acts on it.
      complete: actionable.length === 0,
      learnedNothing: readNotApplied > 0 && applied === 0,
    });
  }

  // Most outstanding first: the entity with the most to learn is the one worth
  // running the operation for.
  return opportunities.sort(
    (a, b) => b.unread + b.failed - (a.unread + a.failed),
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
