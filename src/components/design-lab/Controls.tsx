"use client";

import { ACCENT } from "@/components/design-lab/brand";

/**
 * **The discovery controls, shared by the two directions that have them.**
 *
 * Four questions, each one row, each optional, each answerable in a tap. Not a
 * filter dashboard: no apply button, no counts-in-brackets, no disclosure
 * triangles. And not a chatbot: no text box, because Passport cannot honour a
 * free-text request and a box that looks like it can is a lie with a cursor
 * in it.
 *
 * The honesty rule each control follows is stated beside it on the page, not
 * buried here: a control that cannot narrow anything says so rather than
 * quietly doing nothing.
 */
export interface Choice {
  readonly value: string;
  readonly label: string;
  readonly count?: number;
  /** Why this cannot be chosen yet, where it cannot. */
  readonly blocked?: string;
}

export function ControlRow({
  label,
  choices,
  value,
  onChange,
  after,
}: {
  readonly label: string;
  readonly choices: readonly Choice[];
  readonly value?: string;
  readonly onChange: (next: string | undefined) => void;
  readonly after?: React.ReactNode;
}) {
  return (
    <div className="border-t border-black/10 py-3.5 sm:py-4">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-black/35 uppercase">
        {label}
      </p>
      <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
        {choices.map((choice) => {
          const on = value === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              data-testid="control-choice"
              aria-pressed={on}
              disabled={Boolean(choice.blocked)}
              title={choice.blocked}
              onClick={() => onChange(on ? undefined : choice.value)}
              style={on ? { backgroundColor: ACCENT } : undefined}
              className={
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-colors sm:text-[15px] " +
                (choice.blocked
                  ? "cursor-not-allowed text-black/25 ring-1 ring-black/10 ring-inset"
                  : on
                    ? "text-white"
                    : "text-black/70 ring-1 ring-black/15 ring-inset hover:ring-black/40")
              }
            >
              <span className="first-letter:uppercase">{choice.label}</span>
              {choice.count !== undefined && (
                <span
                  className={
                    "text-[0.78em] tabular-nums " +
                    (on ? "text-white/70" : "text-black/35")
                  }
                >
                  {choice.count}
                </span>
              )}
            </button>
          );
        })}
        {after}
      </div>
    </div>
  );
}
