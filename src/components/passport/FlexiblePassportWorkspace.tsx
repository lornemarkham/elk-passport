"use client";

import type { ReactNode } from "react";
import { ExperienceRow } from "./ExperienceRow";
import type { Experience } from "@/domain/experience/types";

interface FlexiblePassportWorkspaceProps {
  experiences: Experience[];
  completedIds: Set<string>;
  onToggle: (id: string) => void;
}

// Up Next / Completed are derived from experiences + completedIds on every
// render, not tracked as their own state — completedIds is owned by
// PassportWorkspace and shared with Ordered mode, so switching between
// styles doesn't reset what's already been checked off.
export function FlexiblePassportWorkspace({
  experiences,
  completedIds,
  onToggle,
}: FlexiblePassportWorkspaceProps) {
  const upNext = experiences.filter((e) => !completedIds.has(e.id));
  const completed = experiences.filter((e) => completedIds.has(e.id));

  return (
    <section
      aria-label="Journey"
      className="rounded-2xl border border-[#8a5a24]/20 bg-[#f7ecd3]/40 p-5"
    >
      <p className="mb-0.5 text-sm font-medium text-[#2b2015]/70">
        Your Adventure Plan
      </p>
      <p className="mb-4 text-xs text-[#2b2015]/50">
        These are the adventures you still have left to experience.
      </p>

      <ExperienceGroup label="Up Next" count={upNext.length}>
        {upNext.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#8a5a24]/25 bg-[#f7ecd3]/30 px-4 py-6 text-center text-sm text-[#2b2015]/60">
            Everything&apos;s checked off — nice work.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {upNext.map((experience) => (
              <li key={experience.id}>
                <ExperienceRow
                  experience={experience}
                  completed={false}
                  onToggle={() => onToggle(experience.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </ExperienceGroup>

      {completed.length > 0 && (
        <div className="mt-6">
          <ExperienceGroup label="Completed" count={completed.length}>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {completed.map((experience) => (
                <li key={experience.id}>
                  <ExperienceRow
                    experience={experience}
                    completed
                    onToggle={() => onToggle(experience.id)}
                  />
                </li>
              ))}
            </ul>
          </ExperienceGroup>
        </div>
      )}
    </section>
  );
}

function ExperienceGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium tracking-wide text-[#2b2015]/45 uppercase">
        {label} {count > 0 && `(${count})`}
      </p>
      {children}
    </div>
  );
}
