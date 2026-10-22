import { z } from "zod";
import { gateById, readSection } from "./arena";

/**
 * **Our seats: who is sitting where, in the group's own words.**
 *
 * One row per person per night (`passport_occasion_seats`), plus at most one
 * row for the **group block** — the seats the host bought for everybody,
 * entered once. A guest writes only their own row; the host writes any
 * member's row and the block. The database decides that, not this file
 * (`seats-migration.sql`); this file only shapes what is written and read.
 *
 * Nothing here is inferred. A guest with no row of their own is not assumed
 * to be in the group block: "no seat yet" says what we know. Two people are
 * "together" only when the seats they entered say so.
 */

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/\s+/g, " "));

/** What a person may write. `for` is a member's user id, or `"group"`. */
export const SeatInputSchema = z.object({
  for: z.union([z.literal("group"), z.string().uuid()]),
  section: text(12).pipe(z.string().min(1, "Which section?")),
  row: text(8).optional().default(""),
  seats: text(24).optional().default(""),
  /** A gate number from the arena's map, or empty for "not sure". */
  gate: z
    .string()
    .trim()
    .max(4)
    .optional()
    .default("")
    .refine(
      (g) => g === "" || gateById(g) !== undefined,
      "Pick a gate from the list.",
    ),
  note: text(140).optional().default(""),
  /** Visible to the whole night when true; to me and the host when false. */
  shared: z.boolean().optional().default(true),
});

export type SeatInput = z.infer<typeof SeatInputSchema>;

export interface SeatRow {
  readonly user_id: string | null;
  readonly section: string;
  readonly row_label: string | null;
  readonly seats: string | null;
  readonly gate: string | null;
  readonly note: string | null;
  readonly shared: boolean;
  readonly updated_by: string | null;
  readonly updated_at: string;
}

export interface Seat {
  /** A member's id, or `null` for the group block. */
  readonly userId: string | null;
  readonly section: string;
  readonly row?: string;
  readonly seats?: string;
  readonly gate?: string;
  readonly note?: string;
  readonly shared: boolean;
  /** Who last wrote it: the person themselves, or the host for them. */
  readonly updatedBy?: string;
  readonly updatedAt: string;
}

export const seatOf = (r: SeatRow): Seat => ({
  userId: r.user_id,
  section: r.section,
  ...(r.row_label ? { row: r.row_label } : {}),
  ...(r.seats ? { seats: r.seats } : {}),
  ...(r.gate ? { gate: r.gate } : {}),
  ...(r.note ? { note: r.note } : {}),
  shared: r.shared,
  ...(r.updated_by ? { updatedBy: r.updated_by } : {}),
  updatedAt: r.updated_at,
});

/** The columns a write sets, from a checked input. */
export function seatColumns(input: SeatInput, by: string) {
  return {
    section: input.section.toUpperCase(),
    row_label: input.row ? input.row.toUpperCase() : null,
    seats: input.seats || null,
    gate: input.gate || null,
    note: input.note || null,
    shared: input.shared,
    updated_by: by,
    updated_at: new Date().toISOString(),
  };
}

/** "Section 309 · Row 12 · Seats 3–4" */
export function seatLine(
  seat: Pick<Seat, "section" | "row" | "seats">,
): string {
  const parts = [`Section ${seat.section}`];
  if (seat.row) parts.push(`Row ${seat.row}`);
  if (seat.seats) {
    const range = seat.seats.replace(/\s*-\s*/g, "–");
    parts.push(`${/[–,]/.test(range) ? "Seats" : "Seat"} ${range}`);
  }
  return parts.join(" · ");
}

/**
 * The seat numbers a seats field names, where it can be read: `"7"`,
 * `"7-10"`, `"7, 8"`. Anything else (`"aisle"`, `"101A"`) reads as nothing,
 * which only means Passport will not claim two people are side by side.
 */
export function seatNumbers(raw: string | undefined): number[] {
  if (!raw) return [];
  const out: number[] = [];
  for (const part of raw.split(/\s*,\s*/)) {
    const range = /^(\d{1,4})\s*[-–]\s*(\d{1,4})$/.exec(part);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      if (b < a || b - a > 40) return [];
      for (let n = a; n <= b; n++) out.push(n);
    } else if (/^\d{1,4}$/.test(part)) out.push(Number(part));
    else return [];
  }
  return out;
}

export interface SeatPerson {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
}

export interface SeatCluster {
  /** "Section 309 · Row 12", or "Section 309" when rows differ. */
  readonly where: string;
  readonly section: string;
  readonly row?: string;
  readonly people: readonly SeatPerson[];
  /** Same row and the entered seat numbers touch: side by side. */
  readonly sideBySide: boolean;
}

