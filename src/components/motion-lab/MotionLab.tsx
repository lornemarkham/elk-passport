"use client";

import { useEffect, useMemo, useState } from "react";
import { EXPERIENCES } from "./engine/experiences";
import { LivingCard } from "./engine/LivingCard";
import { CampfireCard } from "./engine/CampfireCard";
import { DebugPanel } from "./engine/DebugPanel";
import { WorldStageProvider } from "./engine/world/WorldStage";
import { mapPersonalityToParams } from "./engine/mapPersonalityToParams";
import type { Personality } from "./engine/types";
import { PairStage } from "./PairStage";
import { FieldDebugPanel } from "./FieldDebugPanel";
import { setSharedRafTimeScale } from "@/components/motion/primitives/useSharedRaf";

/**
 * Sprint 005/Phase 1 — MotionLab becomes a Stage, not just a switcher.
 * Still shows one experience at a time (the multi-object scene is Phase 2),
 * but that one object now lives inside the shared `WorldStageProvider` —
 * real persistent position, centralized pointer sensing, soft-home settling
 * — instead of managing its own drag-to-origin physics in isolation.
 * Switching tabs remounts LivingCard (a fresh performance); moving a debug
 * slider updates the running one in place.
 *
 * Prompt 011 — a Solo/Pair mode toggle. Solo is everything above,
 * unchanged. Pair swaps in `PairStage`: two Campfire cards sharing a
 * `FieldEnvironment` and `AttentionField`, Motion Lab's proof surface for
 * the Living World System (Prompt 010) before any of it touches Discovery
 * Space.
 */
export function MotionLab() {
  const [mode, setMode] = useState<"solo" | "pair">("solo");
  const [selectedId, setSelectedId] = useState(EXPERIENCES[0].identity.id);
  const [overrides, setOverrides] = useState<Record<string, Personality>>({});
  const [debugOpen, setDebugOpen] = useState(false);

  const [windStrength, setWindStrength] = useState(1);
  const [energyEnabled, setEnergyEnabled] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const [fieldDebugOpen, setFieldDebugOpen] = useState(false);

  useEffect(() => {
    setSharedRafTimeScale(timeScale);
  }, [timeScale]);

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
      {mode === "solo" ? (
        <WorldStageProvider className="flex min-h-dvh items-center justify-center">
          {selectedId === "campfire" ? (
            <CampfireCard key={selectedId} experience={liveExperience} />
          ) : (
            <LivingCard key={selectedId} experience={liveExperience} />
          )}
        </WorldStageProvider>
      ) : (
        <PairStage windStrength={windStrength} energyEnabled={energyEnabled} />
      )}

      <div className="absolute top-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3 px-4">
        <div className="flex gap-2 rounded-full border border-white/10 bg-black/40 p-1">
          {(["solo", "pair"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`rounded-full px-3 py-1 text-xs capitalize transition ${
                mode === option
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {mode === "solo" && (
          <div className="flex flex-wrap justify-center gap-2">
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
        )}
      </div>

      {mode === "solo" ? (
        <DebugPanel
          personality={personality}
          params={params}
          onChange={handlePersonalityChange}
          onReset={handleReset}
          open={debugOpen}
          onToggle={() => setDebugOpen((value) => !value)}
        />
      ) : (
        <FieldDebugPanel
          windStrength={windStrength}
          onWindStrengthChange={setWindStrength}
          energyEnabled={energyEnabled}
          onEnergyEnabledChange={setEnergyEnabled}
          timeScale={timeScale}
          onTimeScaleChange={setTimeScale}
          open={fieldDebugOpen}
          onToggle={() => setFieldDebugOpen((value) => !value)}
        />
      )}
    </div>
  );
}
