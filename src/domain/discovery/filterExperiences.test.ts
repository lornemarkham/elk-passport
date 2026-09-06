import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { filterExperiences } from "./filterExperiences";
import { createEmptyFilterState } from "./types";

function makeExperience(overrides: Partial<Experience> = {}): Experience {
  return {
    kind: "Place",
    detailReady: true,
    id: "test-experience",
    regionIds: [],
    slug: "test-experience",
    title: "Test Experience",
    shortDescription: "A test experience.",
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 1,
    priceLevel: 0,
    duration: { minMinutes: 30, maxMinutes: 60 },
    familyFriendly: false,
    petFriendly: false,
    requiresReservation: false,
    isActive: true,
    ...overrides,
  };
}

describe("filterExperiences", () => {
  it("returns all active experiences when no filters are set", () => {
    const experiences = [
      makeExperience({ id: "a" }),
      makeExperience({ id: "b" }),
    ];

    const result = filterExperiences(experiences, createEmptyFilterState());

    expect(result.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("excludes inactive experiences even with no other filters", () => {
    const experiences = [
      makeExperience({ id: "active", isActive: true }),
      makeExperience({ id: "inactive", isActive: false }),
    ];

    const result = filterExperiences(experiences, createEmptyFilterState());

    expect(result.map((e) => e.id)).toEqual(["active"]);
  });

  it("applies a single mood filter", () => {
    const experiences = [
      makeExperience({ id: "relaxing", moods: ["relaxing"] }),
      makeExperience({ id: "thrilling", moods: ["thrilling"] }),
    ];

    const result = filterExperiences(experiences, {
      ...createEmptyFilterState(),
      moods: ["relaxing"],
    });

    expect(result.map((e) => e.id)).toEqual(["relaxing"]);
  });

  it("combines multiple selected moods with OR", () => {
    const experiences = [
      makeExperience({ id: "relaxing", moods: ["relaxing"] }),
      makeExperience({ id: "thrilling", moods: ["thrilling"] }),
      makeExperience({ id: "romantic", moods: ["romantic"] }),
    ];

    const result = filterExperiences(experiences, {
      ...createEmptyFilterState(),
      moods: ["relaxing", "thrilling"],
    });

    expect(result.map((e) => e.id).sort()).toEqual(["relaxing", "thrilling"]);
  });

  it("combines mood and season with AND", () => {
    const experiences = [
      makeExperience({
        id: "matches-both",
        moods: ["relaxing"],
        seasons: ["summer"],
      }),
      makeExperience({
        id: "mood-only",
        moods: ["relaxing"],
        seasons: ["winter"],
      }),
      makeExperience({
        id: "season-only",
        moods: ["thrilling"],
        seasons: ["summer"],
      }),
    ];

    const result = filterExperiences(experiences, {
      ...createEmptyFilterState(),
      moods: ["relaxing"],
      seasons: ["summer"],
    });

    expect(result.map((e) => e.id)).toEqual(["matches-both"]);
  });

  it("includes experiences at or below the energy ceiling", () => {
    const experiences = [
      makeExperience({ id: "low", energyLevel: 1 }),
      makeExperience({ id: "mid", energyLevel: 3 }),
      makeExperience({ id: "high", energyLevel: 5 }),
    ];

    const result = filterExperiences(experiences, {
      ...createEmptyFilterState(),
      maxEnergyLevel: 3,
    });

    expect(result.map((e) => e.id).sort()).toEqual(["low", "mid"]);
  });

  it("includes experiences at or below the budget ceiling", () => {
    const experiences = [
      makeExperience({ id: "free", priceLevel: 0 }),
      makeExperience({ id: "mid", priceLevel: 2 }),
      makeExperience({ id: "expensive", priceLevel: 4 }),
    ];

    const result = filterExperiences(experiences, {
      ...createEmptyFilterState(),
      maxPriceLevel: 2,
    });

    expect(result.map((e) => e.id).sort()).toEqual(["free", "mid"]);
  });

  it("matches when the experience's minimum duration fits the available time", () => {
    const experiences = [
      makeExperience({
        id: "fits",
        duration: { minMinutes: 60, maxMinutes: 90 },
      }),
      makeExperience({
        id: "too-long",
        duration: { minMinutes: 300, maxMinutes: 360 },
      }),
    ];

    const result = filterExperiences(experiences, {
      ...createEmptyFilterState(),
      maxDurationMinutes: 120,
    });

    expect(result.map((e) => e.id)).toEqual(["fits"]);
  });

  it("only restricts on a boolean filter when it is explicitly set", () => {
    const experiences = [
      makeExperience({ id: "family", familyFriendly: true }),
      makeExperience({ id: "not-family", familyFriendly: false }),
    ];

    const unfiltered = filterExperiences(experiences, createEmptyFilterState());
    expect(unfiltered.map((e) => e.id).sort()).toEqual([
      "family",
      "not-family",
    ]);

    const filtered = filterExperiences(experiences, {
      ...createEmptyFilterState(),
      familyFriendly: true,
    });
    expect(filtered.map((e) => e.id)).toEqual(["family"]);
  });

  it("does not mutate the input experiences array or the filter state", () => {
    const experiences = [makeExperience({ id: "a", moods: ["relaxing"] })];
    const experiencesCopy = JSON.parse(JSON.stringify(experiences));
    const filters = { ...createEmptyFilterState(), moods: ["relaxing"] };
    const filtersCopy = JSON.parse(JSON.stringify(filters));

    filterExperiences(experiences, filters);

    expect(experiences).toEqual(experiencesCopy);
    expect(filters).toEqual(filtersCopy);
  });

  it("returns an empty array when nothing matches", () => {
    const experiences = [
      makeExperience({ id: "a", moods: ["relaxing"] }),
      makeExperience({ id: "b", moods: ["thrilling"] }),
    ];

    const result = filterExperiences(experiences, {
      ...createEmptyFilterState(),
      moods: ["romantic"],
    });

    expect(result).toEqual([]);
  });
});
