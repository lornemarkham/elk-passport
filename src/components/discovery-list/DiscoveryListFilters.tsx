"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscoveryFilterState } from "@/domain/discovery/types";

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
}

const ENERGY_LEVELS = [1, 2, 3, 4, 5];
const PRICE_LEVELS = [0, 1, 2, 3, 4];
const PRICE_LABELS: Record<number, string> = {
  0: "Free",
  1: "$",
  2: "$$",
  3: "$$$",
  4: "$$$$",
};
const DURATION_PRESETS = [
  { label: "≤ 1 hr", minutes: 60 },
  { label: "≤ 2 hrs", minutes: 120 },
  { label: "≤ 4 hrs", minutes: 240 },
  { label: "Full day", minutes: 1440 },
];

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
                "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
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

function SingleSelectGroup({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: { value: number; label: string }[];
  selectedValue: number | undefined;
  onSelect: (value: number | undefined) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-[#2b2015]/45 uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = selectedValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? undefined : option.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                isSelected
                  ? "border-[#8a5a24]/50 bg-[#8a5a24]/10 text-[#2b2015]"
                  : "border-[#8a5a24]/15 bg-transparent text-[#2b2015]/50 hover:border-[#8a5a24]/30 hover:text-[#2b2015]/70",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Search is real — it's the same free-text matching Discovery's
 * immersive field uses (domain/discovery/selectors.matchesQuery). Every
 * filter here runs through the same filterExperiences() every Discovery
 * consumer is expected to share (the same set the immersive
 * labs/discovery-space/DiscoveryFilters.tsx exposes). Category chips
 * render nothing when the catalogue has no values for that category yet
 * — the layout supports the category without inventing data that isn't
 * there. Energy/Budget/Length are fixed scales, not derived from the
 * catalogue, so they're always shown. */
export function DiscoveryListFilters({
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

      <div className="mt-4 flex flex-col gap-3">
        <SingleSelectGroup
          label="Energy"
          options={ENERGY_LEVELS.map((level) => ({
            value: level,
            label: String(level),
          }))}
          selectedValue={filters.maxEnergyLevel}
          onSelect={(value) =>
            onFiltersChange({ ...filters, maxEnergyLevel: value })
          }
        />
        <SingleSelectGroup
          label="Budget"
          options={PRICE_LEVELS.map((level) => ({
            value: level,
            label: PRICE_LABELS[level],
          }))}
          selectedValue={filters.maxPriceLevel}
          onSelect={(value) =>
            onFiltersChange({ ...filters, maxPriceLevel: value })
          }
        />
        <SingleSelectGroup
          label="Length of time"
          options={DURATION_PRESETS.map((preset) => ({
            value: preset.minutes,
            label: preset.label,
          }))}
          selectedValue={filters.maxDurationMinutes}
          onSelect={(value) =>
            onFiltersChange({ ...filters, maxDurationMinutes: value })
          }
        />
      </div>

      <p className="mt-4 text-xs text-[#2b2015]/50">
        {resultCount} {resultCount === 1 ? "experience" : "experiences"}
      </p>
    </div>
  );
}
