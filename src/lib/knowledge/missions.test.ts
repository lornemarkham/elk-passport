import { describe, expect, it } from "vitest";
import {
  allPlacedInRegion,
  placementDecisions,
  unplacedEntities,
  withheldFromPlacement,
  type ContextEntity,
  type MissionContext,
} from "./missions";
import type { PlacementReadiness } from "./placementReadiness";

/**
 * `allPlacedInRegion` is the condition the Region-scoping bug corrupted.
 *
 * With `placedIds` built from every Region's members, an entity placed in
 * Shuswap Highland satisfied "placed in the Okanagan" and the condition
 * reported a mission finished that was not.
 */

const entity = (id: string, name: string): ContextEntity => ({
  id,
  name,
  kind: "Place",
  categories: ["parks"],
});

/**
 * A readiness verdict, so a test about Region scoping stays about Region
 * scoping. Entities default to **ready** here: the placement gate has its own
 * test file, and letting it fail entities by accident would make these
 * assertions pass or fail for a reason they are not about.
 */
const verdict = (entityId: string, ready: boolean): PlacementReadiness => ({
  entityId,
  ready,
  requirements: [],
  missing: ready ? [] : [{ requirement: "identified", met: false, detail: "" }],
  publishers: ready ? ["openstreetmap"] : [],
  because: ready ? "Named, located, described." : "Only its type.",
  nextOperation: ready
    ? undefined
    : "Acquire it from a publisher that names it.",
});

function contextWith(
  entities: readonly ContextEntity[],
  placedIds: readonly string[],
  overrides: Partial<MissionContext> = {},
): MissionContext {
  return {
    entities,
    placedIds: new Set(placedIds),
    heldByCategory: new Map(),
    sourceTypes: new Map(),
    placementReadiness: new Map(
      entities.map((e) => [e.id, verdict(e.id, true)]),
    ),
    openDecisions: { duplicate: 0, relationship: 0 },
    queuedPages: 0,
    passportByCategory: new Map(),
    readsComplete: true,
    regionName: "Okanagan",
    scopeable: true,
    ...overrides,
  };
}

const ELLISON = entity("ellison", "Ellison Provincial Park");
const KEKULI = entity("kekuli", "Kekuli Bay Provincial Park");
/** Placed in Shuswap Highland, not in the Okanagan. */
const SHUSWAP_MEMBER = "shuswap-member";

describe("allPlacedInRegion", () => {
  it("counts an entity as placed only when this Region holds it", () => {
    const result = allPlacedInRegion().evaluate(
      contextWith([ELLISON, KEKULI], ["ellison", "kekuli"]),
    );
    expect(result.state).toBe("done");
    expect(result.detail).toContain("Okanagan");
  });

  it("does not count another Region's members", () => {
    // The regression. `placedIds` carries only the Okanagan's members, so an
    // id belonging to Shuswap Highland can never satisfy this condition — and
    // a domain entity that happens to share that id stays unplaced.
    const result = allPlacedInRegion().evaluate(
      contextWith([entity(SHUSWAP_MEMBER, "Somewhere in Shuswap")], []),
    );
    expect(result.state).toBe("not-done");
    expect(result.detail).toContain("1 ready to place");
  });

  it("names what is left rather than only counting it", () => {
    const result = allPlacedInRegion().evaluate(
      contextWith([ELLISON, KEKULI], ["ellison"]),
    );
    expect(result.state).toBe("not-done");
    expect(result.detail).toContain("Kekuli Bay Provincial Park");
    expect(result.detail).not.toContain("Ellison");
  });

  it("reports unverifiable — not 'nothing placed' — when the Region is unknown", () => {
    // An empty `placedIds` means two different things. Reporting the wrong one
    // would put every entity on the operator's list because a read failed.
    const result = allPlacedInRegion().evaluate(
      contextWith([ELLISON, KEKULI], [], { readsComplete: false }),
    );
    expect(result.state).toBe("unverifiable");
    expect(result.detail).toContain("Okanagan");
  });

  it("still reports not-done when the Region is known and genuinely empty", () => {
    const result = allPlacedInRegion().evaluate(
      contextWith([ELLISON], [], { readsComplete: true }),
    );
    expect(result.state).toBe("not-done");
  });
});

