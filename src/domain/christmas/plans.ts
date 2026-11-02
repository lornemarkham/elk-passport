import type { Party } from "./discover";
import { addDays, type WhenReading } from "./when";

/**
 * **The shapes of a Christmas adventure.**
 *
 * Each is an adventure of kind `christmas` on Passport's one group core
 * (ADR 009) and is sketched by the Day Builder's own engine (ADR 012) — a
 * shape only decides how many days, what to call it, and the sentence the
 * builder reads for every day. Nothing here ranks or composes places.
 *
 * The sentences use only words the Day Builder already reads ("this
 * evening", "good food and drink", "with the kids", "take it easy"), so the
 * builder fills around the Christmas finds somebody chose — which are kept
 * on their days first — rather than pretending it understands "festive".
 */

export type ShapeId = "evening" | "family-day" | "market" | "weekend" | "multi";

export interface Shape {
  readonly id: ShapeId;
  readonly label: string;
  readonly line: string;
  readonly emoji: string;
  /** Days by default; `multi` lets somebody choose 3–5. */
  readonly days: number;
  readonly say: string;
  readonly title: string;
}

export const SHAPES: readonly Shape[] = [
  {
    id: "evening",
    label: "A Christmas evening",
    line: "Lights after dark, something warm, home for bed.",
    emoji: "🌙",
    days: 1,
    say: "a Christmas evening, good food and drink",
    title: "Our Christmas evening",
  },
  {
    id: "family-day",
    label: "A family Christmas day",
    line: "Santa, a treat, a run-around, nobody melting down.",
    emoji: "👨‍👩‍👧",
    days: 1,
    say: "a Christmas day, take it easy, good food and drink",
    title: "Our family Christmas day",
  },
  {
    id: "market",
    label: "A Christmas market adventure",
    line: "A market or two, a long lunch, presents sorted.",
    emoji: "🎪",
    days: 1,
    say: "Christmas markets, good food and drink",
    title: "Christmas market day",
  },
  {
    id: "weekend",
    label: "A holiday weekend",
    line: "Two days, the best of the season, one plan.",
    emoji: "🎄",
    days: 2,
    say: "a great Christmas day out, good food and drink",
    title: "Our holiday weekend",
  },
  {
    id: "multi",
    label: "A multi-day Christmas",
    line: "Three to five days — family in town, or a trip.",
    emoji: "🧳",
    days: 3,
    say: "a great Christmas day out, good food and drink",
    title: "Our Christmas",
  },
];

export const shapeById = (id: string | undefined): Shape =>
  SHAPES.find((s) => s.id === id) ?? SHAPES[0]!;

const PARTY_SAYS: Readonly<Record<Party, string>> = {
  family: "with the kids",
  friends: "with friends",
  couple: "the two of us",
  solo: "just me",
};

/** The one sentence every day is built from (`startSentence`'s job, for Christmas). */
export function sayFor(input: {
  readonly shape: Shape;
  readonly party?: Party;
  readonly youngest?: number;
  readonly extra?: string;
}): string {
  const parts = [input.shape.say];
  const party =
    input.party ?? (input.shape.id === "family-day" ? "family" : undefined);
  if (party) parts.push(PARTY_SAYS[party]);
  if (party === "family" && input.youngest !== undefined)
    parts.push(`youngest is ${input.youngest}`);
  const extra = input.extra?.trim();
  if (extra) parts.push(extra);
  return parts.join(", ").slice(0, 300);
}

/** The adventure's days, from a first day. */
export function daysOf(first: string, count: number): string[] {
  return Array.from({ length: Math.max(1, Math.min(5, count)) }, (_, i) =>
    addDays(first, i),
  );
}

export interface Placement {
  /** Chosen finds that belong on one day: an event Atlas dates to it. */
  readonly pinned: Readonly<Record<string, string>>;
  /** Chosen finds Atlas dates outside every day of the plan. */
  readonly offDates: readonly string[];
}

/**
 * **Put each chosen find on a day Atlas says it happens.**
 *
 * Only a find with stated dates that cover *some but not all* of the days is
 * pinned (to the first it covers). One that covers them all, or that Atlas
 * holds no dates for, is shared out by the builder as usual. One whose dates
 * miss the plan entirely is reported, never silently moved — the page says
 * "Atlas dates this outside your plan" and keeps it as an idea.
 */
export function place(
  chosen: readonly { readonly id: string; readonly when: WhenReading }[],
  days: readonly string[],
): Placement {
  const pinned: Record<string, string> = {};
  const offDates: string[] = [];
  for (const { id, when } of chosen) {
    if (!when.from || !when.to || when.confidence === "unconfirmed") continue;
    const covered = days.filter((d) => d >= when.from! && d <= when.to!);
    if (covered.length === 0) offDates.push(id);
    else if (covered.length < days.length) pinned[id] = covered[0]!;
  }
  return { pinned, offDates };
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * `Sunday, Nov 22` (or `Sun 22 Nov` short) for a calendar day — the same on
 * the server and in every browser, so a page never hydrates to a different
 * sentence than it rendered.
 */
export function dayLabel(day: string, short = false): string {
  const d = new Date(`${day}T12:00:00Z`);
  const weekday = WEEKDAYS[d.getUTCDay()]!;
  const month = MONTHS[d.getUTCMonth()]!;
  return short
    ? `${weekday.slice(0, 3)} ${d.getUTCDate()} ${month}`
    : `${weekday}, ${month} ${d.getUTCDate()}`;
}
