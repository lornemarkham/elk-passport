import type { WorkspaceBundle } from "./workspaceData";
import { CATEGORY_RULES, type EntityLike } from "./regionHealth";
import type { AttentionGroup, AttentionReason } from "./heartbeat";
import type { MissionBriefing } from "./missionBriefing";
import type { KnowledgeDomain } from "./knowledgeDomains";
import {
  PUBLISHER_STATUS_LABEL,
  publisherNextAction,
  usablePublisherCount,
} from "./knowledgeDomains";
import {
  entityReadiness,
  passportReadiness,
  type PassportReadiness,
} from "./passportReadiness";

/**
 * **How healthy is this domain, and what would improve it?**
 *
 * Health describes measurable properties of **this domain's knowledge** —
 * never how much of the world exists, and never Atlas as a whole.
 *
 * ## Scope is the rule that matters most here
 *
 * An earlier version reported corpus-wide corroboration on every page, so
 * Recreation's health was mostly Food & Drink's evidence under a Recreation
 * heading. Every reading is now scoped through `domainScope`, which uses
 * `CATEGORY_RULES` from `regionHealth.ts` — the only domain-shaped entity
 * grouping Atlas has, shared rather than reimplemented.
 *
 * A domain with no categories (Organizations, which is cross-cutting) returns
 * `unknown` rather than borrowing someone else's numbers.
 *
 * ## What the repository actually decides
 *
 * Established by reading the code before any measure was designed:
 *
 * - **No numeric confidence threshold exists.** `Candidate.confidence` is
 *   never compared to anything; `autoApproveReviewGate` approves
 *   unconditionally. *"A threshold is a confidence score wearing a different
 *   word"* (`proposeIdentity.ts`).
 * - **The axis is reversibility.** `isAutomaticallyProcessable` tests
 *   `expectedTargets.length > 0` — whether Atlas knows who a page is about.
 * - **Identity is four signals, one required** (`assessIdentity`).
 * - **An identity proposal needs two independent publishers** and geographic
 *   agreement against a published area.
 *
 * So nothing here grades on confidence. Readings grade on corroboration and
 * coverage of the domain's own categories.
 *
 * ## Grades are rules, never weighted scores
 *
 * Each reading names the boundary that produced it, and boundaries are
 * structural (*none*, *the majority*) rather than chosen constants. There is
 * no overall domain score: any weighting across these would be invented.
 */

export type HealthGrade = "healthy" | "watch" | "weak" | "unknown";

export const GRADE_LABEL: Record<HealthGrade, string> = {
  healthy: "Healthy",
  watch: "Watch",
  weak: "Weak",
  unknown: "Unknown",
};

export interface HealthReading {
  readonly id: string;
  readonly label: string;
  readonly grade: HealthGrade;
  /** The headline, always stated as text — a meter never carries meaning alone. */
  readonly value: string;
  readonly meter?: { readonly value: number; readonly total: number };
  /** What the meter measures, when that differs from `value`. */
  readonly meterLabel?: string;
  readonly summary: string;
  /** Verbatim rule, including any stated convention. */
  readonly rule: string;
  readonly source: string;
  readonly factors: readonly string[];
}

/* -------------------------------------------------------------------------
 * Scoping
 * ---------------------------------------------------------------------- */

/** One of this domain's categories, and what Atlas holds in it. */
export interface CategoryCount {
  readonly key: string;
  readonly label: string;
  readonly held: number;
  /** Of `held`, how many a curator has placed in the region being built. */
  readonly placed: number;
  /** What a traveller could ask because of this category. */
  readonly unlocks: string;
  /**
   * **What would teach Atlas this, when it holds nothing.**
   *
   * An empty category renders as *"Not taught yet — the OSM sweep would find
   * these"* rather than as `0`. Zero is a score; the publisher that would fill
   * it is the next piece of work, and it turns the table into a roadmap.
   */
  readonly taughtBy?: string;
  /** Present when Atlas cannot identify this category at all. */
  readonly notMeasurable?: string;
}