describe("unplacedEntities", () => {
  it("is the same predicate the completion condition uses", () => {
    // One implementation, read twice: the rows the page renders and the
    // condition that ends the mission must never be able to disagree.
    const ctx = contextWith([ELLISON, KEKULI], ["ellison"]);
    const unplaced = unplacedEntities(ctx);
    expect(unplaced.map((e) => e.id)).toEqual(["kekuli"]);

    const condition = allPlacedInRegion().evaluate(ctx);
    expect(condition.detail).toContain(`${unplaced.length} ready to place`);
  });

  it("empties exactly when the condition turns done", () => {
    const ctx = contextWith([ELLISON, KEKULI], ["ellison", "kekuli"]);
    expect(unplacedEntities(ctx)).toHaveLength(0);
    expect(allPlacedInRegion().evaluate(ctx).state).toBe("done");
  });

  it("still lists an entity that is a member of some other Region", () => {
    // The Region-scoping fix, asserted from the placement list's side: only
    // this Region's members count as placed.
    const ctx = contextWith([ELLISON, KEKULI], ["ellison"]);
    expect(unplacedEntities(ctx).map((e) => e.name)).toEqual([
      "Kekuli Bay Provincial Park",
    ]);
  });
});

/**
 * **The mission grades placement decisions, not unplaced rows.**
 *
 * An entity that fails the evidence gate is not an unanswered question — it is
 * a question Atlas has not earned the right to ask. Grading on the whole
 * unplaced set would leave the mission permanently at *"6 remaining"* with
 * nothing a curator could do, which is exactly the uncompletable mission this
 * architecture exists to prevent.
 */
describe("allPlacedInRegion with entities the gate withholds", () => {
  const withGate = (
    entities: readonly ContextEntity[],
    placedIds: readonly string[],
    readyIds: readonly string[],
  ) =>
    contextWith(entities, placedIds, {
      placementReadiness: new Map(
        entities.map((e) => [e.id, verdict(e.id, readyIds.includes(e.id))]),
      ),
    });

  it("completes when every entity it can justify asking about is placed", () => {
    const ctx = withGate([ELLISON, KEKULI], ["ellison"], ["ellison"]);
    const result = allPlacedInRegion().evaluate(ctx);
    expect(result.state).toBe("done");
  });

  it("says how many it withheld, so completion is never mistaken for 'all placed'", () => {
    const ctx = withGate([ELLISON, KEKULI], ["ellison"], ["ellison"]);
    expect(allPlacedInRegion().evaluate(ctx).detail).toContain("1 withheld");
  });

  it("stays not-done while a justified decision is outstanding", () => {
    const ctx = withGate([ELLISON, KEKULI], [], ["ellison"]);
    const result = allPlacedInRegion().evaluate(ctx);
    expect(result.state).toBe("not-done");
    expect(result.detail).toContain("1 ready to place");
    expect(result.detail).toContain("1 withheld");
  });

  it("treats a missing verdict as not ready, never as ready", () => {
    // A missing assessment means the gate did not run. Admitting on absence
    // would be the fabricated zero deciding a curator's assertion.
    const ctx = contextWith([ELLISON], [], {
      placementReadiness: new Map(),
    });
    expect(placementDecisions(ctx)).toHaveLength(0);
    expect(withheldFromPlacement(ctx).map((e) => e.id)).toEqual(["ellison"]);
    expect(allPlacedInRegion().evaluate(ctx).state).toBe("done");
  });

  it("still reports unverifiable when the Region could not be read", () => {
    // The gate must not overtake the guard: a failed Region read is a
    // different fact from "nothing is ready", and it is checked first.
    const ctx = contextWith([ELLISON, KEKULI], [], {
      readsComplete: false,
      placementReadiness: new Map(),
    });
    expect(allPlacedInRegion().evaluate(ctx).state).toBe("unverifiable");
  });

  it("splits the unplaced population without losing anyone", () => {
    const ctx = withGate([ELLISON, KEKULI], [], ["ellison"]);
    expect(placementDecisions(ctx).map((e) => e.id)).toEqual(["ellison"]);
    expect(withheldFromPlacement(ctx).map((e) => e.id)).toEqual(["kekuli"]);
    expect(
      placementDecisions(ctx).length + withheldFromPlacement(ctx).length,
    ).toBe(unplacedEntities(ctx).length);
  });

  it("never counts a placed entity as withheld, whatever its verdict", () => {
    // Placement already happened; re-litigating its evidence would put work
    // back on the list that a curator has already done.
    const ctx = withGate([ELLISON], ["ellison"], []);
    expect(withheldFromPlacement(ctx)).toHaveLength(0);
    expect(allPlacedInRegion().evaluate(ctx).state).toBe("done");
  });
});
