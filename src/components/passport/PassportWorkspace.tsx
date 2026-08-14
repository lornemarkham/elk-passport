"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import {
  ExecutionStyleSelector,
  type ExecutionStyle,
} from "./ExecutionStyleSelector";
import { FlexiblePassportWorkspace } from "./FlexiblePassportWorkspace";
import { OrderedPassportWorkspace } from "./OrderedPassportWorkspace";
import { ScheduledPassportWorkspace } from "./ScheduledPassportWorkspace";
import { PassportSidebar } from "./PassportSidebar";
import type { Experience } from "@/domain/experience/types";

interface PassportWorkspaceProps {
  experiences: Experience[];
}

/** Owns everything Flexible, Ordered, and Scheduled share: which style is
 * selected, which experiences are completed, (Ordered-only) the order
 * the user arranged them in, and (Scheduled-only) each one's assigned
 * date/time. completedIds lives here rather than inside any one mode's
 * workspace so switching styles doesn't lose progress — it's the same
 * board either way, just a different view of it. */
export function PassportWorkspace({ experiences }: PassportWorkspaceProps) {
  const [executionStyle, setExecutionStyle] =
    useState<ExecutionStyle>("flexible");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    experiences.map((experience) => experience.id),
  );
  const [scheduledAt, setScheduledAt] = useState<Map<string, string>>(
    new Map(),
  );

  function toggle(id: string) {
    setCompletedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function moveOrderedItem(id: string, direction: "up" | "down") {
    setOrderedIds((current) => {
      const index = current.indexOf(id);
      const swapWith = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || swapWith < 0 || swapWith >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  }

  function setSchedule(id: string, value: string | null) {
    setScheduledAt((current) => {
      const next = new Map(current);
      if (value) {
        next.set(id, value);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  return (
    <>
      <ExecutionStyleSelector
        selected={executionStyle}
        onSelect={setExecutionStyle}
      />

      <div className="mt-8">
        {experiences.length === 0 ? (
          <EmptyBoardPanel />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            {executionStyle === "flexible" && (
              <FlexiblePassportWorkspace
                experiences={experiences}
                completedIds={completedIds}
                onToggle={toggle}
              />
            )}
            {executionStyle === "ordered" && (
              <OrderedPassportWorkspace
                experiences={experiences}
                orderedIds={orderedIds}
                completedIds={completedIds}
                onToggle={toggle}
                onMove={moveOrderedItem}
              />
            )}
            {executionStyle === "scheduled" && (
              <ScheduledPassportWorkspace
                experiences={experiences}
                scheduledAt={scheduledAt}
                onSchedule={setSchedule}
                completedIds={completedIds}
                onToggle={toggle}
              />
            )}

            <PassportSidebar
              completed={completedIds.size}
              total={experiences.length}
            />
          </div>
        )}
      </div>
    </>
  );
}

function EmptyBoardPanel() {
  return (
    <section
      aria-label="Journey"
      className="relative flex min-h-[320px] flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-dashed border-[#8a5a24]/30 bg-[#f7ecd3]/50 px-8 py-20 text-center"
    >
      <Compass className="h-8 w-8 text-[#8a5a24]" />
      <p className="font-heading max-w-md text-2xl text-[#2b2015]">
        Nothing saved to this board yet.
      </p>
      <p className="max-w-sm text-sm text-[#2b2015]/60">
        Head back to Discovery and save a few experiences — they&apos;ll show up
        here.
      </p>
    </section>
  );
}
