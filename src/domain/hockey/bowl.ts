import type { ArenaLevel } from "./arena";
import { RING, ZONES, type Spot, type ZoneId } from "./concourse";

/**
 * **The bowl, drawn — a schematic, not a floor plan.**
 *
 * Passport draws each level as a rink-shaped ring of its sections in the map's
 * own order, clockwise from the west, with every spot set just outside the
 * section the map draws it beside. Sections are equal slices of the ring;
 * real ones are not. Nothing here is surveyed, measured or to scale, and the
 * screen says so under the drawing. What it gets right is *order*: which
 * stand is by which section, and which way round the concourse is shorter.
 *
 * Pure geometry, so it is tested without a browser: the drawing is
 * `VIEW.w × VIEW.h` user units and everything returns points in them.
 */

export const VIEW = { w: 360, h: 300 } as const;
const C = { x: VIEW.w / 2, y: VIEW.h / 2 };

/** A rounded-square curve: n = 2 is an ellipse; higher is boxier, like a rink. */
interface Oval {
  readonly a: number;
  readonly b: number;
  readonly n: number;
}

export const ICE: Oval = { a: 70, b: 34, n: 4 };
export const SEATS_IN: Oval = { a: 88, b: 50, n: 3.4 };
export const SEATS_OUT: Oval = { a: 124, b: 84, n: 3 };
/** The middle of the concourse, where spots sit. */
export const CONCOURSE: Oval = { a: 140, b: 100, n: 2.8 };
export const CONCOURSE_EDGE: Oval = { a: 156, b: 116, n: 2.6 };
/** Open areas off the ring. */
const PLAZA: Oval = { a: 166, b: 132, n: 2.4 };

export interface Point {
  readonly x: number;
  readonly y: number;
}

function onOval(o: Oval, theta: number): Point {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / o.n;
  return {
    x: C.x + o.a * Math.sign(c) * Math.abs(c) ** e,
    y: C.y + o.b * Math.sign(s) * Math.abs(s) ** e,
  };
}

/**
 * Fraction of the way round → angle, by arc length on the middle of the
 * seating ring, so sections come out the same length rather than bunching at
 * the ends. Fraction 0 is due west; it grows clockwise (screen y is down).
 */
