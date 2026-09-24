"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HEADER, PLATE } from "./shelfGeometry";
import { carvedWord, SCRATCH_EXTENT, type Scratch } from "./scratches";

/**
 * **Something scratched OCTOBER PICKS into the header.**
 *
 * Not a sign hung on the shelving, and **not type**: there is no font here.
 * Every letter is a set of polylines scored into the fascia the plate already
 * has — measured at y = 64–88, mean rgb(72, 57, 45) — with overshoots, bowls
 * that do not close, stems past the baseline, four letters gone over twice,
 * and a few marks that are not letters at all. See `scratches.ts`.
 *
 * Each pass is drawn as two strokes: a pale hairline of raw wood offset
 * *downward*, because the tubes are overhead and that is the lip of a V-cut
 * they find, and the groove itself on top of it, nearly black. Vertical stems
 * are wider and deeper than the strokes across them, because they are the ones
 * you lean on.
 *
 * ## The arrival
 *
 * The fascia is untouched when you get here. A few seconds in, the strokes
 * begin — one at a time, each one growing from its start point along its own
 * path, which is what scoring looks like and what a mask wipe does not. A
 * little dust comes off the cut that is currently being made. Then it stops,
 * and the scratches are part of the store from then on.
 *
 * Nothing glows. Nothing is red. The point is authorship, not a haunting:
 * *something in here chose these films.*
 */

const START_DELAY = 2400;
const STROKE_MS = 150;
const GAP_MS = 62;

export function CarvedHeader({
  onProgress,
}: {
  /** 0–1 as the cutting proceeds. The room listens to this. */
  onProgress?: (progress: number) => void;
}) {
  const strokes = useMemo(() => carvedWord(), []);
  const [cut, setCut] = useState(0);
  const report = useRef(onProgress);
  useEffect(() => {
    report.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const total = strokes.length;
    const score = (n: number) => {
      setCut(n);
      report.current?.(n / total);
    };
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Somebody who asked for less motion gets the header as it ends up:
    // already cut, with nothing having been seen to do it.
    const timers = quiet
      ? [setTimeout(() => score(total), 0)]
      : strokes.map((_, i) =>
          setTimeout(() => score(i + 1), START_DELAY + i * GAP_MS),
        );
    return () => timers.forEach(clearTimeout);
  }, [strokes]);

  const w = SCRATCH_EXTENT.width;
  const h = SCRATCH_EXTENT.height;
  const boxWidth = HEADER.right - HEADER.left;
  const boxHeight = HEADER.bottom - HEADER.top;
  // Sized so the cap height lands just inside the fascia, centred on it.
  const scale = (boxHeight * 0.82) / h;
  const drawn = w * scale;

  return (
    <div
      aria-hidden
      className="absolute"
      style={{
        left: `${((HEADER.left + (boxWidth - drawn) / 2) / PLATE.width) * 100}%`,
        top: `${((HEADER.top + boxHeight * 0.1) / PLATE.height) * 100}%`,
        width: `${(drawn / PLATE.width) * 100}%`,
        height: `${((h * scale) / PLATE.height) * 100}%`,
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        style={{ overflow: "visible" }}
      >
        {strokes.map((s, i) => (
          <Cut key={i} scratch={s} started={i < cut} unit={scale} />
        ))}
      </svg>
    </div>
  );
}

function Cut({
  scratch,
  started,
  unit,
}: {
  scratch: Scratch;
  started: boolean;
  unit: number;
}) {
  const d = scratch.points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`)
    .join(" ");
  // `pathLength` normalises every stroke to 1, so one dash rule scores a long
  // stem and a short serif at the same speed without measuring either.
  const grow = {
    pathLength: 1,
    strokeDasharray: 1,
    strokeDashoffset: started ? 0 : 1,
    transition: `stroke-dashoffset ${STROKE_MS}ms linear`,
  } as const;

  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* The shoulder: wood pushed aside either side of the cut, in shadow. */}
      <path
        d={d}
        stroke="#0d0805"
        strokeOpacity={0.22 * scratch.depth}
        strokeWidth={(scratch.width / unit) * 2.3}
        {...grow}
      />
      {/* The raw edge, below the cut, where the light gets in. */}
      <path
        d={d}
        stroke="#b09266"
        strokeOpacity={0.78 * scratch.depth}
        strokeWidth={(scratch.width / unit) * 0.62}
        transform={`translate(0 ${0.42 / unit})`}
        {...grow}
      />
      {/* The groove. */}
      <path
        d={d}
        stroke="#130c06"
        strokeOpacity={0.55 + 0.42 * scratch.depth}
        strokeWidth={scratch.width / unit}
        {...grow}
      />
    </g>
  );
}