/** An entity with the domain categories it matched, so later readings can group by them. */
export interface ScopedEntity extends EntityLike {
  readonly categories: readonly string[];
}

export interface DomainScope {
  readonly entities: readonly ScopedEntity[];
  readonly categories: readonly CategoryCount[];
  /** False when the domain declares no categories — Organizations is cross-cutting. */
  readonly scopeable: boolean;
  /**
   * **Two figures, because there are two honest answers.**
   *
   * `held` is everything Atlas knows in this domain. `placed` is the part a
   * curator has asserted into the region being built. Under a *Build the
   * Okanagan* heading, reporting only `held` would count entities that are in
   * no region at all; reporting only `placed` would hide work already done.
   * The gap between them is itself a mission.
   */
  readonly held: number;
  readonly placed: number;
  /** Kinds counted beside the categories rather than inside them — see `alsoHolds`. */
  readonly alsoHolds?: {
    readonly label: string;
    readonly count: number;
    readonly note: string;
  };
}

/**
 * This domain's entities, and what it holds per category.
 *
 * The matching rules are `regionHealth`'s, which match on the source's own
 * `placeType` / `organizationType` / description vocabulary. Its own comment
 * explains why text matching is acceptable for grouping and never for
 * identity: a wrong bucket is visible and harmless, a wrong identity is
 * silent and irreversible.
 */
export function domainScope(
  domain: KnowledgeDomain,
  bundle: WorkspaceBundle | null,
  placedIds: ReadonlySet<string> = new Set(),
): DomainScope {
  const empty = (scopeable: boolean): DomainScope => ({
    entities: [],
    categories: [],
    scopeable,
    held: 0,
    placed: 0,
  });
  if (domain.entityCategories.length === 0) return empty(false);
  if (!bundle) return empty(true);

  const all = (bundle.entities as unknown as EntityLike[]).filter(
    (e) => e.kind !== "SourceRecord",
  );
  const rules = CATEGORY_RULES.filter((r) =>
    domain.entityCategories.includes(r.key),
  );

  const categoriesById = new Map<string, string[]>();
  const seen = new Map<string, EntityLike>();

  const categories = rules.map((rule): CategoryCount => {
    if (!rule.matches) {
      return {
        key: rule.key,
        label: rule.label,
        held: 0,
        placed: 0,
        unlocks: rule.unlocks,
        taughtBy: rule.taughtBy,
        notMeasurable: rule.notMeasurable,
      };
    }
    const matched = all.filter((e) => rule.matches!(e));
    for (const e of matched) {
      seen.set(e.id, e);
      categoriesById.set(e.id, [...(categoriesById.get(e.id) ?? []), rule.key]);
    }
    return {
      key: rule.key,
      label: rule.label,
      held: matched.length,
      placed: matched.filter((e) => placedIds.has(e.id)).length,
      unlocks: rule.unlocks,
      taughtBy: rule.taughtBy,
    };
  });

  const entities: ScopedEntity[] = [...seen.values()].map((e) => ({
    ...e,
    categories: categoriesById.get(e.id) ?? [],
  }));

  // Counted beside the categories, never inside them. An Activity is a thing
  // you do at a place, not a place, and mixing the two made three quarters of
  // Recreation's figures statements about Activity records.
  const alsoHolds = domain.alsoHolds
    ? {
        label: domain.alsoHolds.label,
        count: all.filter((e) => e.kind === domain.alsoHolds!.kind).length,
        note: domain.alsoHolds.note,
      }
    : undefined;

  return {
    entities,
    categories,
    scopeable: true,
    held: entities.length,
    placed: entities.filter((e) => placedIds.has(e.id)).length,
    alsoHolds,
  };
}

/**
 * Passport readiness per category, over the domain's places.
 *
 * Needed by mission conditions like *"every park is Passport ready"*, which is
 * a question about one category rather than about the domain.
 */
