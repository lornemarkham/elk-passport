"use client";

import { TRAIT_KEYS, type Personality } from "./types";

export function DebugPanel({
  personality,
  onChange,
  onReset,
  open,
  onToggle,
}: {
  personality: Personality;
  onChange: (next: Personality) => void;
  onReset: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="fixed right-4 bottom-4 z-10 flex flex-col items-end gap-2">
      {open && (
        <div className="w-72 rounded-xl border border-white/10 bg-black/80 p-4 backdrop-blur-sm">
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
