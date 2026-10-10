"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscoveryFilterState } from "@/domain/discovery/types";
import { kindLabel } from "@/domain/discovery/defaultFeed";
import type { ExperienceKind } from "@/domain/experience/types";

interface DiscoveryListFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  filters: DiscoveryFilterState;
  onFiltersChange: (next: DiscoveryFilterState) => void;
  availableMoods: string[];
  availableActivities: string[];
  availableSeasons: string[];
  availableCompanions: string[];
  resultCount: number;
  kinds: ExperienceKind[];
  selectedKind: ExperienceKind | null;
  onKindChange: (kind: ExperienceKind | null) => void;
  /** True when a query or an explicit kind is active — the view is then searching the whole corpus. */
  browsing: boolean;
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-[#2b2015]/45 uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(option)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-3.5 text-xs capitalize transition-colors",
                isSelected
                  ? "border-[#8a5a24]/50 bg-[#8a5a24]/10 text-[#2b2015]"
                  : "border-[#8a5a24]/15 bg-transparent text-[#2b2015]/50 hover:border-[#8a5a24]/30 hover:text-[#2b2015]/70",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DiscoveryListFilters({
  kinds,
  selectedKind,
  onKindChange,
  browsing,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  availableMoods,
  availableActivities,
  availableSeasons,
  availableCompanions,
  resultCount,
}: DiscoveryListFiltersProps) {
  const hasChipCategories =
    availableMoods.length > 0 ||
    availableActivities.length > 0 ||
    availableSeasons.length > 0 ||
    availableCompanions.length > 0;

  return (
    <div className="rounded-2xl border border-[#8a5a24]/20 bg-[#f7ecd3]/40 p-5">
      <label className="block">
        <span className="sr-only">Search experiences</span>
        <div className="flex items-center gap-2 rounded-lg border border-[#8a5a24]/20 bg-white/60 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-[#8a5a24]/60" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search experiences…"
            className="w-full bg-transparent text-sm text-[#2b2015] placeholder:text-[#2b2015]/35 focus:outline-none"
          />
        </div>
      </label>

      {hasChipCategories && (
        <div className="mt-4 flex flex-col gap-3">
          <ChipGroup
            label="Mood"
            options={availableMoods}
            selected={filters.moods}
            onToggle={(value) =>
              onFiltersChange({
                ...filters,
                moods: toggleValue(filters.moods, value),
              })
            }
          />
          <ChipGroup
            label="Activity"
            options={availableActivities}
            selected={filters.activities}
            onToggle={(value) =>
              onFiltersChange({
                ...filters,
                activities: toggleValue(filters.activities, value),
              })
            }
          />
          <ChipGroup
            label="Season"
            options={availableSeasons}
            selected={filters.seasons}
            onToggle={(value) =>
              onFiltersChange({
                ...filters,
                seasons: toggleValue(filters.seasons, value),
              })
            }
          />
          <ChipGroup
            label="Companions"
            options={availableCompanions}
            selected={filters.companions}
            onToggle={(value) =>
              onFiltersChange({
                ...filters,
                companions: toggleValue(filters.companions, value),
              })
            }
          />
        </div>
      )}

      {/* Energy, Budget and Length of time were removed on 2026-09-03. They
          filtered attributes `atlasMapper` fabricated as identical constants
          for every record; once the fabrication stopped they matched nothing.
          Nothing replaces them — Atlas states no such facts, and inventing
          them again to populate a rail is what put a wrong pet policy on
          Ellison Park. */}

      {/* Browse by what Atlas says a thing *is*. No second Passport taxonomy —
          `kind` comes straight off the candidate. Choosing one also widens the
          search to the whole corpus, so an explicit "Things to do" shows the
          Activities the conservative default feed leaves out. */}
      {kinds.length > 1 && (
        <div
          className="mt-4 flex flex-wrap gap-2"
          role="group"
          aria-label="Browse by kind"
        >
          <button
            type="button"
            onClick={() => onKindChange(null)}
            aria-pressed={selectedKind === null}
            className={chipClass(selectedKind === null)}
          >
            For you
          </button>
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onKindChange(selectedKind === kind ? null : kind)}
              aria-pressed={selectedKind === kind}
              className={chipClass(selectedKind === kind)}
            >
              {kindLabel(kind)}
            </button>
          ))}
        </div>
      )}

      {/* **Only while somebody is actually searching.**
          "2248 to explore" was the page's answer to "what could I do?" — a row
          count offered as a product fact, and the single clearest statement
          that this was a database with a search box on it. Idle, the composed
          page below says what is worth looking at; a number says nothing. A
          result count while searching is genuinely useful, so that stays. */}
      {browsing && (
        <p
          className="mt-4 text-xs text-[#2b2015]/50"
          data-testid="result-summary"
        >
          {resultCount === 0
            ? "Nothing here matches that"
            : `${resultCount} ${resultCount === 1 ? "result" : "results"}`}
        </p>
      )}
    </div>
  );
}

function chipClass(active: boolean): string {
  return active
    ? "inline-flex min-h-11 items-center rounded-full border border-[#8a5a24] bg-[#8a5a24] px-3.5 text-xs text-[#f7ecd3]"
    : "inline-flex min-h-11 items-center rounded-full border border-[#8a5a24]/25 px-3.5 text-xs text-[#2b2015]/70 transition-colors hover:border-[#8a5a24]/50";
}
