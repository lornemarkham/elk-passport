"use client";

import { ExperienceRow } from "./ExperienceRow";
import type { Experience } from "@/domain/experience/types";

interface OrderedPassportWorkspaceProps {
  experiences: Experience[];
  orderedIds: string[];
  completedIds: Set<string>;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}

// Ordered keeps exactly one list — no Up Next/Completed split — because
// the whole point of this mode is that the sequence the user chose stays
// put. Completion only changes how a row looks (checked, struck through),
// never where it sits.
export function OrderedPassportWorkspace({
  experiences,
  orderedIds,
  completedIds,
  onToggle,
  onMove,
}: OrderedPassportWorkspaceProps) {
  const experienceById = new Map(experiences.map((e) => [e.id, e]));
  const ordered = orderedIds
    .map((id) => experienceById.get(id))
    .filter((experience): experience is Experience => Boolean(experience));

  return (
    <section
      aria-label="Journey"
      className="rounded-2xl border border-[#8a5a24]/20 bg-[#f7ecd3]/40 p-5"
    >
      <p className="mb-0.5 text-sm font-medium text-[#2b2015]/70">
        Your Adventure Plan
      </p>
      <p className="mb-4 text-xs text-[#2b2015]/50">
        Complete these in the order you&apos;ve arranged them.
      </p>
      <ol className="flex flex-col gap-3">
        {ordered.map((experience, index) => (
          <li key={experience.id}>
            <ExperienceRow
              experience={experience}
              completed={completedIds.has(experience.id)}
              onToggle={() => onToggle(experience.id)}
              sequence={index + 1}
              onMoveUp={
                index > 0 ? () => onMove(experience.id, "up") : undefined
              }
              onMoveDown={
                index < ordered.length - 1
                  ? () => onMove(experience.id, "down")
                  : undefined
              }
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
