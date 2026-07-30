"use client";

import { useMemo, useState } from "react";
import { EXPERIENCES } from "./engine/experiences";
import { LivingCard } from "./engine/LivingCard";
import { DebugPanel } from "./engine/DebugPanel";
import { WorldStageProvider } from "./engine/world/WorldStage";
import { mapPersonalityToParams } from "./engine/mapPersonalityToParams";
import type { Personality } from "./engine/types";

/**
 * Sprint 005/Phase 1 — MotionLab becomes a Stage, not just a switcher.
 * Still shows one experience at a time (the multi-object scene is Phase 2),
 * but that one object now lives inside the shared `WorldStageProvider` —
 * real persistent position, centralized pointer sensing, soft-home settling
 * — instead of managing its own drag-to-origin physics in isolation.
 * Switching tabs remounts LivingCard (a fresh performance); moving a debug
 * slider updates the running one in place.
 */
export function MotionLab() {
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
  const params = useMemo(
    () => mapPersonalityToParams(personality, selected.identity.physics),
    [personality, selected.identity.physics],
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
    <div className="relative min-h-dvh overflow-hidden bg-[radial-gradient(60%_60%_at_50%_40%,#17140f_0%,#08070a_100%)]">
      <WorldStageProvider className="flex min-h-dvh items-center justify-center">
        <LivingCard key={selectedId} experience={liveExperience} />
      </WorldStageProvider>

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

      <DebugPanel
        personality={personality}
        params={params}
        onChange={handlePersonalityChange}
        onReset={handleReset}
        open={debugOpen}
        onToggle={() => setDebugOpen((value) => !value)}
      />
    </div>
  );
}
