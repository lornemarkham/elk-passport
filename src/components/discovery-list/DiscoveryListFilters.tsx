"use client";

import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
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
  /** The category the count is inside, where one is chosen. */
  within?: string;
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
      <p className="mb-1.5 text-[11px] font-medium tracking-wide text-black/45 uppercase">
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
                  ? "border-black/50 bg-black/10 text-[#111]"
                  : "border-black/15 bg-transparent text-black/50 hover:border-black/30 hover:text-black/70",
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
  within,
}: DiscoveryListFiltersProps) {
  const hasChipCategories =
    availableMoods.length > 0 ||
    availableActivities.length > 0 ||
    availableSeasons.length > 0 ||
    availableCompanions.length > 0;

  return (
    <div className="rounded-2xl border border-black/20 bg-white p-5">
      <label className="block">
        <span className="sr-only">Search experiences</span>
        <div className="flex items-center gap-2 rounded-lg border border-black/20 bg-white px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-black/60" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search experiences…"
            className="w-full bg-transparent text-sm text-[#111] placeholder:text-black/35 focus:outline-none"
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

      {/* **The ontology tax, now behind a door.**
          Browse by what Atlas says a thing *is* — `kind` straight off the
          candidate, no second Passport taxonomy. It is genuinely useful: an
          explicit "Things to do" widens the search to the whole corpus and
          surfaces the Activities the conservative default feed leaves out.

          What it must not be is the *first* thing a person is offered. Two
          chip rows — human intent, then Places / Food & business / Things to
          do / Events / Experiences — stacked to about 160px on a phone before
          a single possibility, and asked somebody to hold two different
          vocabularies in their head to browse their own Saturday. The
          doctrine is explicit that human intent beats ontology; it does not
          say ontology is worthless.

          So it is one press away, open when something in it is already
          chosen, and it says how many kinds are behind it rather than
          spending the row on them. */}
      {kinds.length > 1 && (
        <details
          className="group mt-4"
          open={selectedKind !== null}
          data-testid="kind-filter"
        >
          <summary className="ghad-accent-text inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-75">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            {selectedKind ? kindLabel(selectedKind) : "Filter by type"}
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="group"
            aria-label="Browse by kind"
          >
            <button
              type="button"
              onClick={() => onKindChange(null)}
              aria-pressed={selectedKind === null}
              className={chipClass(selectedKind === null)}
            >
              Everything
            </button>
            {kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() =>
                  onKindChange(selectedKind === kind ? null : kind)
                }
                aria-pressed={selectedKind === kind}
                className={chipClass(selectedKind === kind)}
              >
                {kindLabel(kind)}
              </button>
            ))}
          </div>
        </details>
      )}

      {/* **Only while somebody is actually searching.**
          "2248 to explore" was the page's answer to "what could I do?" — a row
          count offered as a product fact, and the single clearest statement
          that this was a database with a search box on it. Idle, the composed
          page below says what is worth looking at; a number says nothing. A
          result count while searching is genuinely useful, so that stays. */}
      {browsing && (
        <p className="mt-4 text-xs text-black/50" data-testid="result-summary">
          {/* **A bare count does not say what it counted.** Reported: with
              *Farms & markets* chosen, typing `farm` moved "120 results" to
              "71 results" and nothing said whether the search had narrowed
              the category or replaced it. It narrows — so the sentence now
              says so, and says it in the same words as the chip above. */}
          {resultCount === 0
            ? `Nothing${within ? ` in ${within}` : " here"} matches that`
            : `${resultCount} ${resultCount === 1 ? "result" : "results"}${
                within ? ` in ${within}` : ""
              }${query.trim() ? ` for “${query.trim()}”` : ""}`}
        </p>
      )}
    </div>
  );
}

function chipClass(active: boolean): string {
  return active
    ? "inline-flex min-h-11 items-center rounded-full border border-[#111] bg-[#111] px-3.5 text-xs text-white"
    : "inline-flex min-h-11 items-center rounded-full border border-black/25 px-3.5 text-xs text-black/70 transition-colors hover:border-black/50";
}