const SAMPLES = 720;
const MID: Oval = {
  a: (SEATS_IN.a + SEATS_OUT.a) / 2,
  b: (SEATS_IN.b + SEATS_OUT.b) / 2,
  n: 3.2,
};
const ARC: readonly number[] = (() => {
  const lengths = [0];
  let prev = onOval(MID, Math.PI);
  for (let k = 1; k <= SAMPLES; k++) {
    const p = onOval(MID, Math.PI + (2 * Math.PI * k) / SAMPLES);
    lengths.push(lengths[k - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  const total = lengths[SAMPLES];
  return lengths.map((l) => l / total);
})();

function thetaAt(fraction: number): number {
  const f = ((fraction % 1) + 1) % 1;
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ARC[mid] <= f) lo = mid;
    else hi = mid;
  }
  const span = ARC[hi] - ARC[lo] || 1;
  const k = lo + (f - ARC[lo]) / span;
  return Math.PI + (2 * Math.PI * k) / SAMPLES;
}

export const pointAt = (o: Oval, fraction: number): Point =>
  onOval(o, thetaAt(fraction));

/** A closed path along an oval, for the ice and the concourse outline. */
export function ovalPath(o: Oval, steps = 96): string {
  const pts = Array.from({ length: steps }, (_, i) =>
    onOval(o, (2 * Math.PI * i) / steps),
  );
  return `M${pts.map((p) => `${r(p.x)},${r(p.y)}`).join("L")}Z`;
}

const r = (n: number) => Math.round(n * 10) / 10;

// ------------------------------------------------------------------ sections

export interface SectionShape {
  readonly id: string;
  readonly path: string;
  /** Where its number is written, and where a seat marker sits. */
  readonly centre: Point;
  readonly fraction: number;
}

/** Where on the ring a section's middle is, 0–1 clockwise from due west. */
export function sectionFraction(level: ArenaLevel, section: string): number {
  const ring = RING[level];
  const i = ring.indexOf(section);
  return (i + 0.5) / ring.length;
}

export function sectionShapes(level: ArenaLevel): SectionShape[] {
  const ring = RING[level];
  const gap = 0.0035;
  return ring.map((id, i) => {
    const f0 = i / ring.length + gap;
    const f1 = (i + 1) / ring.length - gap;
    const steps = 5;
    const inner = Array.from({ length: steps + 1 }, (_, k) =>
      pointAt(SEATS_IN, f0 + ((f1 - f0) * k) / steps),
    );
    const outer = Array.from({ length: steps + 1 }, (_, k) =>
      pointAt(SEATS_OUT, f1 - ((f1 - f0) * k) / steps),
    );
    const path = `M${[...inner, ...outer].map((p) => `${r(p.x)},${r(p.y)}`).join("L")}Z`;
    const fraction = (i + 0.5) / ring.length;
    return {
      id,
      path,
      fraction,
      centre: pointAt(
        {
          a: (SEATS_IN.a + SEATS_OUT.a) / 2,
          b: (SEATS_IN.b + SEATS_OUT.b) / 2,
          n: 3.2,
        },
        fraction,
      ),
    };
  });
}

/** The circular mean of some fractions — so 122 and 101 average to due west. */
function meanFraction(fs: readonly number[]): number {
  const x = fs.reduce((t, f) => t + Math.cos(2 * Math.PI * f), 0);
  const y = fs.reduce((t, f) => t + Math.sin(2 * Math.PI * f), 0);
  const f = Math.atan2(y, x) / (2 * Math.PI);
  return (f + 1) % 1;
}

export const anchorFraction = (level: ArenaLevel, by: readonly string[]) =>
  meanFraction(by.map((s) => sectionFraction(level, s)));

// ------------------------------------------------------------------ spots

export interface PlacedSpot {
  readonly spot: Spot;
  readonly at: Point;
}

/**
 * Every spot on a level, placed. Spots on the ring sit on the concourse beside
 * their sections, fanned out along it when several share a place. Spots in an
 * open area sit together out past the concourse, in a little grid, because
 * the map draws them as a cluster rather than beside any one section.
 */
export function placeSpots(level: ArenaLevel, spots: readonly Spot[]) {
  const onRing = new Map<string, Spot[]>();
  const inZone = new Map<ZoneId, Spot[]>();
  for (const s of spots) {
    if (s.level !== level) continue;
    if (s.zone) inZone.set(s.zone, [...(inZone.get(s.zone) ?? []), s]);
    else {
      const key = s.by.join("-");
      onRing.set(key, [...(onRing.get(key) ?? []), s]);
    }
  }
  const placed: PlacedSpot[] = [];
  const step = 0.0125;
  for (const group of onRing.values()) {
    const f = anchorFraction(level, group[0].by);
    group.forEach((s, i) => {
      const offset = (i - (group.length - 1) / 2) * step;
      placed.push({ spot: s, at: pointAt(CONCOURSE, f + offset) });
    });
  }
  for (const [zone, group] of inZone) {
    const f = anchorFraction(level, group[0].by);
    const centre = pointAt(PLAZA, f);
    const cols = Math.min(4, Math.ceil(Math.sqrt(group.length)));
    const rows = Math.ceil(group.length / cols);
    group.forEach((s, i) => {
      const cx = (i % cols) - (cols - 1) / 2;
      const cy = Math.floor(i / cols) - (rows - 1) / 2;
      placed.push({
        spot: s,
        at: clamp({ x: centre.x + cx * 15, y: centre.y + cy * 15 }),
      });
    });
    void zone;
  }
  return placed;
}

/** Inside the drawing, with room for a pin. */
function clamp(p: Point): Point {
  const m = 10;
  return {
    x: Math.min(VIEW.w - m, Math.max(m, p.x)),
    y: Math.min(VIEW.h - m, Math.max(m, p.y)),
  };
}

// ------------------------------------------------------------------ gates

/**
 * Which sections each gate is drawn nearest on the map, on the level the map
 * draws it. Read off the same 2026-09-29 image as everything else.
 */
export const GATE_ANCHORS: Readonly<
  Record<string, { level: ArenaLevel; by: readonly string[] }>
> = {
  "10": { level: "100", by: ["105"] },
  "3": { level: "100", by: ["109", "110"] },
  "16": { level: "100", by: ["111", "112"] },
  "6": { level: "100", by: ["114", "115"] },
  "7": { level: "100", by: ["115", "116"] },
  "1": { level: "300", by: ["305"] },
  "2": { level: "300", by: ["306"] },
  "8": { level: "300", by: ["329", "330"] },
};

const GATE_RING: Oval = { a: 172, b: 136, n: 2.4 };

export function gatePoint(gate: string): Point | undefined {
  const a = GATE_ANCHORS[gate];
  if (!a) return undefined;
  return clamp(pointAt(GATE_RING, anchorFraction(a.level, a.by)));
}

export { ZONES };
