"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup, useMotionValue } from "framer-motion";
import { selectActiveExperiences } from "@/domain/discovery/selectors";
import { SEED_EXPERIENCES } from "@/domain/experience/seedExperiences";
import type { Experience as DomainExperience } from "@/domain/experience/types";
import { logDiscoveryEvent } from "@/domain/discovery/interactions";
import { DiscoveryCard } from "./DiscoveryCard";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { DiscoveryInspectSheet } from "./DiscoveryInspectSheet";
import { toFieldExperience } from "./fieldPresentation";
import { MoodBoard } from "./MoodBoard";
import { usePeripheralTemptation } from "./temptation/usePeripheralTemptation";
import { usePrefersReducedMotion } from "./temptation/usePrefersReducedMotion";
import { useDiscoveryEngine } from "./useDiscoveryEngine";
import type { Experience, FieldExperience } from "./types";

// Every seed experience mapped to its Discovery presentation, computed
// once — stable across renders and across filter changes, so filtering
// only ever changes *which* cards are visible, never where a still-visible
// card sits (IMP-002 §11: "must not create new random positions").
const ALL_FIELD_EXPERIENCES: FieldExperience[] = SEED_EXPERIENCES.map(
  toFieldExperience,
).filter((experience): experience is FieldExperience => Boolean(experience));

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

function toField(experience: DomainExperience): FieldExperience | null {
  return ALL_FIELD_EXPERIENCES.find((f) => f.id === experience.id) ?? null;
}

