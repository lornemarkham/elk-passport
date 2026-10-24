import { z } from "zod";

/**
 * **The Crew: finding each other inside Rogers Arena, for one night.**
 *
 * Four small things sit on top of Arena Mode's check-ins, and they share one
 * set of rules, kept by the database (`crew-migration.sql`) and repeated here
 * so the screen can say them before anybody is refused:
 *
 * - **Sharing is off until you turn it on.** Nobody is on anybody's screen
 *   until they check in or add a GPS hint themselves, on their own phone.
 * - **A GPS hint is a hint.** Phones lose GPS inside a steel-and-concrete
 *   building: indoors it can be wrong by hundreds of metres and says nothing
 *   about level or section. So Passport never stores or shows coordinates.
 *   The server turns one reading into a *zone around the arena*, a rounded
 *   distance and the phone's own accuracy, keeps that single row (no
 *   history), and throws the coordinates away.
 * - **The manual spot is the real answer.** "I'm in section 112" is what
 *   finds a friend. GPS only says "their phone is around the arena".
 * - **Nobody is "here" until they say so.** Presence needs a check-in inside
 *   the building. A GPS hint, a seat, an invitation or "on my way" never
 *   makes anyone present.
 * - **Stopping is one tap** and removes everything at once. Everything also
 *   expires with the arena window (`arena-mode.ts`).
 * - **Nothing here reads behaviour.** No guessing at how someone is doing from
 *   where they are or how they move.
 */

/** The joke is the name; the screen never says anything about a person. */
export const FIND_FRIEND_NAME = "Find My Drunk Friend";
export const FIND_FRIEND_TAGLINE =
  "Lost a friend? Ask the crew, not the crowd.";

// ------------------------------------------------------------------ GPS hint

/** Rogers Arena, as the Hockey night record has it (`night.ts venueAt`). */
export const ARENA_AT = { lat: 49.2778, lng: -123.1088 } as const;

/** Inside this, a phone is "around the arena". About one city block. */
export const AROUND_M = 250;
/** Inside this, "near the arena". */
export const NEAR_M = 1000;
/** A reading less certain than this is refused: it would say nothing. */
export const MAX_ACCURACY_M = 1500;

export type GpsZone = "around" | "near" | "away";
export const GPS_ZONES: readonly GpsZone[] = ["around", "near", "away"];

export function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export const GpsReadingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** The phone's own radius of doubt, in metres. */
  accuracy: z.number().min(0).max(100_000),
});
export type GpsReading = z.infer<typeof GpsReadingSchema>;

export interface GpsHintRow {
  readonly zone: GpsZone;
  /** Rounded to 50 m. */
  readonly distanceM: number;
  /** Rounded to 10 m, never below 10. */
  readonly accuracyM: number;
}

/**
 * One reading in, one coarse row out. The coordinates stop here: this is the
 * only function that sees them and it returns nothing from which they could be
 * rebuilt (a distance and a zone, not a bearing).
 */
export function hintFromReading(r: GpsReading): GpsHintRow | undefined {
  if (r.accuracy > MAX_ACCURACY_M) return undefined;
  const d = metresBetween(ARENA_AT, r);
  const zone: GpsZone =
    d <= AROUND_M ? "around" : d <= NEAR_M ? "near" : "away";
  return {
    zone,
    distanceM: Math.min(50_000, Math.round(d / 50) * 50),
    accuracyM: Math.max(10, Math.round(r.accuracy / 10) * 10),
  };
}

export interface GpsHint extends GpsHintRow {
  readonly user: string;
  readonly at: string;
}

/** What a friend reads. Never "in section", never "here". */
export function hintWords(h: GpsHintRow): string {
  const acc = `±${h.accuracyM} m`;
  switch (h.zone) {
    case "around":
      return `Phone is around the arena (${acc})`;
    case "near":
      return `Phone is near the arena, about ${h.distanceM} m off (${acc})`;
    case "away":
      return h.distanceM >= 5000
        ? `Phone is a long way from the arena (${acc})`
        : `Phone is about ${(h.distanceM / 1000).toFixed(1)} km from the arena (${acc})`;
  }
}

/** Said under every GPS line. Indoors GPS drifts and has no floors. */
export const GPS_CAVEAT =
  "GPS can't tell which level or section. Inside the building it can drift by hundreds of metres.";

/** A GPS hint older than this is shown as old. The manual spot has its own clock. */
export const GPS_STALE_MIN = 10;

export const gpsIsStale = (at: string, now: Date) =>
  (now.getTime() - new Date(at).getTime()) / 60_000 >= GPS_STALE_MIN;

// ------------------------------------------------------------------ presence

/**
 * What the crew may honestly say about one person.
 *
 * - `in` — they checked in at a place inside the building. Their word.
 * - `coming` — they said "on my way".
 * - `outside` — they said they're outside.
 * - `hint` — only a GPS hint. A phone, not a person; no place.
 * - `quiet` — nothing shared. Not "missing", not "gone": quiet.
 */
