"use client";

import { useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ArenaLevel } from "@/domain/hockey/arena";
import { ROGERS_ARENA_GATES } from "@/domain/hockey/arena";
import {
  CONCOURSE_EDGE,
  ICE,
  SEATS_OUT,
  VIEW,
  gatePoint,
  ovalPath,
  placeSpots,
  sectionShapes,
  type Point,
} from "@/domain/hockey/bowl";
import { SPOTS, type Spot, type SpotKind } from "@/domain/hockey/concourse";
import {
  freshness,
  levelOfPlace,
  placeOf,
  type ArenaPerson,
  type ArenaView,
  type CheckIn,
} from "@/domain/hockey/arena-mode";

/**
 * **The arena as a little world** — one level at a time, drawn from the
 * arena's map (`domain/hockey/bowl.ts`): sections in their real order round
 * the ice, every stand and washroom beside the section the map puts it by,
 * the gates drawn on that level, and the group as characters standing where
 * they last *said* they were.
 *
 * SVG and framer-motion only — no canvas, no WebGL — so it is crisp on any
 * phone, cheap to run, and readable by tests. Tap to zoom in; tap a pin to
 * open it. With reduced motion, nothing bobs and the zoom is a cut.
 */

export type Filter = "all" | "eat" | "drink" | "washroom" | "store" | "help";

export const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "eat", label: "Eat" },
  { id: "drink", label: "Drinks" },
  { id: "washroom", label: "Washrooms" },
  { id: "store", label: "Stores" },
  { id: "help", label: "Help & more" },
];

const FILTER_KINDS: Record<Filter, readonly SpotKind[] | null> = {
  all: null,
  eat: ["food", "snackCart"],
  drink: ["drink"],
  washroom: ["washroom"],
  store: ["store"],
  help: [
    "firstAid",
    "guestServices",
    "elevator",
    "water",
    "charging",
    "noAlcohol",
    "feature",
  ],
};

export const matchesFilter = (s: Spot, f: Filter) =>
  FILTER_KINDS[f]?.includes(s.kind) ?? true;

const PIN: Record<SpotKind, { fill: string; ink: string; glyph?: string }> = {
  food: { fill: "#0b7a3f", ink: "#fff" },
  drink: { fill: "#f2a900", ink: "#1b1300" },
  snackCart: { fill: "#f59e0b", ink: "#1b1300", glyph: "▲" },
  store: { fill: "#2f8fdc", ink: "#fff", glyph: "👕" },
  washroom: { fill: "#475569", ink: "#fff", glyph: "WC" },
  firstAid: { fill: "#e03a3e", ink: "#fff", glyph: "+" },
  guestServices: { fill: "#7c3aed", ink: "#fff", glyph: "?" },
  elevator: { fill: "#1e293b", ink: "#fff", glyph: "⇅" },
  water: { fill: "#0ea5c6", ink: "#fff", glyph: "💧" },
  charging: { fill: "#334155", ink: "#fff", glyph: "⚡" },
  noAlcohol: { fill: "#0f172a", ink: "#fff", glyph: "🚫" },
  feature: { fill: "#64748b", ink: "#fff" },
};

export const pinStyle = (s: Spot) => PIN[s.kind];
export const pinGlyph = (s: Spot) =>
  s.kind === "food" || s.kind === "drink" || s.kind === "feature"
    ? (s.code ?? "")
    : (PIN[s.kind].glyph ?? "");

export const hueColour = (hue: number, light = 52) =>
  `hsl(${hue} 78% ${light}%)`;

/** Every placed point on one level, by place id — for markers and focus. */
export function usePlaces(level: ArenaLevel) {
  return useMemo(() => {
    const at = new Map<string, Point>();
    for (const s of sectionShapes(level)) at.set(`sec:${s.id}`, s.centre);
    for (const p of placeSpots(level, SPOTS)) at.set(p.spot.id, p.at);
    for (const g of ROGERS_ARENA_GATES) {
      if (g.drawnOn !== level) continue;
      const p = gatePoint(g.id);
      if (p) at.set(`gate:${g.id}`, p);
    }
    return at;
  }, [level]);
}

/** Where a check-in stands on this level's drawing, if it is on it. */
export function pointOf(
  places: Map<string, Point>,
  level: ArenaLevel,
  placeId: string,
  view: Pick<ArenaView, "meetup">,
): Point | undefined {
  const place = placeOf(placeId, view.meetup);
  if (!place || place.offMap) return undefined;
  if (levelOfPlace(place) !== level) return undefined;
  if (place.gate) return places.get(`gate:${place.gate}`);
  return places.get(placeId);
}

