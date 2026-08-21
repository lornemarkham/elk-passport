import "server-only";
import type { KnowledgeDomain } from "./knowledgeDomains";
import { KNOWLEDGE_DOMAINS } from "./knowledgeDomains";
import type { MissionContext, DomainProgress } from "./missions";
import { splitByPlacementReadiness } from "./placementReadiness";
import { evaluateDomain } from "./missions";
import { domainHealth, type DomainHealth } from "./domainHealth";
import {
  loadDecisionInputs,
  loadDomainWork,
  type DecisionInputs,
  type DomainWork,
} from "./domainWork";
import { loadWorkspaceBundle, type WorkspaceBundle } from "./workspaceData";
import { loadRegions, type RegionSummary } from "./regions";
import {
  REGION_UNDER_CONSTRUCTION,
  placedIdsFor,
  selectRegionUnderConstruction,
} from "./regionUnderConstruction";
import { loadMissionBriefing, type MissionBriefing } from "./missionBriefing";
import type { RunWithEvents } from "./missionControl";

/**
 * **Assembling the facts a mission is judged against.**
 *
 * `missions.ts` decides *whether* a mission is finished. This module decides
 * *what it gets to look at* — and it deliberately builds that snapshot from
 * the same loaders the page already uses, rather than issuing queries of its
 * own. A condition that could query would be a second implementation of a
 * number the page already has, and the first time the two disagreed nobody
 * would know which to believe.
 *
 * ## Why this exists as its own module
 *
 * Two pages need mission progression: the domain page (one domain, in detail)
 * and the domains index (six domains, one line each). Without a shared
 * assembler the index would either re-implement the join or issue six copies
 * of two Atlas-wide reads. `loadAtlasFacts` reads everything once; every
 * domain is then pure computation over that snapshot.
 */

/** Everything read from Atlas, once, for any number of domains. */
export interface AtlasFacts {
  readonly bundle: WorkspaceBundle | null;
  readonly briefing: MissionBriefing | null;
  /**
   * **The one Region every placement figure is counted against.**
   *
   * `undefined` when Atlas could not be reached, or holds no region by that
   * name. Callers must treat that as *unknown*, never as *nothing is placed* —
   * see `readsComplete` below.
   */
  readonly region: RegionSummary | undefined;
  /** That Region's direct members. **Never a union across regions.** */
  readonly placedIds: ReadonlySet<string>;
  readonly regionName: string;
  readonly decisions: DecisionInputs;
  readonly runs: readonly RunWithEvents[];
}

export async function loadAtlasFacts(now: Date): Promise<AtlasFacts> {
  const [briefing, bundle, regionsResult, decisions] = await Promise.all([
    loadMissionBriefing(now),
    loadWorkspaceBundle().catch(() => null),
    loadRegions().catch(() => null),
    loadDecisionInputs(),
  ]);

  // One Region, chosen deliberately. This used to be
  // `regions.flatMap(r => r.memberIds)` — the union of every region Atlas
  // holds — so a member of Shuswap Highland counted as placed in the
  // Okanagan. A Knowledge Domain's progress is progress within one Region;
  // the union was a different number wearing the same label.
  const region = selectRegionUnderConstruction(regionsResult?.regions ?? []);

  return {
    bundle,
    briefing,
    region,
    // Membership is asserted by a curator, never inferred from coordinates —
    // so this set is the only honest answer to "what is in this Region".
    placedIds: placedIdsFor(region),
    regionName: region?.name ?? REGION_UNDER_CONSTRUCTION,
    decisions,
    runs: briefing?.runs ?? [],
  };
}

export interface DomainState {
  readonly domain: KnowledgeDomain;
  readonly health: DomainHealth;
  readonly work: DomainWork;
  readonly context: MissionContext;
  readonly progress: DomainProgress;
}

/**
 * One domain's health, work and mission progression, from a shared snapshot.
 *
 * `readsComplete` is the field that matters most here. When a read failed,
 * every counter derived from it is zero, and a condition asking *"is anything
 * waiting?"* would answer *no* and complete a mission on a number nobody read.
 * Passing the failure through means those conditions report `unverifiable`
 * instead.
 */
export async function loadDomainState(
  domain: KnowledgeDomain,
  facts: AtlasFacts,
  now: Date,
): Promise<DomainState> {
  const health = domainHealth(
    domain,
    facts.briefing,
    facts.bundle,
    now,
    facts.placedIds,
  );
  const work = await loadDomainWork(
    health.scope,
    facts.bundle,
    facts.runs,
    facts.decisions,
  );

  const context: MissionContext = {
    entities: health.scope.entities.map((e) => ({
      id: e.id,
      name: e.name ?? "Unnamed",
      kind: e.kind,
      categories: e.categories,
    })),
    placedIds: facts.placedIds,
    heldByCategory: new Map(
      health.scope.categories.map((c) => [c.key, c.held]),
    ),
    sourceTypes: health.evidence?.sourceTypesByEntity ?? new Map(),
    // Run once, here, where the full entity records and the per-entity
    // publisher sets both already exist. A mission condition and the rows on
    // screen then read one answer instead of deriving two.
    placementReadiness: new Map(
      splitByPlacementReadiness(
        health.scope.entities,
        health.evidence?.sourceTypesByEntity ?? new Map(),
      ).all.map((readiness) => [readiness.entityId, readiness]),
    ),
    openDecisions: {
      duplicate: work.totals.duplicates,
      relationship: work.totals.relationships,
    },
    queuedPages: work.totals.queued,
    passportByCategory: health.passportByCategory,
    // The Region matters here as much as the bundle does. Without it
    // `placedIds` is empty, and a condition asking "is everything placed?"
    // would answer "no, all 23 are unplaced" when the truth is "Atlas could
    // not tell us which Region we are building". Different facts.
    readsComplete:
      facts.bundle !== null && facts.region !== undefined && !work.partial,
    regionName: facts.regionName,
    scopeable: health.scope.scopeable,
  };

  return {
    domain,
    health,
    work,
    context,
    progress: evaluateDomain(domain.slug, context),
  };
}

/** Every domain's progression, from one pass over Atlas. Used by the index. */
export async function loadAllDomainProgress(
  now: Date,
): Promise<readonly DomainState[]> {
  const facts = await loadAtlasFacts(now);
  return Promise.all(
    KNOWLEDGE_DOMAINS.map((domain) => loadDomainState(domain, facts, now)),
  );
}
