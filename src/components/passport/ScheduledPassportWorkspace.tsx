"use client";

import { ExperienceRow } from "./ExperienceRow";
import type { Experience } from "@/domain/experience/types";

interface ScheduledPassportWorkspaceProps {
  experiences: Experience[];
  /** experienceId -> datetime-local value ("YYYY-MM-DDTHH:mm"). Native
   * input format, stored as-is — no parsing/reshaping needed to persist
   * this later. */
  scheduledAt: Map<string, string>;
  onSchedule: (id: string, value: string | null) => void;
  completedIds: Set<string>;
  onToggle: (id: string) => void;
}

// Scheduled keeps no list of its own — like Flexible's Up Next/Completed,
// the date groups and Unscheduled are derived from experiences +
// scheduledAt on every render. scheduledAt's keys are exactly which
// experiences are "scheduled"; there's no separate boolean to drift out
// of sync with it.
export function ScheduledPassportWorkspace({
  experiences,
  scheduledAt,
  onSchedule,
  completedIds,
  onToggle,
}: ScheduledPassportWorkspaceProps) {
  const unscheduled = experiences.filter((e) => !scheduledAt.has(e.id));

  const groups = new Map<string, Experience[]>();
  for (const experience of experiences) {
    const value = scheduledAt.get(experience.id);
    if (!value) continue;
    const dateKey = value.slice(0, 10);
    const group = groups.get(dateKey) ?? [];
    group.push(experience);
    groups.set(dateKey, group);
  }
  const sortedDateKeys = [...groups.keys()].sort();
  for (const group of groups.values()) {
    group.sort((a, b) =>
      scheduledAt.get(a.id)!.localeCompare(scheduledAt.get(b.id)!),
    );
  }

  return (
    <section
      aria-label="Journey"
      className="rounded-2xl border border-[#8a5a24]/20 bg-[#f7ecd3]/40 p-5"
    >
      <p className="mb-0.5 text-sm font-medium text-[#2b2015]/70">
        Your Adventure Plan
      </p>
      <p className="mb-4 text-xs text-[#2b2015]/50">
        Assign a date and time to schedule an experience.
      </p>

      <div className="flex flex-col gap-6">
        {sortedDateKeys.map((dateKey) => (
          <div key={dateKey}>
            <p className="mb-3 text-xs font-medium tracking-wide text-[#2b2015]/45 uppercase">
              {formatDateHeading(dateKey)}
            </p>
            <ul className="flex flex-col gap-3">
              {groups.get(dateKey)!.map((experience) => (
                <li key={experience.id}>
                  <ExperienceRow
                    experience={experience}
                    completed={completedIds.has(experience.id)}
                    onToggle={() => onToggle(experience.id)}
                    trailing={
                      <ScheduleControl
                        value={scheduledAt.get(experience.id) ?? ""}
                        onChange={(value) =>
                          onSchedule(experience.id, value || null)
                        }
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="mb-3 text-xs font-medium tracking-wide text-[#2b2015]/45 uppercase">
            Unscheduled {unscheduled.length > 0 && `(${unscheduled.length})`}
          </p>
          {unscheduled.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#8a5a24]/25 bg-[#f7ecd3]/30 px-4 py-6 text-center text-sm text-[#2b2015]/60">
              Everything has a date and time.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {unscheduled.map((experience) => (
                <li key={experience.id}>
                  <ExperienceRow
                    experience={experience}
                    completed={completedIds.has(experience.id)}
                    onToggle={() => onToggle(experience.id)}
                    trailing={
                      <ScheduleControl
                        value=""
                        onChange={(value) =>
                          onSchedule(experience.id, value || null)
                        }
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ScheduleControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Schedule date and time"
        className="rounded-md border border-[#8a5a24]/25 bg-white/70 px-2 py-1 text-xs text-[#2b2015] focus:ring-1 focus:ring-[#b5651d] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-[10px] font-medium text-[#8a5a24]/70 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function formatDateHeading(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
