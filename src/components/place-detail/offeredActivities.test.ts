import { describe, expect, it } from "vitest";
import type { PlaceRelatedEntity, PlaceRelationship } from "@/lib/data/types";
import { offeredActivities } from "./offeredActivities";

/**
 * **An `offers` edge names something you can do here — if the other end resolves.**
 *
 * Seven of these on Kalamalka Lake, eight on Ellison Park, nine on Kalamalka
 * Lake Park, and every one used to be discarded because the detail response
 * only resolved related *Places*.
 */
const PLACE = "place-1";
const edge = (
  type: string,
  sourceEntityId: string,
  targetEntityId: string,
): PlaceRelationship => ({ id: `${type}-${targetEntityId}`, type, sourceEntityId, targetEntityId });

const entity = (
  id: string,
  kind: PlaceRelatedEntity["kind"],
  name: string,
): PlaceRelatedEntity => ({ id, kind, name });

describe("what a place offers", () => {
  it("names the Activities on the far end of its offers edges", () => {
    const result = offeredActivities(
      PLACE,
      [edge("offers", PLACE, "a1"), edge("offers", PLACE, "a2")],
      [entity("a1", "Activity", "Swimming"), entity("a2", "Activity", "Fishing")],
    );
    expect(result.map((a) => a.name)).toEqual(["Swimming", "Fishing"]);
  });

  it("ignores every other relationship type", () => {
    const result = offeredActivities(
      PLACE,
      [edge("near", PLACE, "a1"), edge("contains", PLACE, "a2")],
      [entity("a1", "Activity", "Swimming"), entity("a2", "Activity", "Fishing")],
    );
    expect(result).toEqual([]);
  });

  it("only counts edges pointing outward from this place", () => {
    // Someone else offering something is not this place offering it.
    const result = offeredActivities(
      PLACE,
      [edge("offers", "other-place", "a1")],
      [entity("a1", "Activity", "Swimming")],
    );
    expect(result).toEqual([]);
  });

  it("skips an entity Atlas did not return rather than rendering an id", () => {
    const result = offeredActivities(PLACE, [edge("offers", PLACE, "gone")], []);
    expect(result).toEqual([]);
  });

  it("does not treat a non-Activity target as an activity", () => {
    const result = offeredActivities(
      PLACE,
      [edge("offers", PLACE, "o1")],
      [entity("o1", "Organization", "A rental shop")],
    );
    expect(result).toEqual([]);
  });

  it("shows one card per activity, however many edges assert it", () => {
    const result = offeredActivities(
      PLACE,
      [edge("offers", PLACE, "a1"), { ...edge("offers", PLACE, "a1"), id: "dup" }],
      [entity("a1", "Activity", "Swimming")],
    );
    expect(result).toHaveLength(1);
  });

  it("renders nothing when an older Atlas sends no related entities", () => {
    expect(offeredActivities(PLACE, [edge("offers", PLACE, "a1")])).toEqual([]);
  });
});