export interface SeatingPicture {
  /** Groups of two or more people in the same section. */
  readonly together: readonly SeatCluster[];
  /** People with a seat entered who share a section with nobody. */
  readonly apart: readonly (SeatPerson & { readonly seat: Seat })[];
  /** Members with no seat of their own that this viewer can see. */
  readonly unknown: readonly SeatPerson[];
}

const norm = (s: string | undefined) => (s ?? "").trim().toUpperCase();

/**
 * **Which friends are sitting together, from what they entered.** Members
 * only — a removed guest's row is kept in the database but not shown.
 */
export function seatingPicture(
  seats: readonly Seat[],
  people: readonly SeatPerson[],
): SeatingPicture {
  const mine = new Map<string, Seat>();
  for (const s of seats) if (s.userId) mine.set(s.userId, s);

  const bySection = new Map<string, { person: SeatPerson; seat: Seat }[]>();
  const unknown: SeatPerson[] = [];
  for (const person of people) {
    const seat = mine.get(person.id);
    if (!seat) {
      unknown.push(person);
      continue;
    }
    const key = norm(seat.section);
    bySection.set(key, [...(bySection.get(key) ?? []), { person, seat }]);
  }

  const together: SeatCluster[] = [];
  const apart: (SeatPerson & { seat: Seat })[] = [];
  for (const group of bySection.values()) {
    if (group.length < 2) {
      apart.push(...group.map(({ person, seat }) => ({ ...person, seat })));
      continue;
    }
    const rows = new Set(group.map((g) => norm(g.seat.row)));
    const sameRow = rows.size === 1 && !rows.has("");
    const section = group[0].seat.section;
    const row = sameRow ? group[0].seat.row : undefined;
    together.push({
      where: row ? `Section ${section} · Row ${row}` : `Section ${section}`,
      section,
      ...(row ? { row } : {}),
      people: group.map((g) => g.person),
      sideBySide: sameRow && contiguous(group.map((g) => g.seat.seats)),
    });
  }
  return { together, apart, unknown };
}

/** Every person's numbers read, and together they make one unbroken run. */
function contiguous(fields: readonly (string | undefined)[]): boolean {
  const all: number[] = [];
  for (const f of fields) {
    const n = seatNumbers(f);
    if (n.length === 0) return false;
    all.push(...n);
  }
  const sorted = [...new Set(all)].sort((a, b) => a - b);
  if (sorted.length !== all.length) return false; // two people, one seat
  return sorted.every((n, i) => i === 0 || n - sorted[i - 1] <= 1);
}

/** What the screen says about a seat's section and gate. */
export function seatFacts(seat: Pick<Seat, "section" | "gate">): {
  readonly level?: string;
  readonly sectionKnown: boolean;
  readonly gate?: string;
  readonly gateUnknown: boolean;
} {
  const section = readSection(seat.section);
  const gate = gateById(seat.gate);
  return {
    ...(section.levelName ? { level: section.levelName } : {}),
    sectionKnown: section.known,
    ...(gate ? { gate: gate.name } : {}),
    gateUnknown: !gate,
  };
}

// ------------------------------------------------------------ meeting point

/**
 * **Where we find each other at the arena.** One per night, set by the host,
 * kept in the night's own `details` (which only the host may change), so it
 * needs no table of its own. A gate from the map, a spot in the host's words
 * ("under the big screen at the top of the escalator"), and a time.
 */
export const MeetupSchema = z
  .object({
    gate: z
      .string()
      .trim()
      .max(4)
      .optional()
      .default("")
      .refine(
        (g) => g === "" || gateById(g) !== undefined,
        "Pick a gate from the list.",
      ),
    spot: text(120).optional().default(""),
    /** `HH:MM`, Vancouver time on game day. */
    time: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 18:15.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((m) => m.gate !== "" || m.spot !== "", {
    message: "Say a gate or a spot.",
  });

export type MeetupInput = z.infer<typeof MeetupSchema>;

export interface Meetup {
  readonly gate?: string;
  readonly spot?: string;
  readonly time?: string;
  readonly setBy?: string;
}

/** A stored meetup, read defensively: `details` is jsonb the host can write. */
export function meetupOf(value: unknown): Meetup | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const str = (x: unknown, max: number) =>
    typeof x === "string" && x.length > 0 && x.length <= max ? x : undefined;
  const gate = str(v.gate, 4);
  const meetup: Meetup = {
    ...(gate && gateById(gate) ? { gate } : {}),
    ...(str(v.spot, 120) ? { spot: v.spot as string } : {}),
    ...(typeof v.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)
      ? { time: v.time }
      : {}),
    ...(str(v.setBy, 64) ? { setBy: v.setBy as string } : {}),
  };
  return meetup.gate || meetup.spot ? meetup : undefined;
}

/** "18:15" → "6:15pm" */
export function clockLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}
