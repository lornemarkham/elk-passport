"use client";

/**
 * Prompt 011's playground, minimal slice: only the controls needed to run
 * the one validation question this milestone exists to answer — wind,
 * field mood, pause/slow-motion. Deliberately not the full playground
 * (presets, export, visualization overlays, FPS counter) — those don't
 * have anything to validate yet, and Prompt 011's own purpose was faster
 * feedback, not a bigger upfront build.
 */
export function FieldDebugPanel({
  windStrength,
  onWindStrengthChange,
  energyEnabled,
  onEnergyEnabledChange,
  timeScale,
  onTimeScaleChange,
  open,
  onToggle,
}: {
  windStrength: number;
  onWindStrengthChange: (value: number) => void;
  energyEnabled: boolean;
  onEnergyEnabledChange: (value: boolean) => void;
  timeScale: number;
  onTimeScaleChange: (value: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="fixed right-4 bottom-4 z-10 flex flex-col items-end gap-2">
      {open && (
        <div className="w-72 rounded-xl border border-white/10 bg-black/80 p-4 backdrop-blur-sm">
          <div className="mb-3 text-xs font-medium tracking-wide text-white/70 uppercase">
            Field
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-xs text-white/60">
                <span>Wind strength</span>
                <span className="text-white/40 tabular-nums">
                  {windStrength.toFixed(2)}×
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={windStrength}
                onChange={(event) =>
                  onWindStrengthChange(Number(event.target.value))
                }
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white/80"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-white/60">
              <span>Field energy (ambient mood)</span>
              <input
                type="checkbox"
                checked={energyEnabled}
                onChange={(event) =>
                  onEnergyEnabledChange(event.target.checked)
                }
                className="size-4 accent-white/80"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-xs text-white/60">
                <span>Time scale</span>
                <span className="text-white/40 tabular-nums">
                  {timeScale === 0 ? "paused" : `${timeScale.toFixed(2)}×`}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={timeScale}
                onChange={(event) =>
                  onTimeScaleChange(Number(event.target.value))
                }
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white/80"
              />
            </label>
            <button
              type="button"
              onClick={() => onTimeScaleChange(timeScale === 0 ? 1 : 0)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:text-white"
            >
              {timeScale === 0 ? "Resume" : "Pause"}
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm transition hover:text-white"
      >
        {open ? "Hide field debug" : "Field debug"}
      </button>
    </div>
  );
}
