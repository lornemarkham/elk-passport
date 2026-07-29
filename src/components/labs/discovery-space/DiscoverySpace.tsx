"use client";

import { useRef, useState } from "react";
import { LayoutGroup, useMotionValue } from "framer-motion";
import { DiscoveryCard } from "./DiscoveryCard";
import { MoodBoard } from "./MoodBoard";
import { EXPERIENCES } from "./fakeExperiences";
import { usePeripheralTemptation } from "./temptation/usePeripheralTemptation";
import type { Experience, FieldExperience } from "./types";

export function DiscoverySpace() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Peripheral Temptation (Discovery Lab v0.4): a self-contained layer that
  // occasionally lets one eligible, unhovered, non-saved card run one brief
  // environmental event. See temptation/usePeripheralTemptation.ts for the
  // full scheduler — this component only feeds it state and renders what
  // it returns.
  const activeTemptation = usePeripheralTemptation({
    cards: EXPERIENCES,
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

  const saved = savedIds
    .map((id) => EXPERIENCES.find((experience) => experience.id === id))
    .filter((experience): experience is FieldExperience => Boolean(experience));

  const field = EXPERIENCES.filter(
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
