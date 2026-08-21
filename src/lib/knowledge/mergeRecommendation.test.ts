import { describe, expect, test } from "vitest";
import type { AdminEntity, DuplicateGroup } from "@/lib/data/admin-repo";
import type { Relationship } from "@/lib/data/explorer-repo";
import { buildMergeRecommendation } from "./mergeRecommendation";

/**
 * Atlas proposing the merge, rather than handing a curator six identical
 * cards. What matters most here is that the *reason* is a fact, that the
 * detail view shows only differences, and that a merge never quietly
 * overwrites something.
 */

const entity = (over: Partial<AdminEntity> & { id: string }): AdminEntity => ({
  kind: "Activity",
  name: "boating",
  description: "",
  ...over,
});

const group = (entities: AdminEntity[]): DuplicateGroup => ({
  kind: "Activity",
  name: "boating",
  entities,
  confidence: "medium",
  matchReason:
    "Same name only — Activity records aren't checked against location.",
});

const describes = (sourceId: string, targetId: string): Relationship => ({
  id: `${sourceId}->${targetId}`,
  type: "describes",
  sourceEntityId: sourceId,
  targetEntityId: targetId,
});

const contains = (sourceId: string, targetId: string): Relationship => ({
  id: `c:${sourceId}->${targetId}`,
  type: "contains",
  sourceEntityId: sourceId,
  targetEntityId: targetId,
});

const build = (
  entities: AdminEntity[],
  placed: string[] = [],
  relationships: Relationship[] = [],
) => buildMergeRecommendation(group(entities), new Set(placed), relationships);

describe("choosing which record to keep", () => {
  test("prefers the record a curator already placed in the region", () => {
    // Merging into it keeps that decision. The other way discards a human
    // assertion and asks for it a second time.
    const result = build(
      [entity({ id: "a" }), entity({ id: "b" })],
      ["b"],
      // `a` is better connected, and placement still outranks it.
      [contains("x", "a"), contains("y", "a")],
    );
    expect(result!.keep.entityId).toBe("b");
    expect(result!.because[0]).toContain("already placed");
  });

  test("otherwise prefers the best-connected record, and says so", () => {
    const result = build(
      [entity({ id: "a" }), entity({ id: "b" })],
      [],
      [contains("x", "b"), contains("y", "b")],
    );
    expect(result!.keep.entityId).toBe("b");
    expect(result!.because[0]).toContain("relationships");
  });

  test("falls to sources when connectivity ties", () => {
    const result = build(
      [entity({ id: "a" }), entity({ id: "b" })],
      [],
      [describes("s1", "a"), describes("s2", "a")],
    );
    expect(result!.keep.entityId).toBe("a");
    expect(result!.because[0]).toContain("sources describe it");
  });

  test("falls to recorded facts when everything else ties", () => {
    const result = build([
      entity({ id: "a" }),
      entity({ id: "b", description: "A real description." }),
    ]);
    expect(result!.keep.entityId).toBe("b");
    expect(result!.because[0]).toContain("facts");
  });

  test("breaks a true tie stably, and admits it is a tie-break", () => {
    // Two indistinguishable records must not produce a different answer on
    // every scan — but the reason must not pretend to be a reason.
    const both = [entity({ id: "zzz" }), entity({ id: "aaa" })];
    const first = build(both);
    const second = build([...both].reverse());
    expect(first!.keep.entityId).toBe("aaa");
    expect(second!.keep.entityId).toBe("aaa");
    expect(first!.because[0]).toContain("tie-break, not a reason");
  });

  test("does not count a describing source as a relationship too", () => {
    // Otherwise one record's evidence would raise its standing twice over
    // another record holding exactly the same evidence.
    const result = build(
      [entity({ id: "a" }), entity({ id: "b" })],
      [],
      [describes("s1", "a")],
    );
    expect(result!.keep.entityId).toBe("a");
    expect(result!.keep.sources).toBe(1);
    expect(result!.keep.relationships).toBe(0);
  });
});

