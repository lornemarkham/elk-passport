import { beforeEach, describe, expect, it } from "vitest";
import { createLocalDiscoveryPersistence } from "./persistence";
import { createEmptyFilterState } from "./types";

describe("createLocalDiscoveryPersistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing has been saved yet", () => {
    const persistence = createLocalDiscoveryPersistence();
    expect(persistence.load()).toBeNull();
  });

  it("round-trips saved state", () => {
    const persistence = createLocalDiscoveryPersistence();
    const state = {
      savedExperienceIds: ["campfire"],
      shelvedExperienceIds: ["winery"],
      filters: { ...createEmptyFilterState(), moods: ["cozy"] },
      query: "sunset",
    };

    persistence.save(state);
    expect(persistence.load()).toEqual(state);
  });

  it("clear removes persisted state", () => {
    const persistence = createLocalDiscoveryPersistence();
    persistence.save({
      savedExperienceIds: ["campfire"],
      shelvedExperienceIds: [],
      filters: createEmptyFilterState(),
      query: "",
    });
    persistence.clear();
    expect(persistence.load()).toBeNull();
  });
});
