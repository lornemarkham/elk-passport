import type { DomainHealth } from "./domainHealth";
import type { DomainWork } from "./domainWork";
import type { DomainProgress, MissionContext } from "./missions";
import { placementDecisions, withheldFromPlacement } from "./missions";

/**
 * **Everything Atlas currently knows needs a person, in one place.**
 *
 * The operator's first question is *what needs me?*, and before this the answer
 * was scattered: placement inside the mission, decisions inside Review,
 * evidence gaps behind a disclosure, enrichment under Passport, failures under
 * the last run. Five true answers, five places to look, and no way to know you
 * had seen them all.
 *
 * This groups them once. It **computes nothing new** — every count is read
 * from the module that already owns it, so the queue cannot disagree with the
 * section it points at:
 *
 * | Group | Owned by |
 * |---|---|
 * | Needs placement | `placementDecisions` — the same filter the mission condition grades |
 * | Needs evidence before placement | `withheldFromPlacement` — the rest of the unplaced set |
 * | Needs a decision | `domainWork.totals.decisions` |
 * | Needs evidence | `domainWork.totals.evidenceGaps` |
 * | Needs enrichment | `domainHealth.passport` |
 * | Failed | `domainWork.totals.failures` |
 *
 * ## Every group states its next action
 *
 * A count with no action is a complaint. Each group carries `because` (why
 * these are here), `missing` (what Atlas does not have) and `nextAction` (what
 * the operator does about it) — and an anchor to the section that renders the
 * items themselves.
 *
 * ## Populations do not overlap
 *
 * Each group counts a different kind of thing — an entity's placement, a
 * proposed merge, a queued page, a missing field, a failed read — so an item
 * is never counted twice. They are deliberately **not** summed into a single
 * "N items" headline that implies one comparable unit; the total is stated as
 * *pieces of work*, which is what it is.
 *
 * ## What "complete" means here
 *
 * Every group empty **and** every non-blocked mission complete. That is
 * *complete against current knowledge* — never a claim that Atlas knows every
 * recreation place in the Okanagan, which has no denominator and never will.
 * New evidence creates new work, and the previous completion was not wrong.
 */

export type WorkGroupKey =
  | "placement"
  | "placement-evidence"
  | "decision"
  | "evidence"
  | "enrichment"
  | "failed";

export interface WorkGroup {
  readonly key: WorkGroupKey;
  readonly label: string;
  readonly count: number;
  /**
   * The noun the count takes when it is read as a phrase — *12 ready to
   * place*. The label is a heading and does not survive being prefixed with a
   * number: *"12 needs placement"* is not English. One authored word each,
   * rather than a heuristic that strips "Needs " and hopes.
   */
  readonly unit: string;
  /** Why these items are here. */
  readonly because: string;
  /** What Atlas does not have. Empty when the gap is a decision rather than a fact. */
  readonly missing?: string;
  /** What the operator does about it. Never absent — a count with no action is a complaint. */
  readonly nextAction: string;
  /** Where on this page the items themselves are rendered. */
  readonly href: string;
  /** Named examples, so the group is about places rather than arithmetic. */
  readonly examples: readonly string[];
}

export interface DomainWorkQueue {
  readonly groups: readonly WorkGroup[];
  /** Groups with something in them, largest first. */
  readonly outstanding: readonly WorkGroup[];
  readonly totalOutstanding: number;
  /** True when nothing is outstanding and every non-blocked mission is complete. */
  readonly complete: boolean;
  /**
   * Missions that can never be started as things stand. Stated because
   * "complete" while three missions are blocked would be a different claim
   * from the one being made.
   */
  readonly blockedMissions: number;
  /** False when a read failed, so every count is a floor rather than a total. */
  readonly readsComplete: boolean;
}