export function passportByCategory(
  scope: DomainScope,
): ReadonlyMap<string, { ready: number; total: number }> {
  const out = new Map<string, { ready: number; total: number }>();
  for (const entity of scope.entities) {
    const reading = entityReadiness(entity);
    for (const key of entity.categories) {
      const current = out.get(key) ?? { ready: 0, total: 0 };
      out.set(key, {
        ready: current.ready + (reading.ready ? 1 : 0),
        total: current.total + 1,
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------
 * Evidence
 * ---------------------------------------------------------------------- */

export interface EvidenceStrength {
  readonly entitiesWithSources: number;
  readonly singleSource: number;
  readonly corroborated: number;
  readonly noFirstParty: number;
  readonly total: number;
  readonly dominantSingleSourceType?: {
    readonly type: string;
    readonly count: number;
  };
  /**
   * Distinct source types per entity id.
   *
   * Exposed because mission conditions ask about it — *"both parks carry a BC
   * Parks source"* — and recomputing the join would be a second implementation
   * of a number this function already has.
   */
  readonly sourceTypesByEntity: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Corroboration across this domain's entities, counted over `describes` edges.
 *
 * Corroboration counts **distinct source types**: two records from the same
 * publisher are one publisher agreeing with itself, which is the independence
 * test `proposeIdentity` already applies.
 */
export function evidenceStrength(
  bundle: WorkspaceBundle | null,
  scoped: readonly EntityLike[],
): EvidenceStrength | null {
  if (!bundle || scoped.length === 0) return null;

  const typeById = new Map(bundle.sources.map((s) => [s.id, s.sourceType]));
  const typesByEntity = new Map<string, Set<string>>();

  for (const r of bundle.relationships) {
    if (r.type !== "describes") continue;
    const type = typeById.get(r.sourceEntityId);
    if (!type) continue;
    const set = typesByEntity.get(r.targetEntityId) ?? new Set<string>();
    set.add(type);
    typesByEntity.set(r.targetEntityId, set);
  }

  let singleSource = 0;
  let corroborated = 0;
  let noFirstParty = 0;
  const singleSourceTypes = new Map<string, number>();

  for (const entity of scoped) {
    const types = typesByEntity.get(String(entity.id));
    if (types && types.size === 1) {
      singleSource += 1;
      const only = [...types][0]!;
      singleSourceTypes.set(only, (singleSourceTypes.get(only) ?? 0) + 1);
    }
    if (types && types.size > 1) corroborated += 1;
    if (!entity.externalIds?.some((x) => x.system === "first-party-url"))
      noFirstParty += 1;
  }

  const dominant = [...singleSourceTypes.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];

  return {
    entitiesWithSources: singleSource + corroborated,
    singleSource,
    corroborated,
    noFirstParty,
    total: scoped.length,
    dominantSingleSourceType: dominant
      ? { type: dominant[0], count: dominant[1] }
      : undefined,
    sourceTypesByEntity: typesByEntity,
  };
}

/* -------------------------------------------------------------------------
 * Review composition — used after a run, not as a domain health signal
 * ---------------------------------------------------------------------- */

export type ReviewNature = "judgement" | "evidence-weakness" | "unclassified";

export const REVIEW_NATURE_LABEL: Record<ReviewNature, string> = {
  judgement: "Genuine curator judgement",
  "evidence-weakness": "Missing evidence",
  unclassified: "Unclassified",
};

/**
 * Which review category is which, and why.
 *
 * Derived from each category's own definition in `heartbeat.ts`. **Caveat,
 * stated wherever this renders:** those categories are assigned by regular
 * expressions over free-text event messages, so a wording change upstream
 * re-buckets an item. This is a reading of a heuristic.
 *
 * Deliberately **not** a domain health reading: runs carry no domain tag, so
 * this is Atlas-wide and would leak other domains' work onto this page.
 */
export const REVIEW_NATURE: Record<
  AttentionReason,
  { nature: ReviewNature; because: string }
> = {
  Identity: {
    nature: "judgement",
    because:
      "Atlas proved two things might be the same and refused to decide. Choosing is irreversible.",
  },
  "Source conflict": {
    nature: "judgement",
    because:
      "Two sources disagree. Atlas kept what it held rather than picking a winner.",
  },
  "Relationship uncertainty": {
    nature: "judgement",
    because:
      "A connection was suggested but not established deterministically.",
  },
  "Ambiguous extraction": {
    nature: "evidence-weakness",
    because:
      "Extraction produced nothing Atlas could attribute. Better evidence removes the decision entirely.",
  },
  "Failed source": {
    nature: "evidence-weakness",
    because:
      "A page could not be read. The decision exists only because the fetch failed.",
  },
  "Unsupported field": {
    nature: "evidence-weakness",
    because:
      "The page stated something Atlas cannot store. A model change removes this.",
  },
  Other: {
    nature: "unclassified",
    because: "No rule in heartbeat.ts matched. Counted as neither.",
  },
};

export interface ReviewBacklog {
  readonly total: number;
  readonly judgement: number;
  readonly evidenceWeakness: number;
  readonly unclassified: number;
  readonly groups: readonly {
    readonly reason: AttentionReason;
    readonly count: number;
    readonly nature: ReviewNature;
    readonly because: string;
  }[];
  readonly oldestDays?: number;
}

export function reviewBacklog(
  waiting: readonly AttentionGroup[],
  now: Date,
): ReviewBacklog {
  let judgement = 0;
  let evidenceWeakness = 0;
  let unclassified = 0;
  let oldest: number | undefined;

  const groups = waiting.map((group) => {
    const { nature, because } = REVIEW_NATURE[group.reason];
    const count = group.events.length;
    if (nature === "judgement") judgement += count;
    else if (nature === "evidence-weakness") evidenceWeakness += count;
    else unclassified += count;

    for (const event of group.events) {
      const at = new Date(event.at).getTime();
      if (Number.isFinite(at)) oldest = Math.min(oldest ?? at, at);
    }
    return { reason: group.reason, count, nature, because };
  });

  return {
    total: judgement + evidenceWeakness + unclassified,
    judgement,
    evidenceWeakness,
    unclassified,
    groups: groups.filter((g) => g.count > 0),
    oldestDays:
      oldest === undefined
        ? undefined
        : Math.floor((now.getTime() - oldest) / 86_400_000),
  };
}

/* -------------------------------------------------------------------------
 * Readings — all three scoped to this domain
 * ---------------------------------------------------------------------- */

/** What this domain knows, by category. */
export function knowledgeReading(scope: DomainScope): HealthReading {
  if (!scope.scopeable) {
    return {
      id: "knowledge",
      label: "What it knows",
      grade: "unknown",
      value: "Not scopeable",
      summary:
        "This domain is cross-cutting — its entities sit in every category, so it has no category of its own to count.",
      rule: "A domain is counted through the categories it declares. This one declares none, deliberately.",
      source: "knowledgeDomains.ts entityCategories",
      factors: ["Organizations appear across every other domain's categories."],
    };
  }

  const measurable = scope.categories.filter((c) => !c.notMeasurable);
  const withSomething = measurable.filter((c) => c.held > 0).length;
  const held = scope.held;

  const grade: HealthGrade =
    measurable.length === 0
      ? "unknown"
      : withSomething === 0
        ? "weak"
        : withSomething === measurable.length
          ? "healthy"
          : "watch";

  return {
    id: "knowledge",
    label: "What it knows",
    grade,
    // Two figures, always together. `held` alone counts entities in no region
    // at all, which under a "Build the Okanagan" heading would be false;
    // `placed` alone would hide work already done.
    value: `${held} in Atlas · ${scope.placed} in the region`,
    meter: { value: withSomething, total: measurable.length },
    meterLabel: `${withSomething} of ${measurable.length} categories have something in them`,
    summary:
      withSomething === 0
        ? "Atlas holds nothing in any of this domain's categories."
        : withSomething === measurable.length
          ? "Every category this domain covers holds something."
          : `${measurable.length - withSomething} of this domain's categories are still empty.`,
    rule: "Healthy when every measurable category holds at least one entity. Weak when none do. Watch otherwise. Categories are matched on the source's own vocabulary — see CATEGORY_RULES.",
    source: "corpus entities matched by regionHealth CATEGORY_RULES",
    factors: measurable.map((c) =>
      c.held === 0
        ? `${c.label}: not taught yet${c.taughtBy ? ` — ${c.taughtBy}` : ""}`
        : `${c.label}: ${c.held} held, ${c.placed} placed`,
    ),
  };
}

/** Do this domain's entities rest on more than one publisher? */
export function evidenceReading(
  evidence: EvidenceStrength | null,
  scope: DomainScope,
): HealthReading {
  if (!scope.scopeable) {
    return {
      id: "evidence",
      label: "Evidence strength",
      grade: "unknown",
      value: "Not scopeable",
      summary: "This domain has no category of its own to measure.",
      rule: "Corroboration is counted over the domain's own entities.",
      source: "describes relationships joined to source records",
      factors: ["Cross-cutting domains borrow no one else's numbers."],
    };
  }

  if (!evidence || evidence.entitiesWithSources === 0) {
    return {
      id: "evidence",
      label: "Evidence strength",
      grade: "unknown",
      value: "Nothing to measure",
      summary:
        "Atlas holds no entity in this domain with a source attached, or is unreachable.",
      rule: "Corroborated means two or more distinct source types describe the entity.",
      source: "describes relationships joined to source records",
      factors: ["No scoped entity carries a source."],
    };
  }

  const { corroborated, singleSource, entitiesWithSources } = evidence;
  const majoritySingle = singleSource > entitiesWithSources / 2;
  const grade: HealthGrade =
    singleSource === 0 ? "healthy" : majoritySingle ? "weak" : "watch";

  return {
    id: "evidence",
    label: "Evidence strength",
    grade,
    value: `${corroborated} of ${entitiesWithSources} corroborated`,
    meter: { value: corroborated, total: entitiesWithSources },
    summary: majoritySingle
      ? "Most of this domain's entities rest on a single publisher."
      : singleSource === 0
        ? "Every entity here has more than one publisher behind it."
        : `${singleSource} entities here rest on a single publisher.`,
    rule: "Healthy when no entity rests on a single source type. Weak when the majority do. Watch otherwise. Corroboration counts distinct source types — two records from one publisher are one publisher agreeing with itself.",
    source: "this domain's entities, joined through describes relationships",
    factors: [
      `${corroborated} of ${entitiesWithSources} have two or more distinct source types.`,
      `${singleSource} rest on one.`,
      evidence.dominantSingleSourceType
        ? `Most single-source entities come from “${evidence.dominantSingleSourceType.type}” (${evidence.dominantSingleSourceType.count}).`
        : "No single source type dominates.",
      `${evidence.noFirstParty} of ${evidence.total} have no first-party URL.`,
    ],
  };
}

/** Can Atlas reach the publishers this domain depends on? */
export function publisherReading(domain: KnowledgeDomain): HealthReading {
  const usable = usablePublisherCount(domain);
  const identified = domain.publishers.length;

  const grade: HealthGrade =
    identified === 0
      ? "unknown"
      : usable === identified
        ? "healthy"
        : usable === 0
          ? "weak"
          : "watch";

  return {
    id: "publishers",
    label: "Publishers wired",
    grade,
    value: `${usable} of ${identified}`,
    meter: identified > 0 ? { value: usable, total: identified } : undefined,
    summary:
      identified === 0
        ? "No publisher identified for this domain."
        : usable === identified
          ? "Every publisher this domain has identified is wired."
          : `${identified - usable} identified publisher${identified - usable === 1 ? " is" : "s are"} not wired yet.`,
    rule: "Healthy when every identified publisher is usable. Weak when none are. Watch otherwise. Usable means status operational or ready. Per-publisher uptime is unknown — Atlas records no publisher-level outcome history.",
    source:
      "knowledgeDomains.ts, asserted per publisher and checkable by opening the loader",
    factors: domain.publishers.map(
      (p) => `${p.name} — ${p.status.replace("-", " ")}`,
    ),
  };
}

/* -------------------------------------------------------------------------
 * Opportunities
 * ---------------------------------------------------------------------- */

/**
 * What would most improve this domain, stated as work rather than as failure.
 *
 * Not a recommendation engine. It reports one measured fact — a group of this
 * domain's entities depends on a single publisher — and names publishers the
 * domain has **already identified**. Nothing is generated.
 */
/**
 * One publisher worth having, and what to do about it.
 *
 * Four fields, and the last one is the point. *Publisher / what it adds* is a
 * catalogue entry; add *why it matters* and *next action* and it becomes a
 * piece of work someone can start. Nothing here is generated — `adds` and
 * `whyItMatters` are the publisher's own `learns` and `purpose`, and
 * `nextAction` is derived from its status by one shared rule.
 */
export interface OpportunityCandidate {
  readonly name: string;
  readonly status: string;
  readonly adds: string;
  readonly whyItMatters: string;
  readonly nextAction: string;
}

export interface Opportunity {
  readonly count: number;
  readonly sourceType: string;
  readonly candidates: readonly OpportunityCandidate[];
}

export function opportunity(
  domain: KnowledgeDomain,
  evidence: EvidenceStrength | null,
): Opportunity | null {
  if (!evidence?.dominantSingleSourceType) return null;
  if (evidence.singleSource === 0) return null;

  return {
    count: evidence.dominantSingleSourceType.count,
    sourceType: evidence.dominantSingleSourceType.type,
    candidates: domain.publishers
      .filter((p) => p.status !== "operational")
      .map((p) => ({
        name: p.name,
        status: PUBLISHER_STATUS_LABEL[p.status],
        adds: p.learns,
        whyItMatters: p.purpose,
        nextAction: publisherNextAction(p),
      })),
  };
}

/* -------------------------------------------------------------------------
 * Assembly
 * ---------------------------------------------------------------------- */

export interface DomainHealth {
  readonly readings: readonly HealthReading[];
  readonly scope: DomainScope;
  readonly evidence: EvidenceStrength | null;
  readonly opportunity: Opportunity | null;
  /**
   * **Fitness for the traveller-facing product, which is not the same question
   * as health.** Atlas can hold a well-sourced entity that Passport cannot
   * show. Kept as its own reading rather than folded into a grade, because
   * combining "is Atlas working" with "is this presentable" is the weighted
   * score ADR 042 refuses.
   */
  readonly passport: PassportReadiness | null;
  /** Per category, for mission conditions that ask about one — "every park is ready". */
  readonly passportByCategory: ReadonlyMap<
    string,
    { ready: number; total: number }
  >;
  /** Atlas-wide. Rendered only after a run, never as a domain health signal. */
  readonly backlog: ReviewBacklog | null;
}

export function domainHealth(
  domain: KnowledgeDomain,
  briefing: MissionBriefing | null,
  bundle: WorkspaceBundle | null,
  now: Date,
  placedIds: ReadonlySet<string> = new Set(),
): DomainHealth {
  const scope = domainScope(domain, bundle, placedIds);
  const evidence = evidenceStrength(bundle, scope.entities);

  return {
    readings: [
      knowledgeReading(scope),
      evidenceReading(evidence, scope),
      publisherReading(domain),
    ],
    scope,
    evidence,
    opportunity: opportunity(domain, evidence),
    passport: passportReadiness(scope.entities),
    passportByCategory: passportByCategory(scope),
    backlog: briefing ? reviewBacklog(briefing.waiting, now) : null,
  };
}
