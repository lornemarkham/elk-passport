import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { filterExperiences } from "@/domain/discovery/filterExperiences";
import {
  createEmptyFilterState,
  type DiscoveryFilterState,
} from "@/domain/discovery/types";
import { SEED_EXPERIENCES } from "@/domain/experience/seedExperiences";
import { DiscoveryFilters } from "./DiscoveryFilters";

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

const AVAILABLE_MOODS = uniqueSorted(SEED_EXPERIENCES.flatMap((e) => e.moods));
const AVAILABLE_ACTIVITIES = uniqueSorted(
  SEED_EXPERIENCES.flatMap((e) => e.activities),
);
const AVAILABLE_SEASONS = uniqueSorted(
  SEED_EXPERIENCES.flatMap((e) => e.seasons),
);
const AVAILABLE_COMPANIONS = uniqueSorted(
  SEED_EXPERIENCES.flatMap((e) => e.companions),
);

/** Wires the real filter panel to the real pure filtering function and the
 * real seed data — this is the integration-level test IMP-002 §13 asks
 * for, confirming the visible result count actually changes when a filter
 * is applied and cleared. */
function DiscoveryFiltersHarness() {
  const [filters, setFilters] = useState<DiscoveryFilterState>(
    createEmptyFilterState(),
  );
  const resultCount = filterExperiences(SEED_EXPERIENCES, filters).length;

  return (
    <DiscoveryFilters
      filters={filters}
      onChange={setFilters}
      resultCount={resultCount}
      isOpen
      onToggleOpen={() => {}}
      availableMoods={AVAILABLE_MOODS}
      availableActivities={AVAILABLE_ACTIVITIES}
      availableSeasons={AVAILABLE_SEASONS}
      availableCompanions={AVAILABLE_COMPANIONS}
    />
  );
}

describe("Discovery filtering integration", () => {
  it("updates and then clears the visible result count", () => {
    render(<DiscoveryFiltersHarness />);

    const totalCount = SEED_EXPERIENCES.filter((e) => e.isActive).length;
    const winterCount = filterExperiences(SEED_EXPERIENCES, {
      ...createEmptyFilterState(),
      seasons: ["winter"],
    }).length;

    expect(winterCount).toBeGreaterThan(0);
    expect(winterCount).toBeLessThan(totalCount);
    expect(screen.getByText(`${totalCount} discoveries`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Winter" }));

    expect(
      screen.getByText(
        `${winterCount} discover${winterCount === 1 ? "y" : "ies"}`,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));

    expect(screen.getByText(`${totalCount} discoveries`)).toBeInTheDocument();
  });
});