export function buildWorkQueue(
  health: DomainHealth,
  work: DomainWork,
  context: MissionContext,
  progress: DomainProgress,
): DomainWorkQueue {
  const readyToPlace = context.scopeable ? placementDecisions(context) : [];
  const withheld = context.scopeable ? withheldFromPlacement(context) : [];
  const needsEnrichment = health.passport?.needsExamples ?? [];
  const enrichmentCount = health.passport?.needsEnrichment ?? 0;

  const groups: WorkGroup[] = [
    {
      key: "placement",
      label: "Needs placement",
      unit: "ready to place",
      count: readyToPlace.length,
      because: `Atlas knows what each of these is and where it is, but no curator has said they belong to ${context.regionName}.`,
      missing: "A membership assertion. Never inferred from coordinates.",
      nextAction: `Place each one in ${context.regionName} — on this page.`,
      href: "#mission",
      examples: readyToPlace.slice(0, 3).map((e) => e.name),
    },
    {
      // A separate group on purpose. These are unplaced too, but they are not
      // a decision anybody can make — folding them into the count above would
      // put work on a curator's list that no amount of clicking resolves, and
      // dropping them would hide real gaps behind a shrinking number.
      key: "placement-evidence",
      label: "Needs evidence before placement",
      unit: "need more evidence",
      count: withheld.length,
      because:
        "Atlas cannot yet justify asking whether these belong to a region — it cannot name them, locate them, or say who published them.",
      missing:
        "A distinguishing name, a usable location, or a source that describes it.",
      nextAction:
        "Acquire them from a publisher that names them, then place. Not a decision — an acquisition.",
      href: "#mission",
      examples: withheld.slice(0, 3).map((e) => e.name),
    },
    {
      key: "decision",
      label: "Needs a decision",
      unit: "decisions to answer",
      count: work.totals.decisions,
      because:
        "Atlas narrowed each to one irreversible question and stopped, because deciding cannot be undone.",
      nextAction: "Answer yes or no — on this page.",
      href: "#mission",
      examples: work.decisions.slice(0, 3).map((d) => d.question),
    },
    {
      key: "evidence",
      label: "Needs evidence",
      unit: "waiting on evidence",
      count: work.totals.evidenceGaps,
      because:
        "Atlas cannot responsibly ask a yes/no yet — a page is queued unread, or an extraction produced nothing it could attribute.",
      missing:
        "A source Atlas has not read, or one that produced nothing usable.",
      nextAction:
        "Read the queued pages, or abandon the ones you do not want — on this page.",
      href: "#mission",
      examples: work.evidenceGaps.slice(0, 3).map((g) => g.subject),
    },
    {
      key: "enrichment",
      label: "Needs enrichment",
      unit: "need enrichment",
      count: enrichmentCount,
      because:
        "Atlas holds these, but Passport cannot present them — a traveller-facing section would render empty.",
      missing: gapSummary(health.passport?.gaps ?? []),
      nextAction:
        "Research the missing field and add it. Not yet doable on this page — see the gaps below.",
      href: "#passport",
      examples: needsEnrichment.slice(0, 3).map((e) => e.name),
    },
    {
      key: "failed",
      label: "Failed",
      unit: "failed",
      count: work.totals.failures,
      because:
        "A page could not be read, or Atlas read one and declined to write. Those are opposite events and both are listed.",
      missing: "Nothing — this is a transport or identity outcome, not a gap.",
      nextAction:
        "Re-run the operation for a transport failure. A refusal is the identity gate working and needs no action.",
      href: "#mission",
      examples: work.failures.slice(0, 3).map((f) => f.subject),
    },
  ];

  const outstanding = groups
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);

  const blockedMissions = progress.missions.filter(
    (m) => m.state === "blocked",
  ).length;

  return {
    groups,
    outstanding,
    totalOutstanding: outstanding.reduce((sum, g) => sum + g.count, 0),
    // Both halves matter. An empty queue with an incomplete mission means a
    // mission whose finish rests on something the queue does not track; a
    // complete mission set with a full queue means work nobody turned into a
    // mission. Neither is "done".
    complete:
      context.scopeable &&
      context.readsComplete &&
      outstanding.length === 0 &&
      progress.completed + blockedMissions === progress.total,
    blockedMissions,
    readsComplete: context.readsComplete,
  };
}

/**
 * "12 need a picture · 9 need a description".
 *
 * Read from `PassportReadiness.gaps`, which carries the **full** per-requirement
 * count. `needsExamples` is capped for display, and summing that would report a
 * smaller gap than exists — a silent truncation wearing a total's clothes.
 */
function gapSummary(
  gaps: readonly { readonly label: string; readonly count: number }[],
): string | undefined {
  if (gaps.length === 0) return undefined;
  return gaps
    .map((gap) => `${gap.count} need ${gap.label.toLowerCase()}`)
    .join(" · ");
}

/* -------------------------------------------------------------------------
 * Which mission owns which work
 * ---------------------------------------------------------------------- */

/**
 * **Outstanding work that belongs to this mission.**
 *
 * Read from `Mission.owns`, declared in the catalogue beside `surface`, so the
 * page never matches on a mission id. A domain page used to carry a *What
 * needs you* section that competed with the mission for attention: two true
 * lists, and answering *what do I do next?* meant combining them by hand.
 * Work that belongs to a mission now sits inside it.
 */
export function groupsOwnedBy(
  queue: DomainWorkQueue,
  mission: { readonly owns?: readonly WorkGroupKey[] } | undefined,
): readonly WorkGroup[] {
  const owns = new Set(mission?.owns ?? []);
  return queue.groups.filter((group) => owns.has(group.key) && group.count > 0);
}

/**
 * **Outstanding work no mission claims.**
 *
 * Not a leftovers bin — a real category. A failed fetch belongs to a run, not
 * to a job; a page queued unread belongs to a source. Neither has a mission
 * whose finish depends on it, and inventing one to tidy the page would assert
 * a relationship Atlas cannot see. So they stay, secondary, and say why they
 * are not part of the sequence.
 */
export function unassignedGroups(
  queue: DomainWorkQueue,
  missions: readonly { readonly owns?: readonly WorkGroupKey[] }[],
): readonly WorkGroup[] {
  const claimed = new Set(missions.flatMap((m) => m.owns ?? []));
  return queue.outstanding.filter((group) => !claimed.has(group.key));
}
