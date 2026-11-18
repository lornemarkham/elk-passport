"use client";

import { useState } from "react";
import type { Results as R } from "@/lib/pulse/results";
import { answerColor } from "./brand";
import { n } from "./parts";

const W = 600;
const H = 180;
const PAD = { l: 34, r: 8, t: 8, b: 22 };

/**
 * **How the answers moved as more people voted.** Each line is an answer's
 * share of the first N votes, so the right-hand end is where things stand
 * now. The scale is always 0–100% (never stretched to make a wobble look
 * like a swing), the line starts at 10 votes because fewer than that is
 * noise, and the note says what the chart can't tell you.
 */
export function Shifts({ results }: { results: R }) {
  const { shifts } = results.insights;
  const pts = shifts.points;
  const [hover, setHover] = useState<number | null>(null);
  if (pts.length < 2)
    return (
      <section
        className="rounded-2xl border border-[#e7e3da] bg-white p-4"
        data-testid="pulse-shifts"
        aria-labelledby="pulse-shifts-h"
      >
        <h2 id="pulse-shifts-h" className="text-[15px] font-semibold">
          How opinion moved
        </h2>
        <p
          className="mt-2 text-[14px] text-[#3f4550]"
          data-testid="pulse-shifts-wait"
        >
          This appears once 10 people have answered — fewer than that says
          nothing. {n(results.total)} so far.
        </p>
      </section>
    );
  const last = pts.length - 1;
  const first = pts[0]!.n;
  const span = Math.max(1, pts[last]!.n - first);
  const x = (i: number) =>
    PAD.l + ((pts[i]!.n - first) / span) * (W - PAD.l - PAD.r);
  const y = (pct: number) => PAD.t + (1 - pct / 100) * (H - PAD.t - PAD.b);
  const at = hover ?? last;
  const labelOf = (i: number) => results.everyone[i]?.label ?? "";
  return (
    <section
      className="rounded-2xl border border-[#e7e3da] bg-white p-4"
      data-testid="pulse-shifts"
      aria-labelledby="pulse-shifts-h"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="pulse-shifts-h" className="text-[15px] font-semibold">
          How opinion moved
        </h2>
        <p
          className="text-[13px] text-[#5c6370] tabular-nums"
          aria-live="polite"
        >
          after {n(pts[at]!.n)} votes
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full touch-pan-y"
        role="img"
        aria-label={`Share of each answer after the first ${first} to the first ${pts[last]!.n} votes`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          pts.forEach((_, i) => {
            if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
          });
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(g)}
              y2={y(g)}
              stroke="#e7e3da"
              strokeWidth="1"
            />
            <text
              x={PAD.l - 6}
              y={y(g) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#5c6370"
            >
              {g}%
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 5} fontSize="11" fill="#5c6370">
          {first} votes
        </text>
        <text
          x={W - PAD.r}
          y={H - 5}
          fontSize="11"
          fill="#5c6370"
          textAnchor="end"
        >
          {n(pts[last]!.n)} votes
        </text>
        {shifts.options.map((id, k) => (
          <path
            key={id}
            data-testid={`pulse-shift-line-${id}`}
            d={pts
              .map(
                (p, i) =>
                  `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.pct[k] ?? 0).toFixed(1)}`,
              )
              .join("")}
            fill="none"
            stroke={answerColor(k)}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="#14161a"
            strokeOpacity="0.3"
          />
        ) : null}
        {shifts.options.map((id, k) => (
          <circle
            key={id}
            cx={x(at)}
            cy={y(pts[at]!.pct[k] ?? 0)}
            r="4"
            fill={answerColor(k)}
            stroke="white"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <ul
        className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]"
        aria-label="Legend"
      >
        {shifts.options.map((id, k) => (
          <li key={id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: answerColor(k) }}
            />
            {labelOf(k)}{" "}
            <strong className="tabular-nums">{pts[at]!.pct[k] ?? 0}%</strong>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12.5px] text-[#5c6370]">
        Early points swing because few people have answered. A move can mean
        opinion changed, or just that different people arrived — for example
        when a link reaches a new group. It can&apos;t say which.
      </p>
    </section>
  );
}