export function DiscoverySpace() {
  const engine = useDiscoveryEngine();
  const { state } = engine;

  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inspecting, setInspecting] = useState<Experience | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // The one pure Compass call (IMP-002 §4/§11, extended by IMP-004): filters
  // + query + save/reject/shelf state all collapse to "what's active right
  // now" through a single selector, so no consumer re-derives this itself.
  const activeExperiences = useMemo(
    () => selectActiveExperiences(SEED_EXPERIENCES, state),
    [state],
  );

  const field = useMemo(
    () =>
      activeExperiences
        .map(toField)
        .filter((experience): experience is FieldExperience =>
          Boolean(experience),
        ),
    [activeExperiences],
  );

  // Looked up from the *unfiltered* full field, not the filtered one — a
  // saved or shelved card must never disappear from the Mood Board just
  // because a later filter would have excluded it (IMP-002 §10/§14,
  // preserved by IMP-004's "Mood Board is separate from the current result
  // set" architecture decision).
  const savedFieldExperiences = state.savedExperienceIds
    .map((id) => ALL_FIELD_EXPERIENCES.find((e) => e.id === id))
    .filter((e): e is FieldExperience => Boolean(e));
  const shelvedFieldExperiences = state.shelvedExperienceIds
    .map((id) => ALL_FIELD_EXPERIENCES.find((e) => e.id === id))
    .filter((e): e is FieldExperience => Boolean(e));

  // Peripheral Temptation (Discovery Lab v0.4): a self-contained layer that
  // occasionally lets one eligible, unhovered, non-saved card run one brief
  // environmental event. Rejected/shelved cards are never in `field`, so
  // they're naturally excluded here too. See
  // temptation/usePeripheralTemptation.ts for the full scheduler.
  const activeTemptation = usePeripheralTemptation({
    cards: field,
    hoveredCardId,
    moodBoardCardIds: state.savedExperienceIds,
    enabled: true,
  });

  // Cursor position as a percentage of the field — the same coordinate
  // space each card's own top/left layout already lives in, so individual
  // cards can measure their own distance to the pointer with no DOM reads.
  const pointerXPercent = useMotionValue(-1000);
  const pointerYPercent = useMotionValue(-1000);

  // Result count is a learning signal on its own (IMP-004 "Analytics and
  // Learning Signals"). Logged from here, not the engine, since the engine
  // is intentionally catalogue-agnostic.
  useEffect(() => {
    logDiscoveryEvent({
      type: "result_count_changed",
      sessionId: state.sessionId,
      occurredAt: new Date().toISOString(),
      count: activeExperiences.length,
    });
  }, [activeExperiences.length, state.sessionId]);

  function focusStableAnchor() {
    // A card leaving the DOM after a save/reject/shelf action would
    // otherwise drop keyboard focus to <body> with no warning (IMP-004
    // "Focus must move predictably when cards leave the active set").
    filtersButtonRef.current?.focus();
  }

  function handleSave(experience: Experience) {
    engine.save(experience.id);
    focusStableAnchor();
  }
  function handleReject(experience: Experience) {
    engine.reject(experience.id);
    focusStableAnchor();
  }
  function handleShelf(experience: Experience) {
    engine.shelf(experience.id);
    focusStableAnchor();
  }
  function handleInspect(experience: Experience) {
    engine.inspect(experience.id);
    setInspecting(experience);
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={(event) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        pointerXPercent.set(((event.clientX - rect.left) / rect.width) * 100);
        pointerYPercent.set(((event.clientY - rect.top) / rect.height) * 100);
      }}
      onPointerLeave={() => {
        pointerXPercent.set(-1000);
        pointerYPercent.set(-1000);
      }}
      className="fixed inset-0 h-dvh w-dvw overflow-hidden bg-[#0b0b0b]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 22%, rgba(255,255,255,0.05), transparent 45%), radial-gradient(circle at 82% 75%, rgba(255,255,255,0.04), transparent 40%)",
        }}
      />
      <DiscoveryFilters
        ref={filtersButtonRef}
        filters={state.filters}
        onChange={engine.setFilters}
        query={state.query}
        onQueryChange={engine.setQuery}
        resultCount={activeExperiences.length}
        isOpen={filtersOpen}
        onToggleOpen={() => setFiltersOpen((prev) => !prev)}
        availableMoods={AVAILABLE_MOODS}
        availableActivities={AVAILABLE_ACTIVITIES}
        availableSeasons={AVAILABLE_SEASONS}
        availableCompanions={AVAILABLE_COMPANIONS}
      />
      <LayoutGroup>
        <div className="relative h-full w-full">
          {field.map((experience) => (
            <DiscoveryCard
              key={experience.id}
              experience={experience}
              layout={experience.layout}
              onInspect={handleInspect}
              onSave={handleSave}
              onReject={handleReject}
              onShelf={handleShelf}
              pointerXPercent={pointerXPercent}
              pointerYPercent={pointerYPercent}
              activeTemptation={activeTemptation}
              onHoverChange={(hovering) =>
                setHoveredCardId((prev) => {
                  if (hovering) return experience.id;
                  return prev === experience.id ? null : prev;
                })
              }
            />
          ))}
        </div>
        <MoodBoard
          savedExperiences={savedFieldExperiences}
          shelvedExperiences={shelvedFieldExperiences}
          onRemoveSaved={(id) => engine.removeSaved(id)}
          onReturnShelved={(id) => engine.restore(id)}
          rejectedCount={state.rejectedExperienceIds.length}
          hasActiveFilters={
            Object.values(state.filters).some((value) =>
              Array.isArray(value) ? value.length > 0 : value !== undefined,
            ) || state.query.trim().length > 0
          }
          onRestoreRejected={() => engine.broaden("restore-rejected")}
          onClearFilters={() => engine.broaden("clear-filters")}
        />
      </LayoutGroup>

      <DiscoveryInspectSheet
        experience={inspecting}
        onOpenChange={(open) => !open && setInspecting(null)}
        onSave={(experience) => handleSave(experience)}
        onReject={(experience) => handleReject(experience)}
        onShelf={(experience) => handleShelf(experience)}
      />

      {state.lastRemoved && !prefersReducedMotion && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[1000] -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-[#0b0b0b]/90 px-4 py-2 text-xs text-white/70 backdrop-blur-md">
            <span>
              {state.lastRemoved.action === "reject"
                ? "Marked not interested."
                : "Shelved for later."}
            </span>
            <button
              type="button"
              onClick={() => engine.restoreLastRemoved()}
              className="font-medium text-white/90 underline decoration-white/30 underline-offset-2 hover:text-white"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
