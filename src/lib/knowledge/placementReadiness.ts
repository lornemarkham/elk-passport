import type { EntityLike } from "./regionHealth";

/**
 * **May Atlas reasonably ask a curator to place this entity in a Region?**
 *
 * Region membership is *asserted* by a curator, never inferred — that rule is
 * not in question here and this file does not touch it. What was missing is
 * the step before the question: Atlas was showing every unplaced entity with
 * the same `[Place in Okanagan]` button, which says *I found this, place it?*
 * for a well-identified provincial park and for a row called `Viewpoint`
 * alike. The curator had no way to tell which was which.
 *
 * So this answers a narrower question, and only this one:
 *
 * > **Do we know what this thing is, and where it is, well enough that asking
 * > for Region membership is a reasonable next decision?**
 *
 * ## It is a gate, not a score
 *
 * Three factual requirements, all of which must hold. No weights, no
 * thresholds, no percentage — *a threshold is a confidence score wearing a
 * different word* (ADR 036). Every outcome is reproducible from the entity
 * and its `describes` edges, and every failure names the specific fact that
 * is absent.
 *
 * ## What it reuses, deliberately
 *
 * Atlas already has a definition of *enough evidence to identify a thing*,
 * and a second competing one would be worse than none:
 *
 * | Borrowed from | What it contributes |
 * |---|---|
 * | `entityIdentity.assessIdentity` | the signal vocabulary — first-party URL, canonical id, coordinates, address |
 * | `entityIdentity`'s stated rule | *an identity signal must distinguish a thing from its siblings* |
 * | ADR 036, condition 1 | independence is counted in **publishers**, not records — one publisher agreeing with itself is one claim |
 * | `isAutomaticallyProcessable` | the shape of the answer: eligible plus a sentence a person can read |
 *
 * ## What it is not
 *
 * **Not Passport readiness.** That asks whether Passport can present this to
 * a traveller — picture, description, hours. An entity is routinely ready to
 * place and nowhere near ready to publish, and collapsing the two would hold
 * up a Region because a park has no photograph.
 *
 * **Not domain health.** Health asks whether Atlas is working. This asks
 * whether one specific decision is worth putting to a person.
 *
 * **Not a check that the entity is in the Region.** Deciding that is the
 * curator's entire job. A gate that pre-filtered by coordinates would be
 * inferring membership from geometry, which is the thing Atlas refuses to do.
 */

/* -------------------------------------------------------------------------
 * The three requirements
 * ---------------------------------------------------------------------- */

export type PlacementRequirement = "identified" | "located" | "attributed";

export const REQUIREMENT_LABEL: Record<PlacementRequirement, string> = {
  identified: "Identity",
  located: "Location",
  attributed: "Evidence",
};

export interface RequirementResult {
  readonly requirement: PlacementRequirement;
  readonly met: boolean;
  /** What Atlas has, when met — or what it lacks, when not. One short phrase. */
  readonly detail: string;
}

export interface PlacementReadiness {
  readonly entityId: string;
  /** All three requirements met. */
  readonly ready: boolean;
  readonly requirements: readonly RequirementResult[];
  /** The requirements that failed. Empty when ready. */
  readonly missing: readonly RequirementResult[];
  /** Distinct publishers describing this entity — the independence count, not a record count. */
  readonly publishers: readonly string[];
  /**
   * One line explaining the verdict, phrased for the curator rather than for a
   * log. Present whether ready or not: *why is this ready* deserves an answer
   * as much as *why is this not*.
   */
  readonly because: string;
  /** What kind of operation would resolve it. Absent when nothing is missing. */
  readonly nextOperation?: string;
}

/* -------------------------------------------------------------------------
 * Requirement 1 — Identified
 * ---------------------------------------------------------------------- */

