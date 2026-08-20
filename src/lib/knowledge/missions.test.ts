import { describe, expect, it } from "vitest";
import {
  allPlacedInRegion,
  unplacedEntities,
  type ContextEntity,
  type MissionContext,
} from "./missions";

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
    expect(result.detail).toContain("1 unplaced");
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
    expect(condition.detail).toContain(`${unplaced.length} unplaced`);
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