describe("what each candidate contributes", () => {
  test("reports a field the survivor lacks as new information", () => {
    const result = build(
      [
        entity({ id: "a", description: "Kept." }),
        entity({ id: "b", description: "Kept.", imageUrl: "https://x/i.jpg" }),
      ],
      [],
      [contains("x", "a")],
    );
    expect(result!.keep.entityId).toBe("a");
    const [candidate] = result!.merge;
    expect(candidate!.adds.map((a) => a.field)).toEqual(["imageUrl"]);
    expect(candidate!.addsNothing).toBe(false);
  });

  test("carries that field across, so it is not left on an archived row", () => {
    // `MergeService.merge` writes `{...survivor}` — without overrides, every
    // fact the absorbed record held would be lost to the survivor.
    const result = build(
      [
        entity({ id: "a", description: "Kept." }),
        entity({ id: "b", description: "Kept.", imageUrl: "https://x/i.jpg" }),
      ],
      [],
      [contains("x", "a")],
    );
    expect(result!.fieldOverrides).toEqual({ imageUrl: "https://x/i.jpg" });
  });

  test("never overwrites a value the survivor already holds", () => {
    const result = build(
      [
        entity({ id: "a", description: "Survivor's own words." }),
        entity({ id: "b", description: "A different account." }),
      ],
      [],
      [contains("x", "a")],
    );
    expect(result!.fieldOverrides).toEqual({});
    expect(result!.merge[0]!.conflicts.map((c) => c.field)).toEqual([
      "description",
    ]);
  });

  test("reports a disagreement rather than settling it", () => {
    const result = build(
      [
        entity({ id: "a", description: "Survivor's own words." }),
        entity({ id: "b", description: "A different account." }),
      ],
      [],
      [contains("x", "a")],
    );
    const conflict = result!.merge[0]!.conflicts[0]!;
    expect(conflict.keeping).toBe("Survivor's own words.");
    expect(conflict.setAside).toBe("A different account.");
    expect(result!.setAside[0]).toContain("settles nothing");
  });

  test("shows nothing for a field both records agree on", () => {
    // The whole point of the detail view: repeating what is identical is what
    // made six cards unreadable.
    const result = build(
      [
        entity({ id: "a", description: "Same." }),
        entity({ id: "b", description: "Same." }),
      ],
      [],
      [contains("x", "a")],
    );
    const candidate = result!.merge[0]!;
    expect(candidate.adds).toEqual([]);
    expect(candidate.conflicts).toEqual([]);
    expect(candidate.addsNothing).toBe(true);
  });

  test("never proposes moving an identity field", () => {
    // A record being absorbed does not get to redefine which thing this is.
    const result = build(
      [
        entity({ id: "a", name: "boating" }),
        entity({
          id: "b",
          name: "Boating",
          activityType: "paddling",
          aliases: ["paddling"],
        }),
      ],
      [],
      [contains("x", "a")],
    );
    expect(Object.keys(result!.fieldOverrides)).not.toContain("name");
    expect(Object.keys(result!.fieldOverrides)).not.toContain("activityType");
    expect(Object.keys(result!.fieldOverrides)).not.toContain("aliases");
  });

  test("keeps a differing name as an alias, and says so", () => {
    const result = build(
      [
        entity({ id: "a", name: "boating" }),
        entity({ id: "b", name: "Boating" }),
      ],
      [],
      [contains("x", "a")],
    );
    // Case alone is the same name to a reader, so no alias is claimed.
    expect(result!.merge[0]!.aliasGained).toBeUndefined();

    const renamed = build(
      [
        entity({ id: "a", name: "boating" }),
        entity({ id: "b", name: "Recreational boating" }),
      ],
      [],
      [contains("x", "a")],
    );
    expect(renamed!.merge[0]!.aliasGained).toBe("Recreational boating");
    expect(renamed!.preserved.join(" ")).toContain("alias");
  });

  test("the first candidate to fill a gap wins it, and a second does not overwrite", () => {
    const result = build(
      [
        entity({ id: "a", description: "Kept." }),
        entity({ id: "b", description: "Kept.", imageUrl: "https://first" }),
        entity({ id: "c", description: "Kept.", imageUrl: "https://second" }),
      ],
      [],
      [contains("x", "a")],
    );
    expect(result!.fieldOverrides).toEqual({ imageUrl: "https://first" });
  });
});

describe("what the curator is promised", () => {
  test("always states that absorbed records are archived rather than deleted", () => {
    const result = build([entity({ id: "a" }), entity({ id: "b" })]);
    expect(result!.preserved[0]).toContain("archived, not deleted");
  });

  test("claims nothing is set aside only when nothing is", () => {
    const clean = build([
      entity({ id: "a", description: "Same." }),
      entity({ id: "b", description: "Same." }),
    ]);
    expect(clean!.setAside).toEqual([]);

    const conflicted = build([
      entity({ id: "a", description: "One account." }),
      entity({ id: "b", description: "Another account." }),
    ]);
    expect(conflicted!.setAside).not.toEqual([]);
  });

  test("reports the match basis as what was checked, never as a score", () => {
    const result = build([entity({ id: "a" }), entity({ id: "b" })]);
    expect(result!.matchBasis).toBe("name-only");
    expect(JSON.stringify(result)).not.toMatch(/%/);
    expect(Object.keys(result!)).not.toContain("score");
  });

  test("refuses a group of one — that is not a question", () => {
    expect(
      buildMergeRecommendation(group([entity({ id: "a" })]), new Set(), []),
    ).toBe(null);
  });

  test("is deterministic — the same corpus proposes the same merge", () => {
    const twice = [
      build([entity({ id: "a" }), entity({ id: "b", description: "More." })]),
      build([entity({ id: "a" }), entity({ id: "b", description: "More." })]),
    ];
    expect(twice[0]).toEqual(twice[1]);
  });
});
