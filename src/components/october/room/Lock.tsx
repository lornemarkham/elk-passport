"use client";

import type { Wheels } from "@/domain/october/room";

/**
 * **Three wheels.** Each is a column of two big buttons around a digit, since
 * a phone cannot be asked to hit a ten-pixel arrow, and each tells a keyboard
 * and a screen reader exactly what it is.
 *
 * `caught` is October's help: once it decides you have earned it, the wheels
 * that are right are marked — and only those.
 */
export function Lock({
  wheels,
  caught,
  shaking,
  onSpin,
  onTry,
  onClose,
}: {
  readonly wheels: Wheels;
  readonly caught: readonly [boolean, boolean, boolean] | null;
  readonly shaking: boolean;
  readonly onSpin: (wheel: 0 | 1 | 2, by: 1 | -1) => void;
  readonly onTry: () => void;
  readonly onClose: () => void;
}) {
  return (
    <section
      aria-label="Door lock"
      data-testid="lock-panel"
      className={`w-full max-w-sm ${shaking ? "room-shake" : ""}`}
    >
      <div className="flex items-center justify-center gap-3">
        {([0, 1, 2] as const).map((i) => (
          <div
            key={i}
            className={`flex flex-col items-center rounded-md border px-1 transition-colors ${
              caught?.[i]
                ? "border-[#ffcf8a]/70 bg-[#ffcf8a]/10"
                : "border-[#e9e6da]/15 bg-[#e9e6da]/[0.03]"
            }`}
          >
            <button
              type="button"
              aria-label={`Wheel ${i + 1} up`}
              data-testid={`wheel-${i}-up`}
              onClick={() => onSpin(i, 1)}
              className="flex h-11 w-14 items-center justify-center text-[#e9e6da]/60 active:text-[#ffcf8a]"
            >
              ▲
            </button>
            <output
              aria-label={`Wheel ${i + 1}`}
              data-testid={`wheel-${i}`}
              className="font-mono text-4xl text-[#f3efe4] tabular-nums"
            >
              {wheels[i]}
            </output>
            <button
              type="button"
              aria-label={`Wheel ${i + 1} down`}
              data-testid={`wheel-${i}-down`}
              onClick={() => onSpin(i, -1)}
              className="flex h-11 w-14 items-center justify-center text-[#e9e6da]/60 active:text-[#ffcf8a]"
            >
              ▼
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-6">
        <button
          type="button"
          data-testid="lock-try"
          onClick={onTry}
          className="min-h-11 rounded-full border border-[#ffcf8a]/50 px-7 text-sm tracking-wide text-[#ffcf8a] transition-colors hover:bg-[#ffcf8a]/10"
        >
          try it
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-2 text-xs tracking-wide text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/80 hover:underline"
        >
          step back
        </button>
      </div>
    </section>
  );
}