export type Presence = "in" | "coming" | "outside" | "hint" | "quiet";

export function presenceOf(input: {
  /** The check-in's place id, if they have one. */
  readonly place?: string;
  /** Whether that place is inside the building (a section, stand, gate…). */
  readonly inside?: boolean;
  readonly hint?: GpsHintRow;
}): Presence {
  if (input.place === "out:coming") return "coming";
  if (input.place === "out:outside") return "outside";
  if (input.place && input.inside) return "in";
  if (input.hint) return "hint";
  return "quiet";
}

// ------------------------------------------------------------------ summons

export const SUMMON_RESPONSES = ["coming", "busy", "where"] as const;
export type SummonResponse = (typeof SUMMON_RESPONSES)[number];

export const SUMMON_RESPONSE_LABEL: Readonly<Record<SummonResponse, string>> = {
  coming: "On my way",
  busy: "Busy",
  where: "Where?",
};
export const SUMMON_RESPONSE_EMOJI: Readonly<Record<SummonResponse, string>> = {
  coming: "🏃",
  busy: "⏳",
  where: "🤷",
};

export const SUMMON_NOTES: readonly string[] = [
  "Nachos. Now.",
  "Someone found the good seats",
  "Group photo",
  "Goal horn is coming",
];

/** A summon stays "live" this long; after that it is history for the night. */
export const SUMMON_LIVE_MIN = 20;

export interface SummonReply {
  readonly user: string;
  readonly response: SummonResponse;
  readonly at: string;
}

export interface Summon {
  readonly id: string;
  readonly from: string;
  readonly place: string;
  readonly note: string;
  readonly at: string;
  readonly replies: readonly SummonReply[];
}

export const summonIsLive = (s: Summon, now: Date) =>
  (now.getTime() - new Date(s.at).getTime()) / 60_000 < SUMMON_LIVE_MIN;

/** Who is coming, who is busy, who asked "where?", and who hasn't said. */
export function summonTally(
  s: Summon,
  memberIds: readonly string[],
): Record<SummonResponse | "silent", string[]> {
  const out: Record<SummonResponse | "silent", string[]> = {
    coming: [],
    busy: [],
    where: [],
    silent: [],
  };
  for (const id of memberIds) {
    if (id === s.from) continue;
    const r = s.replies.find((x) => x.user === id);
    out[r ? r.response : "silent"].push(id);
  }
  return out;
}

// ------------------------------------------------------------------ snack runs

/** Passport never touches money. Said on every run. */
export const NO_PAYMENTS =
  "Passport doesn't handle money. Whoever's going and whoever's eating settle up between themselves.";

export const SNACK_RUN_STATUSES = ["open", "done", "cancelled"] as const;
export type SnackRunStatus = (typeof SNACK_RUN_STATUSES)[number];

export interface SnackItem {
  readonly user: string;
  readonly item: string;
  readonly at: string;
}

export interface SnackRun {
  readonly id: string;
  readonly runner: string;
  /** A concession's place id from the arena's map, if the runner named one. */
  readonly stand: string | null;
  readonly note: string;
  readonly status: SnackRunStatus;
  readonly at: string;
  readonly items: readonly SnackItem[];
}

// ------------------------------------------------------------------ actions

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/\s+/g, " "));

const placeId = z
  .string()
  .regex(/^[A-Za-z0-9:~._-]{1,48}$/, "That isn't a place.");

/** The crew's actions, merged into `ArenaActionSchema`. */
export const CrewActionSchemas = [
  z.object({ type: z.literal("gpsShare"), reading: GpsReadingSchema }),
  /** Takes the check-in and the GPS hint away in one go. */
  z.object({ type: z.literal("stopSharing") }),
  z.object({
    type: z.literal("summon"),
    place: placeId,
    note: text(80).optional().default(""),
  }),
  z.object({
    type: z.literal("summonReply"),
    summon: z.string().uuid(),
    response: z.enum(SUMMON_RESPONSES),
  }),
  z.object({
    type: z.literal("runStart"),
    stand: placeId.optional(),
    note: text(80).optional().default(""),
  }),
  z.object({
    type: z.literal("runRequest"),
    run: z.string().uuid(),
    item: text(60).pipe(z.string().min(1, "What do you want?")),
  }),
  z.object({ type: z.literal("runUnrequest"), run: z.string().uuid() }),
  z.object({
    type: z.literal("runClose"),
    run: z.string().uuid(),
    outcome: z.enum(["done", "cancelled"]),
  }),
] as const;

export interface CrewView {
  /** False until `crew-migration.sql` is applied; the rest of Arena Mode works. */
  readonly available: boolean;
  readonly gps: readonly GpsHint[];
  readonly summons: readonly Summon[];
  readonly runs: readonly SnackRun[];
}

export const NO_CREW: CrewView = {
  available: false,
  gps: [],
  summons: [],
  runs: [],
};