/**
 * Normalizes a name for comparison only, never for storage.
 *
 * A deliberately narrow port of Atlas's `normalizeNameForComparison`: this
 * module runs in the app, which cannot import from the Atlas package, and the
 * only comparison made here is *name against its own type*. Case, punctuation
 * and spacing are the whole of it — no diacritic folding, because a type label
 * produced by OpenStreetMap has none.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,/#!$%^&*+;:{}=\-_`~()'"?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * **A name that is only the type is not a name.**
 *
 * OpenStreetMap publishes thousands of features whose `name` is the word for
 * what they are: `Viewpoint`, `Boat Launch`, `Campground`. The live corpus
 * holds two entities both called `Viewpoint`, four hundred metres apart.
 *
 * This is the same failure `entityIdentity.ts` was written for — *tags that
 * got promoted to entities* — reaching the placement decision instead of the
 * creation gate. Creation was right to accept them: they are real features and
 * their coordinates do tell them apart. Placement is a different question,
 * because a curator asked *does `Viewpoint` belong to the Okanagan?* has been
 * told what kind of thing it is and nothing whatever about which one.
 *
 * The test is structural rather than a blocklist: does the name carry anything
 * its type does not already say? `Okanagan Lake Viewpoint` does. `Viewpoint`
 * does not. Nothing is guessed about word shape and no vocabulary is
 * maintained.
 */
export function nameDistinguishes(
  name: string | undefined,
  typeLabel: string | undefined,
): boolean {
  const normalizedName = normalize(name ?? "");
  if (!normalizedName) return false;
  if (!typeLabel) return true;
  return normalizedName !== normalize(typeLabel);
}

/**
 * A page the thing publishes about itself, stored as a real identity key.
 *
 * Accepted in place of a distinguishing name because such a URL *is* a name —
 * it names the thing in the publisher's own address space and a curator can
 * open it.
 *
 * **A canonical external id is deliberately not accepted here**, and that is
 * the one place this gate is stricter than `assessIdentity`. Every
 * OpenStreetMap feature carries an OSM id by construction, so requiring one
 * would admit every row and decide nothing — the shape of failure that removed
 * `deterministic-parent` from the identity signals. An id also cannot be
 * checked by the person being asked: it identifies the record, not the place.
 * It remains a perfectly good identity signal for *creating* an entity, which
 * is the decision it was written for.
 */
function hasFirstPartyUrl(entity: EntityLike): boolean {
  return (entity.externalIds ?? []).some(
    (external) => external.system === "first-party-url",
  );
}

/* -------------------------------------------------------------------------
 * Requirement 2 — Located
 * ---------------------------------------------------------------------- */

/**
 * `0, 0` is not a location.
 *
 * Null Island is in the Gulf of Guinea, and nothing in the Okanagan is there.
 * A zero pair is what a failed geocode leaves behind, and the live corpus
 * contains one: `Kalamalka Lake Park` sits at exactly `0.0000, 0.0000`.
 *
 * This is the fabricated zero this codebase keeps rediscovering, in its
 * geographic form — a read that failed, rendered as a confident value. Placing
 * an entity whose only locating fact is a placeholder would be asserting a
 * membership on the strength of a bug.
 */
export function usablePoint(
  geometry: EntityLike["geometry"],
): readonly [number, number] | undefined {
  if (geometry?.type !== "Point" || !Array.isArray(geometry.coordinates)) {
    return undefined;
  }
  const [lon, lat] = geometry.coordinates as number[];
  if (typeof lon !== "number" || typeof lat !== "number") return undefined;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined;
  if (lon === 0 && lat === 0) return undefined;
  return [lon, lat];
}

/* -------------------------------------------------------------------------
 * The gate
 * ---------------------------------------------------------------------- */

