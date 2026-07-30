"use client";

import { useRef } from "react";
import { campfire } from "./campfire";
import { LivingExperience } from "./LivingExperience";

/**
 * Prompt 001 — First Heartbeat. One question only: can a single Passport
 * experience feel alive? No navigation, no Discovery UI — just Campfire,
 * centered.
 */
export function MotionLab() {
  const stageRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={stageRef}
      className="flex min-h-dvh items-center justify-center bg-[radial-gradient(60%_60%_at_50%_40%,#171210_0%,#08070a_100%)]"
    >
      <LivingExperience experience={campfire} dragConstraintsRef={stageRef} />
    </div>
  );
}
