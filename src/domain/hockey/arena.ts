/**
 * **Rogers Arena, as the arena itself describes it — and no further.**
 *
 * Every fact here was read from the arena's own website on 2026-10-22 and is
 * cited to the page it came from (`SOURCES`). Passport does not hold an
 * indoor map, a gate-to-section table or a verified point for any gate, so:
 *
 * - **No gate is ever recommended for a seat.** The arena publishes no
 *   gate-to-section mapping. The one thing its map does show is which gates
 *   are drawn on which level's plan; that is offered as what the map shows,
 *   never as "use this gate", and nothing is preselected from it.
 * - **No gate has coordinates.** `at` exists so a verified point can be added
 *   the day one is checked (see `SEATS-AND-ARENA.md`); until then directions
 *   go to the arena and say so.
 * - **Where two of the arena's pages disagree, both are kept** (`CONFLICTS`)
 *   and the newer page is what the screen says.
 *
 * Nothing here is a fact Atlas holds. It is a small, cited, hand-checked list
 * of the same kind as `collections/vancouver.ts`: small on purpose, and to be
 * re-checked rather than trusted after the arena changes its building.
 */

export const ARENA_CHECKED = "2026-10-22";

export const SOURCES = {
  map: {
    label: "Rogers Arena map (directory map, updated 2026-09-29)",
    url: "https://rogersarena.com/map/",
    file: "https://rogersarena.com/wp-content/uploads/2026/09/2627-RA-BRA-Updated-Directory-Map-1.jpg",
  },
  accessibility: {
    label: "Fans with Disabilities and Accessible Needs (updated 2025-12-16)",
    url: "https://rogersarena.com/disabilities/",
  },
  directions: {
    label: "Parking and directions",
    url: "https://rogersarena.com/parking-and-directions/",
  },
  faq: {
    label: "Frequently asked questions",
    url: "https://rogersarena.com/frequently-asked-questions/",
  },
  tickets: {
    label: "Ticket info",
    url: "https://rogersarena.com/ticket-info/",
  },
} as const;

export type SourceId = keyof typeof SOURCES;

export type ArenaLevel = "100" | "300";

export interface ArenaGate {
  /** The number painted on the gate, as a string: what a person selects. */
  readonly id: string;
  readonly name: string;
  /** Which level's plan the arena's map draws this gate on. Not a route. */
  readonly drawnOn: ArenaLevel;
  /** Where it is, in the words of the arena's map or pages. */
  readonly where: string;
  /** `false` where the arena says this entrance is not accessible. */
  readonly accessible: boolean;
  /** Anything else the arena says about it. */
  readonly note?: string;
  /** A verified [lat, lng] for the gate itself. None is verified yet. */
  readonly at?: readonly [number, number];
  readonly source: readonly SourceId[];
}

/**
 * The eight gates on the arena's 2026-09-29 map, in its numbering. Gate 9,
 * which the older FAQ mentions, is not on that map, so it is not offered.
 */
export const ROGERS_ARENA_GATES: readonly ArenaGate[] = [
  {
    id: "1",
    name: "Gate 1",
    drawnOn: "300",
    where: "North side, by the Dunsmuir Viaduct",
    accessible: true,
    source: ["map"],
  },
  {
    id: "2",
    name: "Gate 2",
    drawnOn: "300",
    where: "North side, by the Dunsmuir Viaduct",
    accessible: true,
    source: ["map", "accessibility"],
  },
  {
    id: "3",
    name: "Gate 3",
    drawnOn: "100",
    where: "North-east corner, off Pat Quinn Way",
    accessible: false,
    note: "Not an accessible entrance.",
    source: ["map", "accessibility", "faq"],
  },
  {
    id: "6",
    name: "Gate 6",
    drawnOn: "100",
    where: "South-east, on Pacific Boulevard",
    accessible: true,
    source: ["map"],
  },
  {
    id: "7",
    name: "Gate 7",
    drawnOn: "100",
    where: "South side, off Griffiths Way",
    accessible: false,
    note: "The map calls it the RBC Priority Entrance. Not an accessible entrance.",
    source: ["map", "accessibility"],
  },
  {
    id: "8",
    name: "Gate 8",
    drawnOn: "300",
    where: "West side, by the Sportsbar",
    accessible: true,
    source: ["map"],
  },
  {
    id: "10",
    name: "Gate 10",
    drawnOn: "100",
    where:
      "North side, on Expo Boulevard, across from Stadium–Chinatown SkyTrain's Stadium exit",
    accessible: true,
    note: "Elevator here. The ticket centre is beside it.",
    source: ["map", "directions", "tickets"],
  },
  {
    id: "16",
    name: "Gate 16",
    drawnOn: "100",
    where: "East side, on Pat Quinn Way",
    accessible: true,
    note: "The arena's drop-off and pick-up zone for guests with disabilities, with curb ramps and elevators.",
    source: ["map", "accessibility"],
  },
];

