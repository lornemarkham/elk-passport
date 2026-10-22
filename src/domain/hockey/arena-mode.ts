import { z } from "zod";
import { gateById, type ArenaLevel } from "./arena";
import {
  LEVELS,
  LEVEL_NAME,
  RING,
  levelOfSection,
  spotById,
  whereWords,
  type Spot,
  type SpotKind,
} from "./concourse";

/**
 * **Arena Mode: where the group says it is, for one night, and nothing more.**
 *
 * Everything a friend sees about another friend's whereabouts is a
 * **check-in**: a place that person chose from the arena's map, when they
 * chose it, and maybe a line of nonsense. It is never a GPS position, never
 * updated by itself, and it says how old it is. The rules, kept by the
 * database (`arena-migration.sql`) and repeated here so the screen can say
 * them before anybody is refused:
 *
 * - **Opt in by doing it.** Nobody appears on the map until they check in.
 * - **Invited people only.** Members of the night see each other; nobody else.
 * - **Revocable.** "Vanish" deletes your check-in at once.
 * - **It expires with the event.** Check-ins, pings and quests exist inside a
 *   window — three hours before puck drop to five after (`arenaWindow`) — and
 *   are unreadable outside it and purged after.
 */

export const OPENS_BEFORE_MIN = 180;
export const CLOSES_AFTER_MIN = 300;

export interface ArenaWindow {
  readonly opensAt: Date;
  readonly closesAt: Date;
}

export function arenaWindow(startsAt: string | Date): ArenaWindow {
  const start = new Date(startsAt).getTime();
  return {
    opensAt: new Date(start - OPENS_BEFORE_MIN * 60_000),
    closesAt: new Date(start + CLOSES_AFTER_MIN * 60_000),
  };
}

export type WindowState = "before" | "open" | "closed";

export function windowState(w: ArenaWindow, now: Date): WindowState {
  if (now < w.opensAt) return "before";
  if (now >= w.closesAt) return "closed";
  return "open";
}

// ------------------------------------------------------------------ places

/**
 * Where a person can say they are. Each id is one of:
 * `sec:<section>` · a spot id from the map (`concourse.ts`) · `gate:<n>` ·
 * `meetup` (the host's meeting point) · `out:outside` · `out:coming`.
 */
export const PLACE_ID = /^[A-Za-z0-9:~._-]{1,48}$/;

export const ELSEWHERE = {
  "out:outside": "Outside the arena",
  "out:coming": "On my way",
} as const;

export interface Place {
  readonly id: string;
  readonly label: string;
  /** "beside section 304", "Level 300" — the honest where. */
  readonly where: string;
  readonly level?: ArenaLevel;
  readonly section?: string;
  readonly spot?: Spot;
  readonly gate?: string;
  /** Somewhere that isn't a point on the drawing. */
  readonly offMap?: boolean;
}

export interface MeetupLike {
  readonly gate?: string;
  readonly spot?: string;
}

export function placeOf(
  id: string,
  meetup?: MeetupLike | null,
): Place | undefined {
  if (id.startsWith("sec:")) {
    const section = id.slice(4);
    const level = levelOfSection(section);
    if (!level) return undefined;
    return {
      id,
      label: `Section ${section}`,
      where: LEVEL_NAME[level],
      level,
      section,
    };
  }
  if (id.startsWith("gate:")) {
    const gate = gateById(id.slice(5));
    if (!gate) return undefined;
    return { id, label: gate.name, where: gate.where, gate: gate.id };
  }
  if (id === "meetup") {
    if (!meetup) return undefined;
    const gate = gateById(meetup.gate);
    return {
      id,
      label: "The meeting point",
      where:
        [gate?.name, meetup.spot].filter(Boolean).join(" · ") ||
        "Set by the host",
      ...(gate ? { gate: gate.id } : { offMap: true }),
    };
  }
  if (id in ELSEWHERE) {
    return {
      id,
      label: ELSEWHERE[id as keyof typeof ELSEWHERE],
      where: "Not in the building",
      offMap: true,
    };
  }
  const spot = spotById(id);
  if (!spot) return undefined;
  return {
    id,
    label:
      spot.code && /^[A-Z]$/.test(spot.code)
        ? `${spot.name} (${spot.code})`
        : spot.name,
    where: `${LEVEL_NAME[spot.level]}, ${whereWords(spot)}`,
    level: spot.level,
    spot,
  };
}