export function assessPlacementReadiness(
  entity: EntityLike,
  publishers: ReadonlySet<string> | undefined,
): PlacementReadiness {
  const typeLabel = entity.placeType ?? entity.organizationType;
  const named = nameDistinguishes(entity.name, typeLabel);
  const firstParty = hasFirstPartyUrl(entity);
  const point = usablePoint(entity.geometry);
  const address = entity.address?.trim();
  const publisherList = [...(publishers ?? [])].sort();

  const identified: RequirementResult = {
    requirement: "identified",
    met: named || firstParty,
    detail: named
      ? `Named — "${entity.name}"`
      : firstParty
        ? "Publishes its own page"
        : typeLabel
          ? `Called "${entity.name}", which is only its type`
          : "No name Atlas can tell apart from anything else",
  };

  const located: RequirementResult = {
    requirement: "located",
    met: Boolean(point) || Boolean(address),
    detail: point
      ? `${point[1].toFixed(4)}, ${point[0].toFixed(4)}`
      : address
        ? address
        : entity.geometry?.type === "Point"
          ? "Coordinates are 0, 0 — a failed read, not a place"
          : "No coordinates and no address",
  };

  const attributed: RequirementResult = {
    requirement: "attributed",
    met: publisherList.length > 0,
    detail:
      publisherList.length > 0
        ? publisherList.join(" · ")
        : "Nothing on record describes this",
  };

  const requirements = [identified, located, attributed];
  const missing = requirements.filter((r) => !r.met);

  return {
    entityId: entity.id,
    ready: missing.length === 0,
    requirements,
    missing,
    publishers: publisherList,
    because: because(missing, identified, located, attributed),
    nextOperation: nextOperation(missing),
  };
}

function because(
  missing: readonly RequirementResult[],
  identified: RequirementResult,
  located: RequirementResult,
  attributed: RequirementResult,
): string {
  if (missing.length === 0) {
    return `${identified.detail}, located, described by ${attributed.detail}.`;
  }
  // Lead with the identity failure when there is one: it is the reason a
  // curator cannot act, and the others read as consequences of it.
  const lead = missing[0]!;
  if (lead.requirement === "identified") return lead.detail;
  if (lead.requirement === "located") return located.detail;
  return attributed.detail;
}

/**
 * What kind of operation would resolve the gap.
 *
 * Deliberately a *kind* of operation and not a command. Naming a specific CLI
 * invocation here would put an operation catalogue in a gate, and the domain
 * already declares its own publishers with their own next actions — that is
 * where a curator goes for the exact command.
 */
function nextOperation(
  missing: readonly RequirementResult[],
): string | undefined {
  if (missing.length === 0) return undefined;
  const kinds = new Set(missing.map((m) => m.requirement));
  if (kinds.has("attributed") && kinds.size === 1) {
    return "Read a source that describes it, so the claim has provenance.";
  }
  if (kinds.has("identified")) {
    return "Acquire it from a publisher that names it — a naming authority or a first-party page — before placing.";
  }
  return "Acquire a location for it from a publisher that publishes geometry.";
}

/* -------------------------------------------------------------------------
 * The population, split
 * ---------------------------------------------------------------------- */

export interface PlacementSplit {
  /** Every unplaced entity, assessed. Order preserved from the input. */
  readonly all: readonly PlacementReadiness[];
  /** Entities Atlas can justify asking about. The curator's actual work. */
  readonly ready: readonly PlacementReadiness[];
  /** Entities with an evidence problem rather than a pending decision. */
  readonly withheld: readonly PlacementReadiness[];
}

/**
 * **Not every unplaced entity is a pending placement decision.**
 *
 * Before this, `17 unplaced` counted a provincial park and a row called
 * `Viewpoint` as the same unit of work, and the mission could only finish by
 * placing both. Splitting the population is the whole point: the curator's
 * immediate work is the ready ones, and the rest have an evidence problem that
 * no amount of clicking will solve.
 *
 * The withheld are **counted and named, never dropped**. A gate that quietly
 * shrank a to-do list would be indistinguishable from a gate that worked.
 */
export function splitByPlacementReadiness(
  entities: readonly EntityLike[],
  publishersByEntity: ReadonlyMap<string, ReadonlySet<string>>,
): PlacementSplit {
  const all = entities.map((entity) =>
    assessPlacementReadiness(entity, publishersByEntity.get(entity.id)),
  );
  return {
    all,
    ready: all.filter((r) => r.ready),
    withheld: all.filter((r) => !r.ready),
  };
}
