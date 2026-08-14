"use client";

import { useEffect } from "react";
import { EXPERIENCES } from "./engine/experiences";
import { CampfireCard } from "./engine/CampfireCard";
import {
  WorldStageProvider,
  useStageReducedMotion,
} from "./engine/world/WorldStage";
import { FieldEnvironmentProvider } from "@/components/motion/world/FieldEnvironment";
import { AttentionFieldProvider } from "@/components/motion/world/AttentionField";
import { setSharedRafTimeScale } from "@/components/motion/primitives/useSharedRaf";

const campfire = EXPERIENCES.find((e) => e.identity.id === "campfire")!;

/**
 * Prompt 011's minimal playground: the smallest possible "small-cluster
 * mode" — two Campfire cards, sharing one `FieldEnvironment` (Weather) and
 * one `AttentionField` (Featured/Supporting), inside the same
 * `WorldStageProvider` Motion Lab's solo tabs already use. This is the
 * whole milestone's proof surface: does a hovered card become the
 * protagonist while its neighbor quiets and supports, without freezing or
 * competing (Prompt 010's 30-second moment)?
 *
 * Deliberately two instances of the *same* experience, not two different
 * ones — isolates the variable. Any difference in how the two cards
 * behave is attributable to Featured/Supporting state, not to different
 * content.
 */
function PairStageInner({
  windStrength,
  energyEnabled,
}: {
  windStrength: number;
  energyEnabled: boolean;
}) {
  const reducedMotion = useStageReducedMotion();

  return (
    <FieldEnvironmentProvider
      reducedMotion={reducedMotion}
      windStrengthMultiplier={windStrength}
      energyEnabled={energyEnabled}
    >
      <AttentionFieldProvider>
        <div className="flex items-center justify-center gap-16">
          <CampfireCard experience={campfire} instanceId="campfire-a" />
          <CampfireCard experience={campfire} instanceId="campfire-b" />
        </div>
      </AttentionFieldProvider>
    </FieldEnvironmentProvider>
  );
}

export function PairStage({
  windStrength,
  energyEnabled,
}: {
  windStrength: number;
  energyEnabled: boolean;
}) {
  // The shared rAF time-scale (pause/slow-motion) is page-wide by design
  // (Prompt 011's "pause" control is meant to freeze everything on stage
  // at once) — but it must not leak into Solo mode after leaving Pair
  // mode, so it's reset back to normal on unmount.
  useEffect(() => {
    return () => setSharedRafTimeScale(1);
  }, []);

  return (
    <WorldStageProvider className="flex min-h-dvh items-center justify-center">
      <PairStageInner
        windStrength={windStrength}
        energyEnabled={energyEnabled}
      />
    </WorldStageProvider>
  );
}
