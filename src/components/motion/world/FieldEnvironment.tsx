"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMotionValue, type MotionValue } from "framer-motion";
import { NoiseField, nextNoiseSeed } from "../primitives/noise";
import { useSharedRaf } from "../primitives/useSharedRaf";

export interface FieldEnvironmentValue {
  /** Radians. */
  windAngle: MotionValue<number>;
  /** Same units as a phenomenon's own local flow speed. */
  windStrength: MotionValue<number>;
  /** 0–1, a slow field-wide mood — see Prompt 010 §6/§8. */
  fieldEnergy: MotionValue<number>;
}

const FieldEnvironmentContext = createContext<FieldEnvironmentValue | null>(
  null,
);

/**
 * The Weather half of the Living World System (Prompt 010) — one shared
 * broadcast, sampled once from one `NoiseField`, that every card inside it
 * reads independently. No card knows any other card exists; they all just
 * feel the same wind and the same slow mood. `null` outside a provider
 * (via `useFieldEnvironment`) is a real, supported state, not an error —
 * every phenomenon that reads it must keep working with no field present
 * at all (Motion Lab's existing single-card tabs never wrap one).
 */
export function FieldEnvironmentProvider({
  children,
  reducedMotion,
  windStrengthMultiplier = 1,
  energyEnabled = true,
}: {
  children: ReactNode;
  reducedMotion: boolean;
  /** Playground control (Prompt 011) — 0 disables wind entirely. */
  windStrengthMultiplier?: number;
  /** Playground control — off holds `fieldEnergy` at 0. */
  energyEnabled?: boolean;
}) {
  const [noise] = useState(() => new NoiseField(nextNoiseSeed()));
  const windAngle = useMotionValue(0);
  const windStrength = useMotionValue(0);
  const fieldEnergy = useMotionValue(0);

  useSharedRaf((_deltaSeconds, elapsedSeconds) => {
    windAngle.set(noise.get3D(0, 0, elapsedSeconds * 0.05) * Math.PI * 2);
    windStrength.set(
      windStrengthMultiplier *
        (8 + noise.get01(50, 0, elapsedSeconds * 0.05) * 22),
    );
    fieldEnergy.set(
      energyEnabled
        ? 0.3 + noise.get01(100, 0, elapsedSeconds * 0.02) * 0.7
        : 0,
    );
  }, !reducedMotion);

  const value = useMemo(
    () => ({ windAngle, windStrength, fieldEnergy }),
    [windAngle, windStrength, fieldEnergy],
  );

  return (
    <FieldEnvironmentContext.Provider value={value}>
      {children}
    </FieldEnvironmentContext.Provider>
  );
}

/** `null` when not inside a `FieldEnvironmentProvider` — callers must treat
 * that as "no shared weather," not throw. See module doc above. */
export function useFieldEnvironment(): FieldEnvironmentValue | null {
  return useContext(FieldEnvironmentContext);
}
