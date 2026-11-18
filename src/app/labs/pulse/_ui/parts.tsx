"use client";

import type { Breakdown, Share } from "@/lib/pulse/results";
import { answerColor } from "./brand";

export const n = (x: number) => x.toLocaleString("en-CA");

/** One answer per row: label and percentage in ink, the bar in its colour. */
export function Bars({
  shares,
  mine,
}: {
  shares: readonly Share[];
  mine: string | null;
}) {
  return (
    <ul className="grid gap-3.5" data-testid="pulse-bars">
      {shares.map((s, i) => (
        <li key={s.optionId} data-testid={`pulse-bar-${s.optionId}`}>
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="flex items-center gap-2 font-semibold">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: answerColor(i) }}
              />
              {s.label}
              {mine === s.optionId ? (
                <span className="rounded-full bg-[#14161a] px-2 py-0.5 text-[11px] font-semibold text-white">
                  Your answer
                </span>
              ) : null}
            </span>
            <span className="tabular-nums">
              <span className="text-[20px] font-bold" data-testid="pulse-pct">
                {s.pct}%
              </span>{" "}
              <span className="text-[13px] text-[#5c6370]">{n(s.n)}</span>
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-[#efece5]">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${s.pct}%`, background: answerColor(i) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A 100% stacked row: one group's answers side by side, gaps between fills. */
export function StackRow({
  name,
  b,
  testId,
}: {
  name: string;
  b: Breakdown & { shares: readonly Share[] };
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <div className="flex items-baseline justify-between text-[14px]">
        <span className="font-semibold">{name}</span>
        <span className="text-[12.5px] text-[#5c6370]">
          {b.counted === b.total
            ? `${n(b.total)} votes`
            : `first ${n(b.counted)} of ${n(b.total)} votes`}
        </span>
      </div>
      <div className="mt-1.5 flex h-8 gap-[2px] overflow-hidden rounded-lg">
        {b.shares.map((s, i) =>
          s.pct > 0 ? (
            <div
              key={s.optionId}
              title={`${s.label}: ${s.pct}%`}
              className="flex items-center justify-center text-[12px] font-bold text-white"
              style={{ width: `${s.pct}%`, background: answerColor(i) }}
            >
              {s.pct >= 12 ? `${s.pct}%` : ""}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function Legend({ shares }: { shares: readonly Share[] }) {
  return (
    <ul
      className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#3f4550]"
      aria-label="Legend"
    >
      {shares.map((s, i) => (
        <li key={s.optionId} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: answerColor(i) }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
