"use client";

import { TOWN_GROUPS } from "@/domain/discovery/towns";

/**
 * **"From where?", answered where it is asked.**
 *
 * An answer that needs somewhere to measure from used to say so and point at
 * the distance row, which on a phone sits a screen below and scrolls sideways.
 * This is the same two honest routes — a town, or the reader's own position —
 * offered inside the sentence that asks. It holds no state: the page owns the
 * town and the position.
 */
export function OriginPicker({
  townId,
  onTown,
  onLocate,
  locateLabel,
}: {
  readonly townId: string | undefined;
  readonly onTown: (next: string | undefined) => void;
  /** Absent once a position is shared, or when the browser cannot offer one. */
  readonly onLocate?: () => void;
  readonly locateLabel?: string;
}) {
  return (
    <div
      data-testid="ask-origin"
      className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      <select
        data-testid="ask-town"
        aria-label="Measure distances from"
        value={townId ?? ""}
        onChange={(event) => onTown(event.target.value || undefined)}
        className="min-h-11 min-w-0 rounded-full bg-white px-3 text-[14px] font-semibold text-[#111] ring-1 ring-black/15 ring-inset focus:ring-black/45"
      >
        <option value="">pick a town</option>
        {TOWN_GROUPS.map((group) => (
          <optgroup key={group.area} label={group.area}>
            {group.towns.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {onLocate && (
        <button
          type="button"
          data-testid="ask-locate"
          onClick={onLocate}
          style={{ color: "var(--ghad-accent)" }}
          className="inline-flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-4"
        >
          {locateLabel ?? "or share where you are"}
        </button>
      )}
    </div>
  );
}