export const gateById = (
  id: string | null | undefined,
): ArenaGate | undefined =>
  id ? ROGERS_ARENA_GATES.find((g) => g.id === id) : undefined;

/** The gates the arena's map draws on a level's plan. What the map shows; not advice. */
export const gatesDrawnOn = (level: ArenaLevel): ArenaGate[] =>
  ROGERS_ARENA_GATES.filter((g) => g.drawnOn === level);

export interface SectionReading {
  /** Known: on the arena's map. Unknown: saved as typed, not recognised. */
  readonly known: boolean;
  readonly level?: ArenaLevel | "suite";
  readonly levelName?: string;
}

/**
 * **Which level a section is on, from the map's own numbering** — 101–122 on
 * the Level 100 plan, 301–330 on Level 300, `WC311` and `WC317` its
 * wheelchair positions on 300, and the suites on 500. Anything else is kept
 * as the person typed it and said to be unrecognised; it is their ticket, not
 * Passport's.
 */
export function readSection(raw: string): SectionReading {
  const s = raw
    .trim()
    .toUpperCase()
    .replace(/^SECTION\s*/, "");
  if (/^WC\s?3(11|17)$/.test(s))
    return { known: true, level: "300", levelName: "Level 300" };
  const n = /^\d{3}$/.test(s) ? Number(s) : NaN;
  if (n >= 101 && n <= 122)
    return { known: true, level: "100", levelName: "Plaza Level 100" };
  if (n >= 301 && n <= 330)
    return { known: true, level: "300", levelName: "Level 300" };
  if (n >= 501 && n <= 530)
    return { known: true, level: "suite", levelName: "Level 500 suites" };
  return { known: false };
}

/** Practical lines for getting in, each with the page that says it. */
export const ENTRY_GUIDANCE: readonly {
  readonly text: string;
  readonly source: SourceId;
}[] = [
  {
    text: "Tickets are on your phone — Rogers Arena is a mobile-ticket venue. Your ticket may name a gate.",
    source: "tickets",
  },
  {
    text: "Bags, purses and backpacks up to 14″ × 14″ × 6″ (35 × 35 × 15 cm).",
    source: "faq",
  },
  {
    text: "No in-and-out: once you're in, you're in.",
    source: "faq",
  },
  {
    text: "SkyTrain: Stadium–Chinatown station; its Stadium exit is directly across from Gate 10.",
    source: "directions",
  },
];

export const ACCESSIBILITY: readonly {
  readonly text: string;
  readonly source: SourceId;
}[] = [
  {
    text: "Every entrance is accessible except Gates 3 and 7.",
    source: "accessibility",
  },
  {
    text: "Gate 16 on Pat Quinn Way is the drop-off and pick-up zone, with curb ramps and elevators.",
    source: "accessibility",
  },
  {
    text: "Guest Services: sections 114 and 311 (and 104 at hockey games, for club seats). Assistive listening devices, booster seats and sensory kits are there.",
    source: "accessibility",
  },
  {
    text: "Fan Services: 604.899.7440 — accessible parking, access help for non-visible disabilities.",
    source: "accessibility",
  },
];

/**
 * Where the arena's own pages disagree. The screen follows the newer page;
 * this list is what `SEATS-AND-ARENA.md` reports as uncertain.
 */
export const CONFLICTS: readonly string[] = [
  "Inaccessible entrances: the accessibility page (2025-12-16) says Gates 3 and 7; the FAQ says only Gate 3.",
  "Gate 16: the accessibility page puts it on Pat Quinn Way (as the map draws it); the FAQ says off Abbott Street.",
  "Elevators: the accessibility page says Gates 2, 9, 10 and 16; the FAQ says Gates 1, 9, 10 and 16. The 2026 map has no Gate 9 and draws North, East and South elevators.",
  "Guest Services on Level 300: section 311 (accessibility page, FAQ bag answers) or 310 (other FAQ answers).",
];
