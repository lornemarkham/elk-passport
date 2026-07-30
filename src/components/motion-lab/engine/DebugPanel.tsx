"use client";

import { TRAIT_KEYS, type Personality } from "./types";
import type { MotionParams } from "./mapPersonalityToParams";

/** Derived physical values worth watching while tuning — Sprint 004. Read-only: these are outputs of the trait sliders, not independent inputs (see the sprint report for why). */
const DERIVED_KEYS: {
  key: keyof MotionParams;
  label: string;
  digits?: number;
}[] = [
  { key: "dragMass", label: "Mass", digits: 2 },
  { key: "dragStiffness", label: "Drag stiffness" },
  { key: "dragDamping", label: "Drag damping" },
  { key: "dragElastic", label: "Elasticity", digits: 2 },
  { key: "tiltMaxDeg", label: "Tilt max (°)" },
  { key: "skewSensitivity", label: "Skew sensitivity", digits: 2 },
  { key: "squashAmount", label: "Squash amount", digits: 3 },
  { key: "detachThresholdPxPerS", label: "Detach threshold (px/s)" },
  { key: "trailEmissionRate", label: "Trail emission rate", digits: 2 },
  { key: "trailWorldSpreadPx", label: "World-space spread (px)" },
  { key: "awarenessRadiusPx", label: "Attention radius (px)" },
  { key: "leanDistancePx", label: "Curiosity lean (px)" },
];

export function DebugPanel({
  personality,
  params,
  onChange,
  onReset,
  open,
  onToggle,
}: {
  personality: Personality;
  params: MotionParams;
  onChange: (next: Personality) => void;
  onReset: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="fixed right-4 bottom-4 z-10 flex flex-col items-end gap-2">
      {open && (
        <div className="max-h-[80vh] w-72 overflow-y-auto rounded-xl border border-white/10 bg-black/80 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium tracking-wide text-white/70 uppercase">
              Personality
            </span>
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-white/50 underline transition hover:text-white/80"
            >
              Reset
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {TRAIT_KEYS.map((key) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="flex items-center justify-between text-xs text-white/60">
                  <span className="capitalize">{key}</span>
                  <span className="text-white/40 tabular-nums">
                    {personality[key]}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={personality[key]}
                  onChange={(event) =>
                    onChange({
                      ...personality,
                      [key]: Number(event.target.value),
                    })
                  }
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white/80"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 mb-2 border-t border-white/10 pt-3">
            <span className="text-xs font-medium tracking-wide text-white/70 uppercase">
              Derived physics (read-only)
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {DERIVED_KEYS.map(({ key, label, digits }) => (
              <div
                key={key}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-white/50">{label}</span>
                <span className="text-white/70 tabular-nums">
                  {(params[key] as number).toFixed(digits ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm transition hover:text-white"
      >
        {open ? "Hide debug" : "Debug"}
      </button>
    </div>
  );
}