export const isPlace = (id: string, meetup?: MeetupLike | null) =>
  placeOf(id, meetup) !== undefined;

/** Which level a place is drawn on, if any. Gates: the level the map draws them on. */
export function levelOfPlace(p: Place): ArenaLevel | undefined {
  if (p.level) return p.level;
  if (p.gate) return gateById(p.gate)?.drawnOn;
  return undefined;
}

export const ALL_SECTIONS: readonly string[] = LEVELS.flatMap((l) => RING[l]);

// ------------------------------------------------------------------ freshness

export type Freshness = "fresh" | "recent" | "stale";

/** Under 10 minutes is fresh; under 30 recent; older than that, a guess. */
export function freshness(at: string, now: Date): Freshness {
  const mins = (now.getTime() - new Date(at).getTime()) / 60_000;
  if (mins < 10) return "fresh";
  if (mins < 30) return "recent";
  return "stale";
}

export function agoWords(at: string, now: Date): string {
  const mins = Math.max(
    0,
    Math.round((now.getTime() - new Date(at).getTime()) / 60_000),
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min ago`;
}

// ------------------------------------------------------------------ statuses

/** Optional nonsense to check in with. Free text is allowed too. */
export const STATUS_PRESETS: readonly string[] = [
  "In line. Pray for me.",
  "Guarding the seats with my life",
  "Lost. Send a search party.",
  "Found the good nachos",
  "Hiding from the kiss cam",
  "Back in 5 (lie)",
  "Don't ask",
];

// ------------------------------------------------------------------ pings

/**
 * - `where` — "Find this legend": asks one person to check in.
 * - `here` — "I'm over here, genius": points one person (or everyone) at me.
 * - `herd` — "Find the herd": everyone, come to this place.
 * - `meet` — one-tap meetup request: you (or all), meet me at this place.
 * - `coming` / `cant` — the answers.
 */
export const PING_KINDS = [
  "where",
  "here",
  "herd",
  "meet",
  "coming",
  "cant",
] as const;
export type PingKind = (typeof PING_KINDS)[number];

const note = z
  .string()
  .trim()
  .max(80)
  .transform((s) => s.replace(/\s+/g, " "))
  .optional()
  .default("");

const placeId = z.string().regex(PLACE_ID, "That isn't a place.");

// ------------------------------------------------------------------ quests

export interface QuestKind {
  readonly id: string;
  readonly emoji: string;
  readonly name: string;
  readonly pitch: string;
  /** Spots worth suggesting for it, nearest the starter's seat first. */
  readonly destination?: (s: Spot) => boolean;
  readonly needsPlace?: boolean;
  readonly needsSubject?: boolean;
  /** Crew members can report a price they actually saw. */
  readonly reportsPrice?: boolean;
  /** What a crew member's note means. */
  readonly noteLabel?: string;
  /** One line that keeps it the right kind of fun. */
  readonly sensible?: string;
}

const isStand = (codes: string) => (s: Spot) =>
  !!s.code &&
  codes.includes(s.code) &&
  (s.kind === "food" || s.kind === "drink");
const ofKind =
  (...kinds: SpotKind[]) =>
  (s: Spot) =>
    kinds.includes(s.kind);

export const QUESTS: readonly QuestKind[] = [
  {
    id: "beer-run",
    emoji: "🍺",
    name: "Beer Run!",
    pitch:
      "One brave soul goes. Everyone else orders. Nobody runs on the stairs.",
    destination: ofKind("drink"),
    noteLabel: "Your order",
    sensible: "Grab a water for the table while you're there.",
  },
  {
    id: "cheapest-beer",
    emoji: "🔎",
    name: "Find the Cheapest Beer",
    pitch:
      "Read the boards, report the real number. Lowest verified-by-your-eyes price wins.",
    destination: ofKind("drink"),
    reportsPrice: true,
    noteLabel: "What you found",
    sensible: "It's a price hunt, not a drinking game.",
  },
  {
    id: "hot-dog-hero",
    emoji: "🌭",
    name: "Hot Dog Hero",
    pitch: "Somebody has to feed this group. Be the hero they don't deserve.",
    destination: isStand("JS"),
    noteLabel: "Your order",
  },
  {
    id: "find-the-herd",
    emoji: "🐃",
    name: "Find the Herd",
    pitch:
      "Everybody, one place, right now. Last one there is buying nothing — just shamed.",
    needsPlace: true,
  },
  {
    id: "missing-legend",
    emoji: "🕵️",
    name: "The Missing Legend",
    pitch: "Someone went for nachos in the first period and never came back.",
    needsSubject: true,
  },
  {
    id: "merch-mission",
    emoji: "🧢",
    name: "Merchandise Mission",
    pitch: "Somebody needs a toque. Somebody always needs a toque.",
    destination: ofKind("store"),
    noteLabel: "What to get",
  },
];

export const questKind = (id: string) => QUESTS.find((q) => q.id === id);

// ------------------------------------------------------------------ actions

export const ArenaActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("checkin"),
    place: placeId,
    status: note,
  }),
  z.object({ type: z.literal("vanish") }),
  z.object({
    type: z.literal("ping"),
    kind: z.enum(PING_KINDS),
    /** A member's id, or absent for everyone on the night. */
    to: z.string().uuid().optional(),
    place: placeId.optional(),
    replyTo: z.string().uuid().optional(),
    note,
  }),
  z.object({
    type: z.literal("questStart"),
    kind: z.string().max(24),
    place: placeId.optional(),
    subject: z.string().uuid().optional(),
    note,
  }),
  z.object({
    type: z.literal("questJoin"),
    quest: z.string().uuid(),
    note,
    place: placeId.optional(),
    /** A price somebody actually saw, in cents. */
    priceCents: z.number().int().min(1).max(10_000).optional(),
  }),
  z.object({ type: z.literal("questLeave"), quest: z.string().uuid() }),
  z.object({
    type: z.literal("questClose"),
    quest: z.string().uuid(),
    outcome: z.enum(["done", "dropped"]),
    note,
  }),
]);

export type ArenaAction = z.infer<typeof ArenaActionSchema>;

// ------------------------------------------------------------------ the view

export interface CheckIn {
  readonly user: string;
  readonly place: string;
  readonly status: string;
  readonly at: string;
}

export interface Ping {
  readonly id: string;
  readonly from: string;
  readonly to: string | null;
  readonly kind: PingKind;
  readonly place: string | null;
  readonly replyTo: string | null;
  readonly note: string;
  readonly at: string;
}

export interface QuestCrew {
  readonly user: string;
  readonly note: string;
  readonly place: string | null;
  readonly priceCents: number | null;
  readonly at: string;
}

export interface Quest {
  readonly id: string;
  readonly kind: string;
  readonly startedBy: string;
  readonly subject: string | null;
  readonly place: string | null;
  readonly note: string;
  readonly status: "open" | "done" | "dropped";
  readonly closedBy: string | null;
  readonly closedNote: string;
  readonly at: string;
  readonly crew: readonly QuestCrew[];
}

export interface ArenaPerson {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly hue: number;
  readonly role: "host" | "guest";
  /** Their seat's section, where they shared it (Our Seats). */
  readonly section?: string;
}

export interface ArenaView {
  /** False until the arena migration is applied; the map still works. */
  readonly available: boolean;
  readonly nightId: string;
  readonly title: string;
  readonly venue: string;
  readonly startsAt: string;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly me: string;
  readonly role: "host" | "guest";
  readonly people: readonly ArenaPerson[];
  readonly meetup?: MeetupLike & { readonly time?: string };
  readonly checkins: readonly CheckIn[];
  readonly pings: readonly Ping[];
  readonly quests: readonly Quest[];
  readonly now: string;
}

/** The lowest price the crew of a cheapest-beer quest actually reported. */
export function lowestReport(q: Quest): QuestCrew | undefined {
  return q.crew
    .filter((c) => c.priceCents !== null)
    .sort((a, b) => (a.priceCents ?? 0) - (b.priceCents ?? 0))[0];
}

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
