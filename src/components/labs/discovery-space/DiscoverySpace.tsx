"use client";

import { useMemo, useRef, useState } from "react";
import { LayoutGroup, useMotionValue } from "framer-motion";
import { filterExperiences } from "@/domain/discovery/filterExperiences";
import {
  createEmptyFilterState,
  type DiscoveryFilterState,
} from "@/domain/discovery/types";
import { SEED_EXPERIENCES } from "@/domain/experience/seedExperiences";
import { DiscoveryCard } from "./DiscoveryCard";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { toFieldExperience } from "./fieldPresentation";
import { MoodBoard } from "./MoodBoard";
import { usePeripheralTemptation } from "./temptation/usePeripheralTemptation";
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

export function DiscoverySpace() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoveryFilterState>(
    createEmptyFilterState(),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // The one pure Compass filtering call (IMP-002 §4/§11). Everything after
  // this is presentation: mapping the filtered canonical experiences onto
  // Discovery's existing field-card rendering.
  const filteredExperiences = useMemo(
    () => filterExperiences(SEED_EXPERIENCES, filters),
    [filters],
  );

  const filteredFieldExperiences = useMemo(
    () =>
      filteredExperiences
        .map(toFieldExperience)
        .filter((experience): experience is FieldExperience =>
          Boolean(experience),
        ),
    [filteredExperiences],
  );

  // Peripheral Temptation (Discovery Lab v0.4): a self-contained layer that
  // occasionally lets one eligible, unhovered, non-saved card run one brief
  // environmental event. See temptation/usePeripheralTemptation.ts for the
  // full scheduler — this component only feeds it state and renders what
  // it returns.
  const activeTemptation = usePeripheralTemptation({
    cards: filteredFieldExperiences,
    hoveredCardId,
    moodBoardCardIds: savedIds,
    enabled: true,
  });

  // Cursor position as a percentage of the field — the same coordinate
  // space each card's own top/left layout already lives in, so individual
  // cards can measure their own distance to the pointer with no DOM reads.
  // Deliberately the only cursor-driven signal left in the space: it only
  // ever does anything once a card is close enough to notice — the room
  // itself no longer reacts to movement for its own sake.
  const pointerXPercent = useMotionValue(-1000);
  const pointerYPercent = useMotionValue(-1000);

  const save = (experience: Experience) => {
    setSavedIds((prev) =>
      prev.includes(experience.id) ? prev : [...prev, experience.id],
    );
  };

  const remove = (id: string) => {
    setSavedIds((prev) => prev.filter((savedId) => savedId !== id));
  };

  // Looked up from the *unfiltered* full field, not the filtered one — a
  // saved card must never disappear from the Mood Board just because a
  // later filter would have excluded it (IMP-002 §10/§14).
  const saved = savedIds
    .map((id) =>
      ALL_FIELD_EXPERIENCES.find((experience) => experience.id === id),
    )
    .filter((experience): experience is FieldExperience => Boolean(experience));

  const field = filteredFieldExperiences.filter(
    (experience) => !savedIds.includes(experience.id),
  );

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
        filters={filters}
        onChange={setFilters}
        resultCount={filteredExperiences.length}
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
              onSelect={save}
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
        <MoodBoard experiences={saved} onRemove={remove} />
      </LayoutGroup>
    </div>
  );
}
