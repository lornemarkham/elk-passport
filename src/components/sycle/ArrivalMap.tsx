"use client";

import { useMemo, useState } from "react";
import type { BoardArrival } from "@/domain/sycle/board";
import {
  DISC_RADIUS,
  UNITS_PER_KM,
  project,
  type Point,
} from "@/domain/sycle/projection";
import { WORLD_LAND_PATH } from "./world";
import { progressLabel, statusLine } from "./words";

/**
 * **Everyone, converging.**
 *
 * The world as seen from YVR (see `projection.ts`): every route is a straight
 * line into the centre and the rings are true distance. A gentle radial
 * squash spreads the North American cluster without bending any route — a
 * radial rescale keeps radial lines radial — and the rings stay labelled in
 * real kilometres, so it is still a map you can read distance off.
 *
 * ## What is drawn, and how it says what it knows
 *
 *   route, dashed          not confirmed in the air
 *   route, solid behind    confirmed airborne; the solid part is elapsed time
 *   hollow plane, "est."   placed by the clock along the route — not radar
 *   filled plane           a position the provider reported, < 20 min old
 *   dot at YVR             landed; a person is "in Vancouver", nothing finer
 *
 * The legend says the second-to-last line out loud, because it is the one a
 * person will otherwise assume.
 */
const SQUASH = 0.62;

function squash(p: Point): Point {
  const r = Math.hypot(p.x, p.y);
  if (r < 1e-6) return p;
  const k = (DISC_RADIUS * Math.pow(r / DISC_RADIUS, SQUASH)) / r;
  // Rounded so server and browser render identical attributes: their trig
  // differs in the last digit, and React will not patch a mismatch up.
  return {
    x: Math.round(p.x * k * 100) / 100,
    y: Math.round(p.y * k * 100) / 100,
  };
}

const ringRadius = (km: number) => squash({ x: km * UNITS_PER_KM, y: 0 }).x;
const RINGS = [1000, 2500, 5000, 8000, 12000, 16000];

const at = (lat: number, lon: number) =>
  squash(project({ latitude: lat, longitude: lon }));

