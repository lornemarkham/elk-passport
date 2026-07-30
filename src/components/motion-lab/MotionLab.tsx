"use client";

import { useMemo, useRef, useState } from "react";
import { EXPERIENCES } from "./engine/experiences";
import { LivingCard } from "./engine/LivingCard";
import { DebugPanel } from "./engine/DebugPanel";
import type { Personality } from "./engine/types";

/**
 * Sprint 003 — Personality Engine. Five completely different characters,
 * one shared engine underneath. Switching tabs remounts LivingCard (a fresh
 * performance, not a live morph between personalities); moving a debug
 * slider updates the running one in place.
 */
export function MotionLab() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(EXPERIENCES[0].identity.id);
  const [overrides, setOverrides] = useState<Record<string, Personality>>({});
  const [debugOpen, setDebugOpen] = useState(false);

  const selected = useMemo(
    () => EXPERIENCES.find((e) => e.identity.id === selectedId)!,
    [selectedId],
  );
  const personality = overrides[selectedId] ?? selected.personality;
  const liveExperience = useMemo(
    () => ({ ...selected, personality }),
    [selected, personality],
  );

  const handlePersonalityChange = (next: Personality) => {
    setOverrides((prev) => ({ ...prev, [selectedId]: next }));
  };

  const handleReset = () => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  };

  return (
    <div
      ref={stageRef}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(60%_60%_at_50%_40%,#17140f_0%,#08070a_100%)]"
    >
      <div className="absolute top-6 left-1/2 z-10 flex -translate-x-1/2 flex-wrap justify-center gap-2 px-4">
        {EXPERIENCES.map((exp) => (
          <button
            key={exp.identity.id}
            type="button"
            onClick={() => setSelectedId(exp.identity.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              exp.identity.id === selectedId
                ? "border-white/40 bg-white/10 text-white"
                : "border-white/10 text-white/50 hover:text-white/80"
            }`}
          >
            {exp.identity.emoji} {exp.identity.title}
          </button>
        ))}
      </div>

      <LivingCard
        key={selectedId}
        experience={liveExperience}
        dragConstraintsRef={stageRef}
      />

      <DebugPanel
        personality={personality}
        onChange={handlePersonalityChange}
        onReset={handleReset}
        open={debugOpen}
        onToggle={() => setDebugOpen((value) => !value)}
      />
    </div>
  );
}
