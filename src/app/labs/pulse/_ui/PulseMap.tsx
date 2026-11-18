"use client";

import { useState } from "react";
import type { Breakdown, Results as R } from "@/lib/pulse/results";
import { answerColor } from "./brand";
import { Legend, StackRow, n } from "./parts";

/**
 * Canada as equal tiles, roughly where each province sits. Equal tiles on
 * purpose: on a true map Nunavut is a hundred times PEI, so the eye would
 * weigh places by area instead of by how many people answered.
 */
const TILES: Record<string, [col: number, row: number]> = {
  YT: [0, 0],
  NT: [1, 0],
  NU: [2, 0],
  NL: [6, 0],
  BC: [0, 1],
  AB: [1, 1],
  SK: [2, 1],
  MB: [3, 1],
  ON: [4, 1],
  QC: [5, 1],
  NB: [6, 1],
  PE: [5, 2],
  NS: [6, 2],
};
const MAX_PICKED = 3;

/** An answer's colour, stronger the bigger its share. */
const tint = (index: number, pct: number) =>
  `color-mix(in srgb, ${answerColor(index)} ${Math.round(14 + pct * 0.86)}%, white)`;

/**
 * **Where people answered what.** Pick an answer to colour the map by its
 * share; tap up to three provinces to set them beside everyone. A province
 * with fewer than five votes stays grey and says nothing else — not even how
 * many — and every place is what people said about themselves.
 */
export function PulseMap({ results }: { results: R }) {
  const { map } = results.insights;
  const shown = map.filter((m) => m.state === "shown");
  const [answer, setAnswer] = useState(0);
  const [picked, setPicked] = useState<string[]>(() =>
    shown
      .slice()
      .sort((a, b) => b.breakdown!.total - a.breakdown!.total)
      .slice(0, 1)
      .map((m) => m.code),
  );
  const toggle = (code: string) =>
    setPicked((p) =>
      p.includes(code)
        ? p.filter((x) => x !== code)
        : [...p.slice(-(MAX_PICKED - 1)), code],
    );
  const everyone = {
    total: results.total,
    counted: results.total,
    shares: results.everyone,
  };
  const label = results.everyone[answer]?.label ?? "";

  return (
    <section
      aria-labelledby="pulse-map"
      className="rounded-2xl border border-[#e7e3da] bg-white p-4"
      data-testid="pulse-map"
    >
      <h2 id="pulse-map" className="text-[15px] font-semibold">
        Across Canada
      </h2>
      <p className="mt-1 text-[13px] text-[#5c6370]">
        Where people say they are. Tap a province to compare it.
      </p>

      <div
        role="group"
        aria-label="Colour the map by"
        className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {results.everyone.map((s, i) => (
          <button
            key={s.optionId}
            type="button"
            aria-pressed={answer === i}
            onClick={() => setAnswer(i)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-[14px] font-medium ${
              answer === i
                ? "border-[#14161a] bg-[#14161a] text-white"
                : "border-[#d9d4c8] bg-white text-[#3f4550]"
            }`}
          >
            Said “{s.label}”
          </button>
        ))}
      </div>

      <div
        className="mt-3 grid grid-cols-7 gap-1"
        data-testid="pulse-map-grid"
        role="group"
        aria-label={`Share who said “${label}”, by province`}
      >
        {map.map((m) => {
          const [col, row] = TILES[m.code]!;
          const share = m.breakdown?.shares?.[answer];
          const pct = share?.pct ?? 0;
          const on = picked.includes(m.code);
          const hidden = m.state === "hidden";
          return (
            <button
              key={m.code}
              type="button"
              disabled={hidden}
              aria-pressed={on}
              data-testid={`pulse-tile-${m.code}`}
              data-state={m.state}
              aria-label={
                hidden
                  ? `${m.name}: fewer than ${results.minGroup} votes, not shown`
                  : `${m.name}: ${pct}% said ${label}, ${m.breakdown!.total} votes, self-reported`
              }
              onClick={() => toggle(m.code)}
              style={{
                gridColumn: col + 1,
                gridRow: row + 1,
                background: hidden ? "#efece5" : tint(answer, pct),
              }}
              className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg text-[#14161a] transition focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:outline-none ${
                on ? "ring-[3px] ring-[#14161a]" : ""
              } ${hidden ? "cursor-default text-[#8a909a]" : ""}`}
            >
              <span className="text-[11px] leading-none font-bold tracking-wide">
                {m.code}
              </span>
              <span className="mt-0.5 text-[15px] leading-none font-bold tabular-nums">
                {hidden ? "–" : `${pct}%`}
              </span>
              {hidden ? null : (
                <span className="mt-0.5 text-[10px] leading-none tabular-nums opacity-80">
                  n={m.breakdown!.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[12px] text-[#5c6370]">
        <span>0%</span>
        <span
          aria-hidden
          className="h-2.5 flex-1 rounded-full"
          style={{
            background: `linear-gradient(to right, ${tint(answer, 0)}, ${tint(answer, 100)})`,
          }}
        />
        <span>100% said “{label}”</span>
        <span
          aria-hidden
          className="ml-2 inline-block h-3 w-3 rounded-sm bg-[#efece5]"
        />
        <span>under {results.minGroup}</span>
      </div>

      {shown.length === 0 ? (
        <p
          className="mt-4 rounded-xl bg-[#f3f1ec] p-3 text-[14px] text-[#3f4550]"
          data-testid="pulse-map-empty"
        >
          No province has {results.minGroup} votes yet, so none can be shown.
          Places appear once enough people in them have answered.
        </p>
      ) : (
        <div className="mt-4 grid gap-4" data-testid="pulse-map-compare">
          <StackRow name="Everyone" b={everyone} testId="pulse-map-everyone" />
          {picked
            .map((code) => map.find((m) => m.code === code))
            .filter((m) => m?.breakdown?.shares)
            .map((m) => (
              <StackRow
                key={m!.code}
                name={`${m!.name} (self-reported)`}
                b={
                  m!.breakdown as Breakdown & {
                    shares: NonNullable<Breakdown["shares"]>;
                  }
                }
                testId={`pulse-map-row-${m!.code}`}
              />
            ))}
          <Legend shares={results.everyone} />
        </div>
      )}

      <p
        className="mt-3 text-[12.5px] text-[#5c6370]"
        data-testid="pulse-map-note"
      >
        <strong>Self-reported:</strong> nobody&apos;s location is checked.
        Provinces show from {results.minGroup} votes and update in steps of{" "}
        {results.minGroup}.{" "}
        {results.otherPlaces > 0
          ? `${n(results.otherPlaces)} vote${results.otherPlaces === 1 ? "" : "s"} came from provinces with too few to show. `
          : ""}
        {results.unplaced > 0
          ? `${n(results.unplaced)} didn't say where they are.`
          : ""}
      </p>
    </section>
  );
}