export function ArrivalMap({
  arrivals,
  now,
}: {
  readonly arrivals: readonly BoardArrival[];
  readonly now: Date;
}) {
  // The baked coastline is linear; squash it once.
  const land = useMemo(
    () =>
      WORLD_LAND_PATH.replace(
        /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
        (_, x, y) => {
          const p = squash({ x: Number(x), y: Number(y) });
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        },
      ),
    [],
  );
  const [focus, setFocus] = useState<string | null>(null);
  const placed = arrivals.filter((a) => a.from.location);
  const landed = arrivals.filter((a) => a.phase === "landed").length;
  const focused = placed.find((a) => a.id === focus);

  return (
    <figure className="relative">
      <svg
        viewBox="-540 -540 1080 1080"
        className="block h-auto w-full"
        role="img"
        aria-label={`Map of ${placed.length} flights converging on Vancouver`}
      >
        <defs>
          <radialGradient id="sycle-ocean" r="0.6">
            <stop offset="0%" stopColor="#0f2f4d" />
            <stop offset="100%" stopColor="#071526" />
          </radialGradient>
          <radialGradient id="sycle-glow" r="0.5">
            <stop offset="0%" stopColor="#ffd27a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffd27a" stopOpacity="0" />
          </radialGradient>
          <clipPath id="sycle-disc">
            <circle r={DISC_RADIUS} />
          </clipPath>
        </defs>

        <circle r={DISC_RADIUS} fill="url(#sycle-ocean)" />
        <g clipPath="url(#sycle-disc)">
          <path d={land} fill="#2b5d84" stroke="#3d7aa8" strokeWidth={0.6} />
          {RINGS.map((km) => (
            <g key={km}>
              <circle
                r={ringRadius(km)}
                fill="none"
                stroke="#9cc3e6"
                strokeOpacity={0.14}
                strokeDasharray="2 6"
              />
              <text
                x={4}
                y={-ringRadius(km) - 4}
                fill="#9cc3e6"
                fillOpacity={0.45}
                fontSize={13}
                className="tabular-nums"
              >
                {km.toLocaleString("en-CA")} km
              </text>
            </g>
          ))}
        </g>
        <circle
          r={DISC_RADIUS}
          fill="none"
          stroke="#9cc3e6"
          strokeOpacity={0.25}
        />

        {placed.map((a) => {
          const o = at(a.from.location!.latitude, a.from.location!.longitude);
          const mine = a.isYou;
          const colour = mine ? "#ff7a59" : "#ffd27a";
          const airborne = a.phase === "airborne";
          const done = a.phase === "landed";
          const off = a.phase === "cancelled" || a.phase === "diverted";
          const est =
            airborne && a.estimated?.at
              ? squash(project(a.estimated.at))
              : null;
          const rep = a.reported
            ? at(a.reported.latitude, a.reported.longitude)
            : null;
          // Planes point at the centre: every route on this map ends there.
          const angle = (p: Point) => (Math.atan2(-p.y, -p.x) * 180) / Math.PI;
          return (
            <g
              key={a.id}
              onMouseEnter={() => setFocus(a.id)}
              onMouseLeave={() => setFocus(null)}
              onClick={() => setFocus(a.id === focus ? null : a.id)}
              className="cursor-pointer"
              data-testid="sycle-route"
              data-phase={a.phase}
            >
              <line
                x1={o.x}
                y1={o.y}
                x2={0}
                y2={0}
                stroke={colour}
                strokeOpacity={done ? 0.18 : off ? 0.15 : 0.5}
                strokeWidth={mine ? 2.4 : 1.4}
                strokeDasharray={airborne || done ? undefined : "5 7"}
              />
              {airborne && est ? (
                <line
                  x1={o.x}
                  y1={o.y}
                  x2={est.x}
                  y2={est.y}
                  stroke={colour}
                  strokeWidth={mine ? 3.2 : 2}
                  strokeLinecap="round"
                />
              ) : null}
              <circle
                cx={o.x}
                cy={o.y}
                r={mine ? 6 : 4}
                fill={colour}
                fillOpacity={off ? 0.35 : 1}
              />
              {est && !rep ? (
                <g
                  transform={`translate(${est.x} ${est.y}) rotate(${angle(est)})`}
                >
                  <Plane hollow colour={colour} big={mine} />
                </g>
              ) : null}
              {rep ? (
                <g
                  transform={`translate(${rep.x} ${rep.y}) rotate(${angle(rep)})`}
                >
                  <Plane colour={colour} big={mine} />
                </g>
              ) : null}
              {/* A generous invisible hit area; the visible marks are tiny. */}
              <circle cx={o.x} cy={o.y} r={16} fill="transparent" />
            </g>
          );
        })}

        <circle r={46} fill="url(#sycle-glow)" className="sycle-pulse" />
        <circle r={7} fill="#fff" />
        <text
          y={30}
          textAnchor="middle"
          fill="#fff"
          fontSize={18}
          fontWeight={800}
          letterSpacing={2}
        >
          YVR
        </text>
        {landed > 0 ? (
          <text y={50} textAnchor="middle" fill="#ffd27a" fontSize={13}>
            {landed} landed
          </text>
        ) : null}
      </svg>

      {focused ? (
        <div className="pointer-events-none absolute top-3 left-3 max-w-[70%] rounded-lg bg-black/70 px-3 py-2 text-[13px] text-white backdrop-blur">
          <p className="font-bold">
            {focused.name ?? "A colleague"} · {focused.from.city}
          </p>
          <p className="text-white/70">{statusLine(focused, now)}</p>
          {focused.phase === "airborne" && focused.estimated ? (
            <p className="text-white/50">
              {progressLabel(focused.estimated.fraction)}
            </p>
          ) : null}
        </div>
      ) : null}

      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-white/55">
        <span>
          Straight lines are the real great-circle routes; rings are true
          distance from YVR.
        </span>
        <span>
          <svg
            width="14"
            height="10"
            viewBox="-8 -6 16 12"
            className="mr-1 inline"
          >
            <Plane hollow colour="#ffd27a" />
          </svg>
          placed by the clock, not by radar
        </span>
        <span>dashed: not confirmed in the air yet</span>
      </figcaption>
    </figure>
  );
}

function Plane({
  hollow,
  colour,
  big,
}: {
  hollow?: boolean;
  colour: string;
  big?: boolean;
}) {
  const s = big ? 1.5 : 1;
  return (
    <path
      transform={`scale(${s})`}
      d="M8 0 L-4 -6 L-2 0 L-4 6 Z"
      fill={hollow ? "#071526" : colour}
      stroke={colour}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}
