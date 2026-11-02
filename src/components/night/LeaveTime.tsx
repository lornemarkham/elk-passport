"use client";

import { useMemo, useState } from "react";
import {
  Car,
  Check,
  Clock3,
  CloudSun,
  Info,
  Minus,
  Plus,
  Sparkles,
  Sun,
  TriangleAlert,
} from "lucide-react";
import type { NightDay } from "@/domain/date-night/adventures";
import type { DayForecast } from "@/domain/date-night/conditions";
import type { Evening } from "@/domain/date-night/adventures/evenings";
import {
  departure,
  type DepartureOption,
} from "@/domain/date-night/adventures/departure";
import { clock, type PlanStop } from "@/domain/date-night/adventures/itinerary";
import { cn } from "@/lib/utils";

/** "16:00" ⇄ 960. */
const toInput = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromInput = (v: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Half-hours either side of now's leave time, afternoon to evening. */
function chipsAround(was: number): number[] {
  const out = new Set<number>();
  for (let m = 13 * 60; m <= 19 * 60; m += 30) out.add(m);
  out.add(Math.round(was / 5) * 5);
  return [...out].sort((a, b) => a - b);
}

const SIGN = {
  "+": Plus,
  "-": Minus,
  "~": Clock3,
} as const;

/**
 * **When we leave.** Pick a time and Passport lays the day out again for
 * it: the daylight left for the outdoor part, the forecast if it has one,
 * and a few honest ways to spend it (`departure.ts`) — each saying what it
 * gives up and when you're home. The owner uses one; the other person
 * suggests it. Nothing changes until someone taps.
 */
export function LeaveTime({
  stops,
  evening,
  day,
  sunset,
  forecast,
  isOwner,
  busy,
  ownerName,
  onUse,
  onSuggest,
}: {
  stops: readonly PlanStop[];
  evening: Evening | undefined;
  day: NightDay;
  sunset: number;
  forecast?: DayForecast | undefined;
  isOwner: boolean;
  busy: boolean;
  ownerName: string | null;
  onUse: (option: DepartureOption, leaveAt: number) => Promise<boolean>;
  onSuggest: (said: string) => Promise<boolean>;
}) {
  const was = stops[0]!.at;
  const [leaveAt, setLeaveAt] = useState<number | null>(null);
  const plan = useMemo(
    () =>
      leaveAt === null || leaveAt === was
        ? null
        : departure({ stops, leaveAt, sunset, evening, day, forecast }),
    [leaveAt, was, stops, sunset, evening, day, forecast],
  );

  async function use(option: DepartureOption) {
    if (leaveAt === null) return;
    const ok = isOwner
      ? await onUse(option, leaveAt)
      : await onSuggest(
          `Can we leave at ${clock(leaveAt)}? ${option.title}, home about ${clock(option.home)}.`,
        );
    if (ok) setLeaveAt(null);
  }

  return (
    <section
      className="rounded-[28px] bg-[var(--n-paper)] p-5 ring-1 ring-black/5 sm:p-6"
      data-testid="leave-time"
      aria-labelledby="leave-heading"
    >
      <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-ember)] uppercase">
        Real life first
      </p>
      <h2
        id="leave-heading"
        className="ghad-display mt-1 text-[28px] leading-[0.95] font-extrabold tracking-tight uppercase"
      >
        When we leave
      </h2>
      <p className="mt-2 text-[14px] text-[var(--n-ink)]/70">
        The plan leaves at{" "}
        <strong className="text-[var(--n-ink)]" data-testid="leave-now">
          {clock(was)}
        </strong>
        . Can&apos;t go then? Pick when you can, and Passport works out what
        still fits before dark.
      </p>

      <div
        className="mt-4 flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Leave at"
      >
        {chipsAround(was).map((m) => {
          const on = (leaveAt ?? was) === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              data-testid={`leave-${toInput(m)}`}
              onClick={() => setLeaveAt(m)}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-4 text-[14px] font-bold tabular-nums ring-1 transition",
                on
                  ? "bg-[var(--n-forest)] text-[var(--n-cream)] ring-[var(--n-forest)]"
                  : "bg-white ring-black/10",
              )}
            >
              {clock(m)}
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex items-center gap-3 text-[14px] font-semibold text-[var(--n-ink)]/70">
        Another time
        <input
          type="time"
          step={300}
          value={toInput(leaveAt ?? was)}
          onChange={(e) => {
            const m = fromInput(e.target.value);
            if (m !== null) setLeaveAt(m);
          }}
          data-testid="leave-input"
          className="min-h-11 rounded-full border border-black/10 bg-white px-4 text-base tabular-nums"
        />
      </label>

      {plan && (
        <div className="mt-5 space-y-3" data-testid="leave-options">
          <p className="text-[15px] font-extrabold">
            Leaving at {clock(plan.leaveAt)} instead of {clock(plan.was)}
          </p>
          {plan.light && (
            <p className="flex gap-2 text-[14px] leading-snug text-[var(--n-ink)]/75">
              <Sun
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--n-amber)]"
                aria-hidden
              />
              <span data-testid="leave-light">{plan.light}</span>
            </p>
          )}
          <p className="flex gap-2 text-[14px] leading-snug text-[var(--n-ink)]/75">
            <CloudSun className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {plan.weather ??
                "No forecast was read for this page. Check it before you go."}
            </span>
          </p>
          <ol className="space-y-3">
            {/* Passport's pick first; the plan as it is, with its catch,
                last — always there, never the default. */}
            {[
              ...plan.options.filter((o) => o.recommended),
              ...plan.options.filter((o) => !o.recommended && o.id !== "keep"),
              ...plan.options.filter((o) => !o.recommended && o.id === "keep"),
            ].map((o) => (
              <li
                key={o.id}
                data-testid="leave-option"
                data-option={o.id}
                className={cn(
                  "rounded-[22px] bg-white p-4 ring-1",
                  o.recommended
                    ? "ring-2 ring-[var(--n-forest)]"
                    : o.warnings.length > 0
                      ? "ring-[var(--n-ember)]/40"
                      : "ring-black/10",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {o.recommended && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--n-forest)] px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-[var(--n-cream)] uppercase">
                      <Sparkles className="h-3 w-3" aria-hidden />{" "}
                      Passport&apos;s pick
                    </span>
                  )}
                  <span className="text-[12.5px] font-bold text-[var(--n-ink)]/55 tabular-nums">
                    Home about {clock(o.home)}
                  </span>
                </div>
                <p className="mt-1.5 text-[17px] leading-snug font-extrabold">
                  {o.title}
                </p>
                <p className="mt-0.5 text-[14px] text-[var(--n-ink)]/70">
                  {o.line}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--n-ink)]/80 tabular-nums">
                  {o.stops
                    .filter((s, i) => i > 0 && s.key !== "home")
                    .map((s) => `${clock(s.at)} ${s.title}`)
                    .join(" · ")}
                </p>
                {o.trades.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[13px] text-[var(--n-ink)]/70">
                    {o.trades.map((t) => {
                      const I = SIGN[t.sign];
                      return (
                        <li key={t.sign + t.text} className="flex gap-1.5">
                          <I
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            aria-hidden
                          />
                          <span>
                            <span className="sr-only">
                              {t.sign === "-"
                                ? "Drops"
                                : t.sign === "+"
                                  ? "Adds"
                                  : "Changes"}
                              :{" "}
                            </span>
                            {t.text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {o.warnings.map((w) => (
                  <p
                    key={w.line}
                    className="mt-2 flex gap-1.5 text-[13px] font-semibold text-[var(--n-ember)]"
                  >
                    <TriangleAlert
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden
                    />
                    {w.line}
                  </p>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void use(o)}
                  data-testid="leave-use"
                  className={cn(
                    "mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[14px] font-bold disabled:opacity-60",
                    o.recommended
                      ? "bg-[var(--n-forest)] text-white"
                      : "ring-1 ring-black/15",
                  )}
                >
                  {isOwner ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden />
                      {o.warnings.length > 0 ? "Keep it anyway" : "Use this"}
                    </>
                  ) : (
                    <>
                      <Car className="h-4 w-4" aria-hidden />
                      Suggest it to {ownerName ?? "the planner"}
                    </>
                  )}
                </button>
              </li>
            ))}
          </ol>
          <ul className="space-y-1 text-[12.5px] text-[var(--n-ink)]/55">
            {plan.honest.map((line) => (
              <li key={line} className="flex gap-1.5">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
