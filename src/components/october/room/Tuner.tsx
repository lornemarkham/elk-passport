"use client";

import {
  clamp,
  DIAL_MAX,
  DIAL_MIN,
  garble,
  type Reception,
  type Station,
} from "@/domain/october/room";

/**
 * **The radio, as a thing you hold.** A real range input, so it is a drag on a
 * phone, arrow keys on a keyboard and a slider to a screen reader — and the
 * station's words are on screen, so the room is solvable with the sound off.
 *
 * It lists what it has heard, in order, because a puzzle that needs three
 * sentences remembered across a drag is a memory test, and nobody came here
 * for one.
 */
export function Tuner({
  frequency,
  onChange,
  reception,
  heard,
  onClose,
}: {
  readonly frequency: number;
  readonly onChange: (next: number) => void;
  readonly reception: Reception;
  readonly heard: readonly Station[];
  readonly onClose: () => void;
}) {
  const line = reception.station
    ? garble(reception.station.text, reception.clarity)
    : "· · ·";

  return (
    <section
      aria-label="Radio"
      data-testid="radio-panel"
      className="w-full max-w-sm"
    >
      <div className="flex items-baseline justify-between text-[#e9e6da]/60">
        <span
          data-testid="radio-frequency"
          className="font-mono text-2xl text-[#ffcf8a] tabular-nums"
        >
          {frequency.toFixed(1)}
          <span className="ml-1 text-xs text-[#e9e6da]/40">FM</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-2 text-xs tracking-wide text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/80 hover:underline"
        >
          put it down
        </button>
      </div>

      <input
        type="range"
        aria-label="Tuning"
        data-testid="radio-dial"
        min={DIAL_MIN}
        max={DIAL_MAX}
        step={0.1}
        value={frequency}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="room-dial my-2 block h-11 w-full cursor-pointer"
      />

      <p
        data-testid="radio-line"
        aria-live="polite"
        className="font-heading min-h-[3.2rem] text-lg leading-snug text-balance text-[#f3efe4]"
        style={{ opacity: 0.35 + reception.clarity * 0.65 }}
      >
        {line}
      </p>

      {heard.length > 0 ? (
        <ol
          data-testid="heard"
          aria-label="What you have heard"
          className="mt-2 space-y-0.5 border-t border-[#e9e6da]/10 pt-2 text-xs text-[#e9e6da]/50"
        >
          {heard.map((s) => (
            <li key={s.id} data-station={s.id}>
              {s.text}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
