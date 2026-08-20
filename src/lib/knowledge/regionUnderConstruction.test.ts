import { describe, expect, it } from "vitest";
import type { RegionSummary } from "./regions";
import {
  REGION_UNDER_CONSTRUCTION,
  placedIdsFor,
  selectRegionUnderConstruction,
} from "./regionUnderConstruction";

/**
 * The regression these guard.
 *
 * Placement used to be counted as `regions.flatMap((r) => r.memberIds)` — the
 * union of every Region Atlas holds. Atlas holds two, so a member of Shuswap
 * Highland counted as placed in the Okanagan.
 */

const region = (name: string, memberIds: string[]): RegionSummary => ({
  id: `${name.toLowerCase()}-id`,
  name,
  description: "",
  imageUrl: null,
  memberIds,
});

const OKANAGAN = region("Okanagan", ["a", "b"]);
const SHUSWAP = region("Shuswap Highland", ["x", "y", "z"]);

describe("selectRegionUnderConstruction", () => {
  it("picks the Region being built, not the first one Atlas returns", () => {
    // Order reversed on purpose: `regions[0]` was the other half of the bug.
    expect(selectRegionUnderConstruction([SHUSWAP, OKANAGAN])?.name).toBe(
      REGION_UNDER_CONSTRUCTION,
    );
  });

  it("matches on name, ignoring case and surrounding space", () => {
    expect(
      selectRegionUnderConstruction([region("  okanagan ", [])]),
    ).toBeDefined();
  });

  it("returns undefined rather than falling back to another Region", () => {
    // A fallback would quietly start counting Shuswap Highland's members —
    // the original bug with better manners.
    expect(selectRegionUnderConstruction([SHUSWAP])).toBeUndefined();
    expect(selectRegionUnderConstruction([])).toBeUndefined();
  });

  it("does not match a Region whose name merely contains the target", () => {
    expect(
      selectRegionUnderConstruction([region("North Okanagan", [])]),
    ).toBeUndefined();
  });
});

describe("placedIdsFor", () => {
  it("returns only that Region's members", () => {
    const placed = placedIdsFor(OKANAGAN);
    expect([...placed].sort()).toEqual(["a", "b"]);
  });

  it("never includes another Region's members", () => {
    const placed = placedIdsFor(
      selectRegionUnderConstruction([SHUSWAP, OKANAGAN]),
    );
    for (const id of SHUSWAP.memberIds) expect(placed.has(id)).toBe(false);
  });

  it("is empty — not populated — when no Region could be identified", () => {
    expect(placedIdsFor(undefined).size).toBe(0);
  });
});