export function ArenaMap({
  level,
  view,
  now,
  filter,
  selected,
  focus,
  picking,
  onSelect,
  onFocus,
}: {
  level: ArenaLevel;
  view: ArenaView;
  now: Date;
  filter: Filter;
  selected: string | null;
  /** Zoomed in on this point, or the whole level. */
  focus: Point | null;
  /** "Tap where you are": sections and pins all check you in. */
  picking: boolean;
  onSelect: (placeId: string) => void;
  onFocus: (p: Point | null) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const svg = useRef<SVGSVGElement>(null);
  const sections = useMemo(() => sectionShapes(level), [level]);
  const spots = useMemo(() => placeSpots(level, SPOTS), [level]);
  const places = usePlaces(level);
  const gates = ROGERS_ARENA_GATES.filter((g) => g.drawnOn === level);
  const zoom = 2.3;

  const viewBox = focus
    ? (() => {
        const w = VIEW.w / zoom;
        const h = VIEW.h / zoom;
        const x = Math.min(VIEW.w - w, Math.max(0, focus.x - w / 2));
        const y = Math.min(VIEW.h - h, Math.max(0, focus.y - h / 2));
        return `${x} ${y} ${w} ${h}`;
      })()
    : `0 0 ${VIEW.w} ${VIEW.h}`;

  const people = new Map(view.people.map((p) => [p.id, p]));
  const mySection = people.get(view.me)?.section;

  // Group the night's check-ins by where they stand on this level.
  const standing = new Map<string, { at: Point; who: CheckIn[] }>();
  for (const c of view.checkins) {
    const at = pointOf(places, level, c.place, view);
    if (!at) continue;
    const key = `${Math.round(at.x)},${Math.round(at.y)}`;
    const entry = standing.get(key) ?? { at, who: [] };
    entry.who.push(c);
    standing.set(key, entry);
  }

  // Seats people shared, as small chairs in their section.
  const seated = new Map<string, ArenaPerson[]>();
  for (const p of view.people) {
    if (!p.section) continue;
    seated.set(p.section, [...(seated.get(p.section) ?? []), p]);
  }

  const toSvg = (clientX: number, clientY: number): Point | null => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const pt = el.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const transition = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 120, damping: 20, mass: 0.9 };

  return (
    <motion.svg
      ref={svg}
      role="img"
      aria-label={`Schematic of Rogers Arena ${level === "100" ? "Plaza Level 100" : "Level 300"}: sections, stands, washrooms, gates and where your group checked in`}
      className="block h-auto w-full touch-manipulation select-none"
      initial={false}
      animate={{ viewBox }}
      transition={transition}
      data-level={level}
      data-zoomed={focus ? "true" : "false"}
      onClick={(e) => {
        const p = toSvg(e.clientX, e.clientY);
        if (p) onFocus(p);
      }}
    >
      <defs>
        <radialGradient id="arena-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#1d3b7a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="arena-ice" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dbe8f5" />
        </linearGradient>
      </defs>

      <rect
        x={0}
        y={0}
        width={VIEW.w}
        height={VIEW.h}
        fill="url(#arena-glow)"
      />
      {/* The concourse: where everything that isn't a seat is. */}
      <path
        d={ovalPath(CONCOURSE_EDGE)}
        fill="#16213a"
        stroke="#2b3b5f"
        strokeWidth={1}
      />
      <path d={ovalPath(SEATS_OUT)} fill="#0e172b" />

      {sections.map((s) => {
        const mine = s.id === mySection;
        const block = s.id === view.block;
        return (
          <g
            key={s.id}
            data-section={s.id}
            onClick={(e) => {
              if (!picking && !focus) return;
              e.stopPropagation();
              onSelect(`sec:${s.id}`);
            }}
            className={picking || focus ? "cursor-pointer" : undefined}
          >
            <path
              d={s.path}
              fill={
                mine
                  ? "#00843d"
                  : block
                    ? "#1f5c3a"
                    : selected === `sec:${s.id}`
                      ? "#3b5a99"
                      : "#46536b"
              }
              stroke={picking ? "#ffd84d" : "#0e172b"}
              strokeWidth={picking ? 0.8 : 0.6}
            />
            <text
              x={s.centre.x}
              y={s.centre.y + 3}
              textAnchor="middle"
              fontSize={8.5}
              fontWeight={700}
              fill="#e6edf7"
              style={{ pointerEvents: "none" }}
            >
              {s.id}
            </text>
          </g>
        );
      })}

      {mySection && sections.some((s) => s.id === mySection) && !reduced && (
        <motion.path
          d={sections.find((s) => s.id === mySection)!.path}
          fill="none"
          stroke="#7dffb0"
          strokeWidth={1.4}
          initial={{ opacity: 0.2 }}
          animate={{ opacity: [0.25, 0.95, 0.25] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          style={{ pointerEvents: "none" }}
        />
      )}

      <Ice />

      {/* Seats people shared: small chairs in their section's colour. */}
      {[...seated].map(([section, who]) => {
        const s = sections.find((x) => x.id === section);
        if (!s) return null;
        return who.map((p, i) => (
          <circle
            key={`${section}-${p.id}`}
            cx={s.centre.x + (i - (who.length - 1) / 2) * 5}
            cy={s.centre.y - 6}
            r={2.2}
            fill={hueColour(p.hue)}
            stroke="#fff"
            strokeWidth={0.6}
            style={{ pointerEvents: "none" }}
          />
        ));
      })}

      {gates.map((g) => {
        const p = gatePoint(g.id);
        if (!p) return null;
        return (
          <g
            key={g.id}
            data-gate={g.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(`gate:${g.id}`);
            }}
            className="cursor-pointer"
          >
            <rect
              x={p.x - 13}
              y={p.y - 7}
              width={26}
              height={14}
              rx={2}
              fill={selected === `gate:${g.id}` ? "#ffffff" : "#b9c4d6"}
              stroke="#0e172b"
              strokeWidth={0.8}
            />
            <text
              x={p.x}
              y={p.y + 3}
              textAnchor="middle"
              fontSize={7.5}
              fontWeight={800}
              fill="#0e172b"
            >
              G{g.id}
            </text>
          </g>
        );
      })}

      {spots.map(({ spot, at }) => {
        const style = PIN[spot.kind];
        const on = matchesFilter(spot, filter);
        const isSelected = selected === spot.id;
        return (
          <motion.g
            key={spot.id}
            data-spot={spot.id}
            initial={false}
            animate={{ opacity: on ? 1 : 0.14, scale: isSelected ? 1.35 : 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.25 }}
            style={{ transformOrigin: `${at.x}px ${at.y}px` }}
            onClick={(e) => {
              if (!on && !picking) return;
              e.stopPropagation();
              onSelect(spot.id);
            }}
            className={on || picking ? "cursor-pointer" : undefined}
          >
            {/* A bigger, invisible target than the pin itself. */}
            <circle cx={at.x} cy={at.y} r={8} fill="transparent" />
            {spot.kind === "snackCart" ? (
              <path
                d={`M${at.x},${at.y - 4.5}L${at.x + 4.5},${at.y + 3.5}L${at.x - 4.5},${at.y + 3.5}Z`}
                fill={style.fill}
                stroke="#0e172b"
                strokeWidth={0.5}
              />
            ) : (
              <>
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={5.2}
                  fill={style.fill}
                  stroke={isSelected ? "#fff" : "#0e172b"}
                  strokeWidth={isSelected ? 1.2 : 0.5}
                />
                <text
                  x={at.x}
                  y={at.y + (pinGlyph(spot).length > 1 ? 1.8 : 2.2)}
                  textAnchor="middle"
                  fontSize={pinGlyph(spot).length > 1 ? 4 : 6}
                  fontWeight={800}
                  fill={style.ink}
                  style={{ pointerEvents: "none" }}
                >
                  {pinGlyph(spot)}
                </text>
              </>
            )}
          </motion.g>
        );
      })}

      {/* The group, standing where they said they were. */}
      {[...standing.values()].map(({ at, who }) =>
        who.map((c, i) => {
          const person = people.get(c.user);
          if (!person) return null;
          const dx = (i - (who.length - 1) / 2) * 15;
          return (
            <Character
              key={c.user}
              person={person}
              me={c.user === view.me}
              at={{ x: at.x + dx, y: at.y }}
              fresh={freshness(c.at, now)}
              reduced={reduced}
              index={i}
              onClick={() => onSelect(c.place)}
            />
          );
        }),
      )}
    </motion.svg>
  );
}

function Ice() {
  const cx = VIEW.w / 2;
  const cy = VIEW.h / 2;
  return (
    <g style={{ pointerEvents: "none" }}>
      <path
        d={ovalPath(ICE)}
        fill="url(#arena-ice)"
        stroke="#9fb3cc"
        strokeWidth={0.8}
      />
      <line
        x1={cx}
        x2={cx}
        y1={cy - 33}
        y2={cy + 33}
        stroke="#e03a3e"
        strokeWidth={1.4}
      />
      <line
        x1={cx - 22}
        x2={cx - 22}
        y1={cy - 33}
        y2={cy + 33}
        stroke="#2f6fdc"
        strokeWidth={1.4}
      />
      <line
        x1={cx + 22}
        x2={cx + 22}
        y1={cy - 33}
        y2={cy + 33}
        stroke="#2f6fdc"
        strokeWidth={1.4}
      />
      <line
        x1={cx - 58}
        x2={cx - 58}
        y1={cy - 28}
        y2={cy + 28}
        stroke="#e03a3e"
        strokeWidth={0.6}
      />
      <line
        x1={cx + 58}
        x2={cx + 58}
        y1={cy - 28}
        y2={cy + 28}
        stroke="#e03a3e"
        strokeWidth={0.6}
      />
      <circle
        cx={cx}
        cy={cy}
        r={9}
        fill="none"
        stroke="#2f6fdc"
        strokeWidth={0.7}
      />
      <circle cx={cx} cy={cy} r={1.2} fill="#2f6fdc" />
      {[-40, 40].map((dx) =>
        [-14, 14].map((dy) => (
          <circle
            key={`${dx}${dy}`}
            cx={cx + dx}
            cy={cy + dy}
            r={6}
            fill="none"
            stroke="#e03a3e"
            strokeWidth={0.5}
          />
        )),
      )}
    </g>
  );
}

/**
 * One friend, as a character: their emoji in their colour, bobbing gently,
 * with a ring that pulses while the check-in is fresh. As it ages it fades
 * and its ring turns dashed — a check-in from forty minutes ago is a guess,
 * and should look like one.
 */
function Character({
  person,
  me,
  at,
  fresh,
  reduced,
  index,
  onClick,
}: {
  person: ArenaPerson;
  me: boolean;
  at: Point;
  fresh: "fresh" | "recent" | "stale";
  reduced: boolean;
  index: number;
  onClick: () => void;
}) {
  const colour = hueColour(person.hue);
  const y = at.y - 13;
  return (
    <motion.g
      data-person={person.id}
      data-fresh={fresh}
      initial={reduced ? false : { opacity: 0, scale: 0.4 }}
      animate={{ opacity: fresh === "stale" ? 0.5 : 1, scale: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 260, damping: 16 }
      }
      style={{ transformOrigin: `${at.x}px ${at.y}px` }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="cursor-pointer"
    >
      <motion.g
        animate={reduced ? undefined : { y: [0, -2.2, 0] }}
        transition={
          reduced
            ? undefined
            : {
                duration: 1.6 + index * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      >
        {fresh === "fresh" && !reduced && (
          <motion.circle
            cx={at.x}
            cy={y}
            r={8}
            fill="none"
            stroke={colour}
            strokeWidth={1.2}
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: 0, scale: 1.9 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            style={{ transformOrigin: `${at.x}px ${y}px` }}
          />
        )}
        <path
          d={`M${at.x - 3},${y + 6.5}L${at.x},${at.y - 1.5}L${at.x + 3},${y + 6.5}Z`}
          fill={colour}
        />
        <circle
          cx={at.x}
          cy={y}
          r={8}
          fill={colour}
          stroke={me ? "#ffffff" : "#0e172b"}
          strokeWidth={me ? 1.8 : 1}
          strokeDasharray={fresh === "stale" ? "2 1.5" : undefined}
        />
        <text x={at.x} y={y + 3.2} textAnchor="middle" fontSize={9}>
          {person.emoji}
        </text>
        <text
          x={at.x}
          y={y - 10.5}
          textAnchor="middle"
          fontSize={6}
          fontWeight={800}
          fill="#fff"
          stroke="#070b14"
          strokeWidth={1.6}
          paintOrder="stroke"
        >
          {me ? "YOU" : person.name.split(" ")[0].slice(0, 10)}
        </text>
      </motion.g>
    </motion.g>
  );
}
