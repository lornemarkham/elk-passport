"use client";

import { MapPin } from "lucide-react";

/**
 * **"What do you feel like doing?" — five questions, every one of them real.**
 *
 * Replaces the hero and the row of ontology chips. The rule it is built to is
 * the brief's: *all controls must either work or clearly indicate that a
 * capability is unavailable.* So each row either narrows real Atlas evidence,
 * or is visibly unavailable with the reason beside it. There is no control
 * here that looks like it filters and does not.
 *
 * Not a filter dashboard: no apply button, no result count in brackets, no
 * drawer, no reset. Five rows of pills, every one optional. On a phone each
 * row scrolls **sideways** instead of wrapping, so the whole thing stays a
 * few thumb-heights and the photographs start near the fold.
 */
export interface Choice {
  readonly value: string;
  readonly label: string;
  readonly count?: number;
  /** Why this cannot be chosen yet. Rendered as a title and a dimmed pill. */
  readonly blocked?: string;
}

export function FeelLikeDoing({
  rows,
  today,
  where,
  after,
}: {
  /**
   * The calendar day, already written out — `Saturday, October 10`.
   *
   * Resolved on the server and handed down. A client that reads its own clock
   * during render hydrates into a mismatch, and a client that reads it in an
   * effect prints the wrong day for a frame; the day somebody is planning is
   * not a thing to get wrong for a frame.
   */
  readonly today?: string;
  /** Where Passport is looking, or absent when it is looking everywhere. */
  readonly where?: string;
  readonly rows: readonly {
    readonly key: string;
    readonly label: string;
    readonly choices: readonly Choice[];
    readonly value?: string;
    readonly onChange: (next: string | undefined) => void;
    /** Said under the row when a control cannot do what it looks like it does. */
    readonly note?: string;
    readonly after?: React.ReactNode;
  }[];
  readonly after?: React.ReactNode;
}) {
  return (
    <section data-testid="feel-like-doing">
      {/* The wordmark and the theme picker live on the bar above, which every
          screen has — a brand that moves from page to page is not a brand, and
          a colour choice shown on Discovery looks like a property of
          Discovery. See `PassportNav`. */}
      <h1 className="ghad-display max-w-[16ch] text-[34px] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-[#111] sm:text-[64px]">
        What do you feel like doing?
      </h1>

      {/* **Two facts, not a tagline.** The date and the area are the only
          things this page can state before anybody has told it anything, and
          both come from the server — the clock and `activeScope()`. Neither is
          invented when it is missing. */}
      {(today || where) && (
        <p
          data-testid="discovery-context"
          className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold tracking-[0.12em] uppercase"
          style={{ color: "var(--ghad-accent)" }}
        >
          {today && <span className="tabular-nums">{today}</span>}
          {today && where && (
            <span aria-hidden className="opacity-40">
              ·
            </span>
          )}
          {where && (
            <span
              data-testid="active-scope"
              className="inline-flex items-center gap-1"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {where}
            </span>
          )}
        </p>
      )}

      <div className="mt-5 sm:mt-8">
        {rows.map((row) => (
          <div
            key={row.key}
            className="border-t border-black/10 py-3 sm:py-3.5"
          >
            <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
              {row.label}
            </p>
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
              {row.choices.map((choice) => {
                const on = row.value === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    data-testid="ghad-choice"
                    data-row={row.key}
                    aria-pressed={on}
                    disabled={Boolean(choice.blocked)}
                    title={choice.blocked}
                    onClick={() => row.onChange(on ? undefined : choice.value)}
                    style={
                      on
                        ? {
                            backgroundColor: "var(--ghad-accent)",
                            color: "var(--ghad-accent-ink)",
                          }
                        : undefined
                    }
                    className={
                      "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-colors sm:text-[15px] " +
                      (choice.blocked
                        ? "cursor-not-allowed text-black/25 ring-1 ring-black/10 ring-inset"
                        : on
                          ? ""
                          : "text-black/70 ring-1 ring-black/15 ring-inset hover:ring-black/45")
                    }
                  >
                    <span className="first-letter:uppercase">
                      {choice.label}
                    </span>
                    {choice.count !== undefined && (
                      <span
                        className={
                          "text-[0.78em] tabular-nums " +
                          (on ? "opacity-70" : "text-black/35")
                        }
                      >
                        {choice.count}
                      </span>
                    )}
                  </button>
                );
              })}
              {row.after}
            </div>
            {row.note && (
              <p
                data-testid="ghad-note"
                className="mt-1.5 max-w-[74ch] text-[12.5px] leading-relaxed text-black/40"
              >
                {row.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {after}
    </section>
  );
}
