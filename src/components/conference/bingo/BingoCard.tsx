"use client";

import { useSyncExternalStore } from "react";
import { cardFor, linesDone, SQUARES } from "@/domain/conference/bingo";

const KEY = (c: string) => `conference-bingo:${c}`;
const EVENT = "conference-bingo-change";
const subscribe = (f: () => void) => {
  window.addEventListener(EVENT, f);
  window.addEventListener("storage", f);
  return () => {
    window.removeEventListener(EVENT, f);
    window.removeEventListener("storage", f);
  };
};
const read = (c: string) => {
  try {
    return localStorage.getItem(KEY(c)) ?? "";
  } catch {
    return "";
  }
};

const CHEERS = [
  "",
  "A line! You're officially a networker.",
  "Two lines. People are starting to talk (to you).",
  "Three lines. Somebody give this person a lanyard.",
];

/**
 * The card itself: nine squares on this phone, marked by the person, kept
 * in this browser. No names, no scores sent anywhere, no leaderboard.
 */
export function BingoCard({
  conferenceId,
  seed,
}: {
  conferenceId: string;
  seed: string;
}) {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(conferenceId),
    () => "",
  );
  const marked = new Set(
    raw
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((n) => n >= 0 && n < 9),
  );
  const card = cardFor(seed);
  const toggle = (pos: number) => {
    const next = new Set(marked);
    if (next.has(pos)) next.delete(pos);
    else next.add(pos);
    try {
      localStorage.setItem(KEY(conferenceId), [...next].join(","));
    } catch {
      // Private mode: the card resets on reload.
    }
    window.dispatchEvent(new Event(EVENT));
  };
  const lines = linesDone(marked);
  const full = marked.size === 9;
  return (
    <div data-testid="bingo">
      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        {card.map((sq, pos) => {
          const on = marked.has(pos);
          return (
            <li key={sq}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(pos)}
                className={`flex aspect-square w-full flex-col items-center justify-center rounded-2xl border p-2 text-center text-[12px] leading-snug font-semibold transition active:scale-[0.97] sm:p-3 sm:text-[14px] ${
                  on
                    ? "border-cf-sage bg-cf-sage text-white shadow-[0_10px_24px_-14px_rgba(63,125,92,0.8)]"
                    : "border-cf-line text-cf-ink hover:border-cf-ink/30 bg-white"
                }`}
                data-testid="bingo-square"
              >
                {on ? (
                  <span aria-hidden="true" className="mb-1 text-[18px]">
                    ✓
                  </span>
                ) : null}
                {SQUARES[sq]}
              </button>
            </li>
          );
        })}
      </ol>
      <p
        className="cf-serif text-cf-ink mt-5 min-h-[28px] text-[19px]"
        role="status"
        data-testid="bingo-status"
      >
        {full
          ? "Full card. You met the room. 🎉"
          : lines
            ? CHEERS[Math.min(lines, 3)]
            : `${marked.size} of 9 · your mission: meet someone new.`}
      </p>
    </div>
  );
}
