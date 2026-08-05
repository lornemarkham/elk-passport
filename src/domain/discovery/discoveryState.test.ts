import { describe, expect, it } from "vitest";
import {
  createInitialDiscoveryState,
  discoveryReducer,
  type DiscoveryState,
} from "./discoveryState";

function initial(): DiscoveryState {
  return createInitialDiscoveryState("test-session");
}

describe("discoveryReducer — filters", () => {
  it("sets a single filter field", () => {
    const next = discoveryReducer(initial(), {
      type: "FILTER_SET",
      key: "moods",
      value: ["cozy"],
    });
    expect(next.filters.moods).toEqual(["cozy"]);
  });

  it("clears filters back to empty", () => {
    const withFilter = discoveryReducer(initial(), {
      type: "FILTER_SET",
      key: "moods",
      value: ["cozy"],
    });
    const cleared = discoveryReducer(withFilter, { type: "FILTER_CLEAR" });
    expect(cleared.filters.moods).toEqual([]);
  });

  it("sets the free-text query", () => {
    const next = discoveryReducer(initial(), {
      type: "QUERY_SET",
      value: "campfire",
    });
    expect(next.query).toBe("campfire");
  });
});

describe("discoveryReducer — save/reject/shelf/restore", () => {
  it("saves an experience", () => {
    const next = discoveryReducer(initial(), {
      type: "EXPERIENCE_SAVE",
      experienceId: "campfire",
    });
    expect(next.savedExperienceIds).toEqual(["campfire"]);
  });

  it("save is idempotent", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SAVE",
      experienceId: "campfire",
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SAVE",
      experienceId: "campfire",
    });
    expect(state.savedExperienceIds).toEqual(["campfire"]);
  });

  it("rejecting a saved experience un-saves it", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SAVE",
      experienceId: "campfire",
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_REJECT",
      experienceId: "campfire",
    });
    expect(state.savedExperienceIds).toEqual([]);
    expect(state.rejectedExperienceIds).toEqual(["campfire"]);
  });

  it("shelving removes an experience from saved and rejected", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_REJECT",
      experienceId: "campfire",
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SHELF",
      experienceId: "campfire",
    });
    expect(state.rejectedExperienceIds).toEqual([]);
    expect(state.shelvedExperienceIds).toEqual(["campfire"]);
  });

  it("restore removes an id from both rejected and shelved", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_REJECT",
      experienceId: "campfire",
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_RESTORE",
      experienceId: "campfire",
    });
    expect(state.rejectedExperienceIds).toEqual([]);
  });

  it("tracks the most recent removal for undo", () => {
    const next = discoveryReducer(initial(), {
      type: "EXPERIENCE_REJECT",
      experienceId: "campfire",
    });
    expect(next.lastRemoved).toEqual({
      experienceId: "campfire",
      action: "reject",
    });
  });

  it("unsave removes an id from savedExperienceIds only", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SAVE",
      experienceId: "campfire",
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_UNSAVE",
      experienceId: "campfire",
    });
    expect(state.savedExperienceIds).toEqual([]);
  });

  it("restore does NOT remove an id from savedExperienceIds (regression: only EXPERIENCE_UNSAVE should)", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SAVE",
      experienceId: "campfire",
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_RESTORE",
      experienceId: "campfire",
    });
    expect(state.savedExperienceIds).toEqual(["campfire"]);
  });

  it("clears lastRemoved once that experience is restored", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SHELF",
      experienceId: "campfire",
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_RESTORE",
      experienceId: "campfire",
    });
    expect(state.lastRemoved).toBeNull();
  });
});

describe("discoveryReducer — saved items survive filter and broaden changes", () => {
  it("a saved id is untouched by filter changes", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SAVE",
      experienceId: "campfire",
    });
    state = discoveryReducer(state, {
      type: "FILTER_SET",
      key: "seasons",
      value: ["winter"],
    });
    expect(state.savedExperienceIds).toEqual(["campfire"]);
  });

  it("broadening with 'restore-rejected' clears only rejected ids", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SAVE",
      experienceId: "kept",
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_REJECT",
      experienceId: "gone",
    });
    state = discoveryReducer(state, {
      type: "DISCOVERY_BROADEN",
      strategy: "restore-rejected",
    });
    expect(state.rejectedExperienceIds).toEqual([]);
    expect(state.savedExperienceIds).toEqual(["kept"]);
  });

  it("broadening with 'clear-filters' resets filters and query only", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "FILTER_SET",
      key: "moods",
      value: ["cozy"],
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_REJECT",
      experienceId: "gone",
    });
    state = discoveryReducer(state, {
      type: "DISCOVERY_BROADEN",
      strategy: "clear-filters",
    });
    expect(state.filters.moods).toEqual([]);
    expect(state.rejectedExperienceIds).toEqual(["gone"]);
  });
});

describe("discoveryReducer — board switching", () => {
  it("replaces saved ids with the target board's items and clears shelved/rejected/filters", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SAVE",
      experienceId: "old-board-item",
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SHELF",
      experienceId: "shelved-elsewhere",
    });
    state = discoveryReducer(state, {
      type: "FILTER_SET",
      key: "moods",
      value: ["cozy"],
    });
    state = discoveryReducer(state, {
      type: "BOARD_SWITCHED",
      savedExperienceIds: ["new-board-item"],
    });
    expect(state.savedExperienceIds).toEqual(["new-board-item"]);
    expect(state.shelvedExperienceIds).toEqual([]);
    expect(state.rejectedExperienceIds).toEqual([]);
    expect(state.filters.moods).toEqual([]);
  });
});

describe("discoveryReducer — session reset", () => {
  it("clears filters, query, rejected, and shelved but preserves saved", () => {
    let state = initial();
    state = discoveryReducer(state, {
      type: "EXPERIENCE_SAVE",
      experienceId: "kept",
    });
    state = discoveryReducer(state, {
      type: "EXPERIENCE_REJECT",
      experienceId: "gone",
    });
    state = discoveryReducer(state, {
      type: "FILTER_SET",
      key: "moods",
      value: ["cozy"],
    });
    state = discoveryReducer(state, { type: "DISCOVERY_RESET" });

    expect(state.savedExperienceIds).toEqual(["kept"]);
    expect(state.rejectedExperienceIds).toEqual([]);
    expect(state.filters.moods).toEqual([]);
  });
});
