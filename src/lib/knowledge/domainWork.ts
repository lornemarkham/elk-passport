import "server-only";
import type { AdminEntity, DuplicateScanResult } from "@/lib/data/admin-repo";
import type { RelationshipCandidate } from "@/lib/data/explorer-repo";
import type { IngestionEvent } from "./runData";
import type { RunWithEvents } from "./missionControl";
import type { WorkspaceBundle } from "./workspaceData";
import type { EntityLike } from "./regionHealth";
import type { DomainScope } from "./domainHealth";

/**
 * **What happened after the run, and what still needs a person — for this
 * domain only.**
 *
 * Everything Atlas produces lands in one of four states, and an operator can
 * finish a domain only if the page shows all four and lets them act on the
 * two that need them:
 *
 * | Bucket | Meaning | What the operator does |
 * |---|---|---|
 * | **Added** | Atlas had enough evidence. It wrote. | Nothing. |
 * | **Needs a decision** | Atlas has enough to ask one irreversible question. | Answers it, here. |
 * | **Needs more evidence** | Atlas cannot responsibly ask yet. | Acquires, or abandons. |
 * | **Failed** | A machine failure. Not a judgement about the world. | Retries, or dismisses. |
 *
 * The middle two are the whole point. A page that reports *119 decisions
 * waiting* and links to another screen has described work; a page that asks
 * *"are these the same lake?"* and takes yes or no has finished it.
 *
 * ## How anything is attributed to a domain
 *
 * **Runs carry no domain tag.** That gap is real and unchanged. What runs
 * *do* carry is an `entityId` on most events, and entities can be grouped into
 * domains through `CATEGORY_RULES` — so this module attributes by **entity**,
 * never by run.
 *
 * Three attribution bases, and every item states which one it used:
 *
 * - `entity` — the record names an entity id that is in this domain's scope.
 *   Exact, and the only basis used for anything a decision is taken on.
 * - `subject-name` — a *failure* event carries no entity id (nothing was
 *   created), so its `subject` is compared, exactly and case-insensitively,
 *   against the names of this domain's entities. Used for display grouping
 *   only, exactly as `regionHealth`'s category rules are: a wrong bucket here
 *   is visible and harmless, and no decision is offered on it.
 * - unattributed — no entity id and no name match. **Counted and stated, never
 *   folded in.** A page that quietly dropped these would be claiming a
 *   completeness it does not have; a page that showed them under a Recreation
 *   heading would be lying.
 *
 * ## Nothing here is Atlas-wide
 *
 * Every list below is filtered to this domain's entities before it is
 * returned. Where a whole class of work cannot be scoped — a discovered page
 * Atlas cannot attribute to any entity — it is reported as its own count with
 * the reason, outside the domain's numbers.
 */

const ATLAS_BASE_URL = "http://localhost:3000";

