"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  createEmptyFilterState,
  type DiscoveryFilterState,
} from "@/domain/discovery/types";

export interface DiscoveryFiltersProps {
  filters: DiscoveryFilterState;
  onChange: (next: DiscoveryFilterState) => void;
  resultCount: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  availableMoods: string[];
  availableActivities: string[];
  availableSeasons: string[];
  availableCompanions: string[];
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

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

interface ChipGroupProps {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}

function ChipGroup({ title, options, selected, onToggle }: ChipGroupProps) {
  if (options.length === 0) return null;

  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] font-medium tracking-[0.15em] text-white/40 uppercase">
        {title}
      </legend>
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
                "rounded-full border px-3 py-1 text-xs transition-colors",
                isSelected
                  ? "border-white/40 bg-white/[0.08] text-white/90"
                  : "border-white/10 bg-transparent text-white/50 hover:border-white/20 hover:text-white/70",
              )}
            >
              {titleCase(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface SingleSelectGroupProps {
  title: string;
  options: { value: number; label: string }[];
  selectedValue: number | undefined;
  onSelect: (value: number | undefined) => void;
}

function SingleSelectGroup({
  title,
  options,
  selectedValue,
  onSelect,
}: SingleSelectGroupProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] font-medium tracking-[0.15em] text-white/40 uppercase">
        {title}
      </legend>
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
                  ? "border-white/40 bg-white/[0.08] text-white/90"
                  : "border-white/10 bg-transparent text-white/50 hover:border-white/20 hover:text-white/70",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The first manual filter interface (IMP-002 §10). Deliberately compact —
 * chips and buttons, not a polished final surface. Every change replaces
 * the whole `DiscoveryFilterState` via `onChange`, the same contract
 * Mood Board narrowing, Planner inputs, and Atlas text/voice filtering are
 * expected to drive later.
 */
export function DiscoveryFilters({
  filters,
  onChange,
  resultCount,
  isOpen,
  onToggleOpen,
  availableMoods,
  availableActivities,
  availableSeasons,
  availableCompanions,
}: DiscoveryFiltersProps) {
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    for (const mood of filters.moods) {
      chips.push({
        key: `mood-${mood}`,
        label: titleCase(mood),
        onRemove: () =>
          onChange({ ...filters, moods: toggleValue(filters.moods, mood) }),
      });
    }
    for (const activity of filters.activities) {
      chips.push({
        key: `activity-${activity}`,
        label: titleCase(activity),
        onRemove: () =>
          onChange({
            ...filters,
            activities: toggleValue(filters.activities, activity),
          }),
      });
    }
    for (const season of filters.seasons) {
      chips.push({
        key: `season-${season}`,
        label: titleCase(season),
        onRemove: () =>
          onChange({
            ...filters,
            seasons: toggleValue(filters.seasons, season),
          }),
      });
    }
    for (const companion of filters.companions) {
      chips.push({
        key: `companion-${companion}`,
        label: titleCase(companion),
        onRemove: () =>
          onChange({
            ...filters,
            companions: toggleValue(filters.companions, companion),
          }),
      });
    }
    if (filters.maxEnergyLevel !== undefined) {
      chips.push({
        key: "energy",
        label: `Energy ≤ ${filters.maxEnergyLevel}`,
        onRemove: () => onChange({ ...filters, maxEnergyLevel: undefined }),
      });
    }
    if (filters.maxPriceLevel !== undefined) {
      chips.push({
        key: "price",
        label: `Budget ≤ ${PRICE_LABELS[filters.maxPriceLevel]}`,
        onRemove: () => onChange({ ...filters, maxPriceLevel: undefined }),
      });
    }
    if (filters.maxDurationMinutes !== undefined) {
      const preset = DURATION_PRESETS.find(
        (p) => p.minutes === filters.maxDurationMinutes,
      );
      chips.push({
        key: "duration",
        label: preset?.label ?? `≤ ${filters.maxDurationMinutes} min`,
        onRemove: () => onChange({ ...filters, maxDurationMinutes: undefined }),
      });
    }

    return chips;
  }, [filters, onChange]);

  const hasAnyFilter = activeChips.length > 0;

  return (
    <div className="pointer-events-none fixed top-6 left-6 z-[1000] w-full max-w-xs">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        className="pointer-events-auto rounded-full border border-white/10 bg-[#0b0b0b]/80 px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition-colors hover:border-white/20 hover:text-white/90"
      >
        {isOpen ? "Close filters" : "Filters"}
        {hasAnyFilter ? ` · ${activeChips.length}` : ""}
      </button>

      {isOpen && (
        <div className="pointer-events-auto mt-3 max-h-[80vh] space-y-5 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0b0b]/90 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-white/50">
              {resultCount} discover{resultCount === 1 ? "y" : "ies"}
            </p>
            {hasAnyFilter && (
              <button
                type="button"
                onClick={() => onChange(createEmptyFilterState())}
                className="text-xs text-white/50 underline decoration-white/20 underline-offset-2 hover:text-white/80"
              >
                Reset all
              </button>
            )}
          </div>

          {resultCount === 0 && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
              Nothing matches those filters yet.{" "}
              <button
                type="button"
                onClick={() => onChange(createEmptyFilterState())}
                className="underline decoration-white/30 underline-offset-2 hover:text-white/90"
              >
                Reset filters
              </button>
            </div>
          )}

          {hasAnyFilter && (
            <div className="flex flex-wrap gap-1.5">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="flex items-center gap-1 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-xs text-white/80 hover:border-white/30"
                >
                  {chip.label}
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          )}

          <ChipGroup
            title="Mood"
            options={availableMoods}
            selected={filters.moods}
            onToggle={(value) =>
              onChange({ ...filters, moods: toggleValue(filters.moods, value) })
            }
          />
          <ChipGroup
            title="Activity"
            options={availableActivities}
            selected={filters.activities}
            onToggle={(value) =>
              onChange({
                ...filters,
                activities: toggleValue(filters.activities, value),
              })
            }
          />
          <ChipGroup
            title="Season"
            options={availableSeasons}
            selected={filters.seasons}
            onToggle={(value) =>
              onChange({
                ...filters,
                seasons: toggleValue(filters.seasons, value),
              })
            }
          />
          <ChipGroup
            title="Companions"
            options={availableCompanions}
            selected={filters.companions}
            onToggle={(value) =>
              onChange({
                ...filters,
                companions: toggleValue(filters.companions, value),
              })
            }
          />
          <SingleSelectGroup
            title="Energy"
            options={ENERGY_LEVELS.map((level) => ({
              value: level,
              label: String(level),
            }))}
            selectedValue={filters.maxEnergyLevel}
            onSelect={(value) =>
              onChange({ ...filters, maxEnergyLevel: value })
            }
          />
          <SingleSelectGroup
            title="Budget"
            options={PRICE_LEVELS.map((level) => ({
              value: level,
              label: PRICE_LABELS[level],
            }))}
            selectedValue={filters.maxPriceLevel}
            onSelect={(value) => onChange({ ...filters, maxPriceLevel: value })}
          />
          <SingleSelectGroup
            title="Length of time"
            options={DURATION_PRESETS.map((preset) => ({
              value: preset.minutes,
              label: preset.label,
            }))}
            selectedValue={filters.maxDurationMinutes}
            onSelect={(value) =>
              onChange({ ...filters, maxDurationMinutes: value })
            }
          />
        </div>
      )}
    </div>
  );
}