/** Bounded, like every other admin read on this page. An untimed fetch is a page that never renders. */
async function adminGet<T>(path: string, timeoutMs = 4000): Promise<T | null> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return null;
  try {
    const response = await fetch(`${ATLAS_BASE_URL}${path}`, {
      headers: { "x-admin-token": token },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------
 * The four buckets
 * ---------------------------------------------------------------------- */

export type Attribution = "entity" | "subject-name";

/** Bucket 1 — Atlas wrote this on its own. */
export interface AddedItem {
  readonly entityId?: string;
  readonly name: string;
  /** "Created", "Learned 3 new things", "Recognised". Read off the event. */
  readonly what: string;
  readonly detail?: string;
}

export type DecisionKind = "duplicate" | "relationship";

/**
 * Bucket 2 — one irreversible question, answerable yes or no.
 *
 * `irreversible` is not decoration. It is why a human is being asked at all:
 * the gate in Atlas is reversibility, never confidence (`CandidateSource.ts`,
 * `isAutomaticallyProcessable`). An operator who knows *why* they are being
 * asked answers better and faster.
 */
export interface DecisionItem {
  readonly id: string;
  readonly kind: DecisionKind;
  /** Asked as a question, in the operator's words. */
  readonly question: string;
  readonly subjects: readonly { readonly id: string; readonly name: string }[];
  /** What Atlas actually observed. Never a score. */
  readonly evidence: readonly string[];
  readonly irreversible: string;
  /** What "yes" does, in one line. Shown next to the button. */
  readonly yesDoes: string;
  readonly noDoes: string;
  /** Everything the client needs to post the decision. */
  readonly action:
    | {
        readonly type: "merge";
        readonly survivingId: string;
        readonly absorbedIds: readonly string[];
      }
    | {
        readonly type: "relationship";
        readonly candidateId: string;
        readonly reason: string;
      };
}

/** Bucket 3 — Atlas cannot responsibly ask a yes/no yet. */
export interface EvidenceGapItem {
  readonly id: string;
  readonly subject: string;
  readonly entityId?: string;
  /** Exactly what is missing. Never "low confidence". */
  readonly missing: string;
  /** The acquisition step that would supply it. */
  readonly nextStep: string;
  readonly url?: string;
  /** Present when the operator can abandon it — a queued candidate source. */
  readonly abandonId?: string;
  readonly attribution: Attribution;
}

/** Bucket 4 — a machine failure. Distinct from a rejection, and from an empty result. */
export interface FailureItem {
  readonly id: string;
  readonly subject: string;
  readonly message: string;
  readonly at: string;
  readonly attribution: Attribution;
  /** True for `entity-rejected` — Atlas refused on purpose. Not the same as a broken fetch. */
  readonly refused: boolean;
}

/* -------------------------------------------------------------------------
 * Assembly
 * ---------------------------------------------------------------------- */

/**
 * **Why the buckets are empty, when they are.**
 *
 * Three different facts render as four zeros unless they are distinguished,
 * and two of them are not zero at all:
 *
 * - `scoped` — the buckets were computed. A zero here is a real zero.
 * - `no-entities` — Atlas holds nothing in this domain's categories yet, so
 *   there is nothing for a run to have touched. Not a result.
 * - `not-scopeable` — the domain declares no categories (Organizations is
 *   cross-cutting), so no work can be attributed to it at all. Not a result
 *   either, and a different reason from the one above.
 *
 * Reporting the last two as *"nothing needs you"* would be the fabricated
 * zero this codebase keeps rediscovering, one level up: an operator reading
 * four zeros concludes the domain is finished.
 */
export type WorkState = "scoped" | "no-entities" | "not-scopeable";

export interface DomainWork {
  readonly state: WorkState;
  /** The most recent run that touched one of this domain's entities. */
  readonly run: {
    readonly id: string;
    readonly label: string;
    readonly startedAt: string;
    readonly status: string;
  } | null;
  readonly added: readonly AddedItem[];
  readonly decisions: readonly DecisionItem[];
  readonly evidenceGaps: readonly EvidenceGapItem[];
  readonly failures: readonly FailureItem[];
  /**
   * Events in that run that name no entity and match no name here. Stated, so
   * the four buckets are not mistaken for the whole run.
   */
  readonly unattributedEvents: number;
  /**
   * Discovered pages Atlas cannot attribute to any entity (`expectedTargets`
   * is empty). They belong to no domain by definition — the reversibility
   * gate refuses them precisely because Atlas does not know who they are
   * about. Reported outside this domain's numbers.
   */
  readonly untargetedCandidates: number;
  /**
   * **How many there really are, before the lists were truncated for display.**
   *
   * The lists above are capped so a page stays readable. The totals are not,
   * because *"is this domain finished?"* is answered from the totals — a
   * completion check computed over a truncated list would report done while
   * twelve unread items sat behind the cap. That is the silent truncation
   * this codebase keeps rediscovering, and it is why these three exist.
   */
  readonly totals: {
    readonly decisions: number;
    /** Split by kind, because a mission's finish usually asks about one of them. */
    readonly duplicates: number;
    readonly relationships: number;
    readonly evidenceGaps: number;
    readonly queued: number;
    readonly failures: number;
  };
  /** True when a read failed, so the buckets are a floor rather than a total. */
  readonly partial: boolean;
}

const DECISIONS_SHOWN = 8;
const GAPS_SHOWN = 8;
const FAILURES_SHOWN = 8;

/**
 * The two Atlas-wide reads every domain's decisions come from.
 *
 * Hoisted so a page showing six domains issues them once rather than twelve
 * times. `null` means the read failed and is reported as `partial` — never
 * silently as zero, which would complete a mission on a number nobody read.
 */
export interface DecisionInputs {
  readonly duplicates: DuplicateScanResult | null;
  readonly relationshipCandidates: readonly RelationshipCandidate[] | null;
}

export async function loadDecisionInputs(): Promise<DecisionInputs> {
  const [duplicates, relationshipCandidates] = await Promise.all([
    adminGet<DuplicateScanResult>("/admin/duplicates"),
    adminGet<RelationshipCandidate[]>("/admin/relationship-candidates"),
  ]);
  return { duplicates, relationshipCandidates };
}

export async function loadDomainWork(
  scope: DomainScope,
  bundle: WorkspaceBundle | null,
  runs: readonly RunWithEvents[],
  inputs?: DecisionInputs,
): Promise<DomainWork> {
  const empty = (state: WorkState): DomainWork => ({
    state,
    run: null,
    added: [],
    decisions: [],
    evidenceGaps: [],
    failures: [],
    unattributedEvents: 0,
    untargetedCandidates: 0,
    totals: {
      decisions: 0,
      duplicates: 0,
      relationships: 0,
      evidenceGaps: 0,
      queued: 0,
      failures: 0,
    },
    partial: false,
  });
  if (!scope.scopeable) return empty("not-scopeable");
  if (scope.entities.length === 0) return empty("no-entities");

  const ids = new Set(scope.entities.map((e) => e.id));
  const byId = new Map(scope.entities.map((e) => [e.id, e]));
  const namesLower = new Map(
    scope.entities
      .filter((e) => e.name)
      .map((e) => [e.name!.trim().toLowerCase(), e] as const),
  );

  const { duplicates, relationshipCandidates } =
    inputs ?? (await loadDecisionInputs());

  const latest = latestRun(runs, ids);
  const events = latest?.events ?? [];

  const duplicateItems = duplicateDecisions(duplicates, ids);
  const relationshipItems = relationshipDecisions(
    relationshipCandidates,
    ids,
    bundle,
  );
  const decisions = [...duplicateItems, ...relationshipItems];
  const gaps = evidenceGapsFor(bundle, ids, byId, events, namesLower);
  const failures = failuresIn(events, ids, byId, namesLower);

  return {
    state: "scoped",
    run: latest?.summary ?? null,
    added: addedIn(events, ids, byId),
    decisions: decisions.slice(0, DECISIONS_SHOWN),
    evidenceGaps: gaps.slice(0, GAPS_SHOWN),
    failures: failures.slice(0, FAILURES_SHOWN),
    unattributedEvents: unattributed(events, ids, namesLower),
    untargetedCandidates: (bundle?.candidateSources ?? []).filter(
      (c) => targetsOf(c).length === 0 && isOpen(c.status),
    ).length,
    totals: {
      decisions: decisions.length,
      duplicates: duplicateItems.length,
      relationships: relationshipItems.length,
      evidenceGaps: gaps.length,
      queued: gaps.filter((g) => g.abandonId).length,
      failures: failures.length,
    },
    partial: duplicates === null || relationshipCandidates === null,
  };
}

/* -------------------------------------------------------------------------
 * Run selection
 * ---------------------------------------------------------------------- */

/**
 * The most recent run that touched this domain.
 *
 * This is the closest honest thing to "the last Recreation run". A run is not
 * tagged with a domain, so the definition used here is checkable instead:
 * *the most recent run that recorded an event against an entity in this
 * domain's scope*. A run that touched nothing here is not this domain's run,
 * however recently it happened.
 */
function latestRun(
  runs: readonly RunWithEvents[],
  ids: ReadonlySet<string>,
):
  | { summary: DomainWork["run"]; events: readonly IngestionEvent[] }
  | undefined {
  const touching = runs
    .filter((r) => r.events.some((e) => e.entityId && ids.has(e.entityId)))
    .sort(
      (a, b) =>
        new Date(b.run.startedAt).getTime() -
        new Date(a.run.startedAt).getTime(),
    )[0];
  if (!touching) return undefined;
  return {
    summary: {
      id: touching.run.id,
      label: touching.run.label,
      startedAt: touching.run.startedAt,
      status: touching.run.status,
    },
    events: touching.events,
  };
}

/* -------------------------------------------------------------------------
 * Bucket 1 — added
 * ---------------------------------------------------------------------- */

function addedIn(
  events: readonly IngestionEvent[],
  ids: ReadonlySet<string>,
  byId: ReadonlyMap<string, EntityLike>,
): AddedItem[] {
  const items = new Map<string, AddedItem>();
  for (const event of events) {
    if (event.outcome !== "ok") continue;
    if (!event.entityId || !ids.has(event.entityId)) continue;

    const name = byId.get(event.entityId)?.name ?? event.subject;
    if (event.stage === "entity-created") {
      items.set(event.entityId, {
        entityId: event.entityId,
        name,
        what: "Created",
        detail: event.message,
      });
    }
    if (event.stage === "entity-enriched" && !items.has(event.entityId)) {
      items.set(event.entityId, {
        entityId: event.entityId,
        name,
        what: "Learned something new",
        detail: event.message,
      });
    }
    if (event.stage === "relationship-created" && event.entityId) {
      const existing = items.get(event.entityId);
      if (!existing)
        items.set(event.entityId, {
          entityId: event.entityId,
          name,
          what: "Connected",
          detail: event.message,
        });
    }
  }
  return [...items.values()];
}

/* -------------------------------------------------------------------------
 * Bucket 2 — decisions
 * ---------------------------------------------------------------------- */

/**
 * Duplicate groups touching this domain.
 *
 * Atlas's own `DuplicateGroupFinder` produced these on a deterministic key —
 * never on names that merely look alike. Its `matchReason` is shown verbatim
 * and its two-value signal is rendered as the sentence it stands for rather
 * than as the word *confidence*, which in Atlas means a number nothing reads.
 */
function duplicateDecisions(
  result: DuplicateScanResult | null,
  ids: ReadonlySet<string>,
): DecisionItem[] {
  if (!result) return [];
  return result.groups
    .filter(
      (group) =>
        // A "group" of one is not a question. Guarding here rather than
        // trusting the producer keeps a malformed group off the page instead
        // of crashing it.
        group.entities.length >= 2 && group.entities.some((e) => ids.has(e.id)),
    )
    .map((group): DecisionItem => {
      const [surviving, ...absorbed] = group.entities;
      return {
        id: `dup:${group.kind}:${group.name}`,
        kind: "duplicate",
        question: `Are these ${group.entities.length} records the same ${group.kind.toLowerCase()}?`,
        subjects: group.entities.map((e: AdminEntity) => ({
          id: e.id,
          name: e.name,
        })),
        evidence: [
          group.matchReason,
          group.confidence === "high"
            ? "Name and real-world position both matched."
            : "Only the name matched — one record has no position to check against.",
        ],
        irreversible:
          "Merging cannot be undone in practice. Atlas proposes and never decides.",
        yesDoes: `Keeps “${surviving?.name}” and folds the other ${absorbed.length === 1 ? "record" : "records"} into it.`,
        noDoes:
          "Records them as different things, so Atlas stops proposing this group.",
        action: {
          type: "merge",
          survivingId: surviving!.id,
          absorbedIds: absorbed.map((e) => e.id),
        },
      };
    });
}

function relationshipDecisions(
  candidates: readonly RelationshipCandidate[] | null,
  ids: ReadonlySet<string>,
  bundle: WorkspaceBundle | null,
): DecisionItem[] {
  if (!candidates) return [];
  const nameOf = new Map(
    (bundle?.entities ?? []).map((e) => [e.id, e.name] as const),
  );
  return candidates
    .filter(
      (c) =>
        c.status === "pending" &&
        (ids.has(c.sourceEntityId) || ids.has(c.targetEntityId)),
    )
    .map((candidate): DecisionItem => {
      const source =
        nameOf.get(candidate.sourceEntityId) ?? candidate.sourceEntityId;
      const target =
        nameOf.get(candidate.targetEntityId) ?? candidate.targetEntityId;
      const reason = candidate.evidence.map((e) => e.label).join("; ");
      return {
        id: `rel:${candidate.id}`,
        kind: "relationship",
        question: `Does ${source} contain ${target}?`,
        subjects: [
          { id: candidate.sourceEntityId, name: source },
          { id: candidate.targetEntityId, name: target },
        ],
        evidence:
          candidate.evidence.length > 0
            ? candidate.evidence.map((e) => e.label)
            : ["Atlas recorded no evidence signal for this candidate."],
        irreversible:
          "A confirmed relationship becomes part of the graph and changes what every region page counts.",
        yesDoes: "Creates the relationship, with this evidence as its reason.",
        noDoes: "Creates nothing and stops Atlas asking again.",
        action: {
          type: "relationship",
          candidateId: candidate.id,
          reason: reason || "Confirmed by a curator from the domain page.",
        },
      };
    });
}

/* -------------------------------------------------------------------------
 * Bucket 3 — needs more evidence
 * ---------------------------------------------------------------------- */

/** `expectedTargets` is the real field. See the note on `WorkspaceCandidateSource`. */
function targetsOf(candidate: {
  expectedTargets?: readonly string[];
  aboutEntityId?: string;
}): readonly string[] {
  if (candidate.expectedTargets && candidate.expectedTargets.length > 0)
    return candidate.expectedTargets;
  return candidate.aboutEntityId ? [candidate.aboutEntityId] : [];
}

const isOpen = (status: string) =>
  status === "queued" || status === "discovered";

function evidenceGapsFor(
  bundle: WorkspaceBundle | null,
  ids: ReadonlySet<string>,
  byId: ReadonlyMap<string, EntityLike>,
  events: readonly IngestionEvent[],
  namesLower: ReadonlyMap<string, EntityLike>,
): EvidenceGapItem[] {
  const items: EvidenceGapItem[] = [];

  // A page Atlas knows it should read, about an entity in this domain.
  for (const candidate of bundle?.candidateSources ?? []) {
    if (!isOpen(candidate.status)) continue;
    const targets = targetsOf(candidate).filter((id) => ids.has(id));
    if (targets.length === 0) continue;
    const subject = targets.map((id) => byId.get(id)?.name ?? id).join(", ");
    items.push({
      id: `cand:${candidate.id}`,
      subject,
      entityId: targets[0],
      missing: candidate.reason,
      nextStep:
        "Queued for reading. `npm run run-queue` reads it; nothing happens until something does.",
      url: candidate.url,
      abandonId: candidate.id,
      attribution: "entity",
    });
  }

  // An event where Atlas stopped because the evidence would not carry the
  // decision. Distinct from a failure: nothing broke.
  for (const event of events) {
    if (event.outcome !== "needs-attention") continue;
    const entity = event.entityId ? byId.get(event.entityId) : undefined;
    const matched =
      entity ?? namesLower.get(event.subject.trim().toLowerCase());
    if (!matched) continue;
    items.push({
      id: `evt:${event.id}`,
      subject: matched.name ?? event.subject,
      entityId: matched.id,
      missing: event.message,
      nextStep:
        "Another publisher, a canonical identifier, or a geometry would remove this decision entirely.",
      attribution: entity ? "entity" : "subject-name",
    });
  }

  return items;
}

/* -------------------------------------------------------------------------
 * Bucket 4 — failures
 * ---------------------------------------------------------------------- */

function failuresIn(
  events: readonly IngestionEvent[],
  ids: ReadonlySet<string>,
  byId: ReadonlyMap<string, EntityLike>,
  namesLower: ReadonlyMap<string, EntityLike>,
): FailureItem[] {
  const items: FailureItem[] = [];
  for (const event of events) {
    const refused = event.stage === "entity-rejected";
    if (event.outcome !== "failed" && !refused) continue;

    const byEntity =
      event.entityId && ids.has(event.entityId)
        ? byId.get(event.entityId)
        : undefined;
    const byName = byEntity
      ? undefined
      : namesLower.get(event.subject.trim().toLowerCase());
    const matched = byEntity ?? byName;
    if (!matched) continue;

    items.push({
      id: event.id,
      subject: matched.name ?? event.subject,
      message: event.message,
      at: event.at,
      attribution: byEntity ? "entity" : "subject-name",
      refused,
    });
  }
  return items;
}

function unattributed(
  events: readonly IngestionEvent[],
  ids: ReadonlySet<string>,
  namesLower: ReadonlyMap<string, EntityLike>,
): number {
  return events.filter((event) => {
    if (event.stage === "run-started" || event.stage === "run-completed")
      return false;
    if (event.entityId) return !ids.has(event.entityId);
    return !namesLower.has(event.subject.trim().toLowerCase());
  }).length;
}
