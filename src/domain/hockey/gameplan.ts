import type { PlanItem } from "./plan";

/**
 * **Our game plan: the evening as four stops, in the order it happens.**
 *
 * The Plan tab used to be every decision laid out at full size — dinner as
 * photographs, a second list of places, a plan card summarising what was
 * above it, the walk, the meeting places as cards, a separate host form, the
 * seats, the after-party vote — about seven phone screens. The same data now
 * reads as one itinerary a person can take in at a glance:
 *
 *   5:30 p.m.  PREGAME     where we eat (the vote)
 *   6:30 p.m.  MEET UP     where we meet (one answer, defaulted sensibly)
 *   7:00 p.m.  GAME TIME   the arena, my seat, directions
 *   AFTER      WHAT'S NEXT the after vote
 *
 * Each stop opens in place when somebody wants the detail. Nothing here
 * decides anything the group has not: it only reads votes and the host's
 * meeting point and says them back.
 */
export type StopId = "pregame" | "meet" | "game" | "after";

export const STOPS: readonly { readonly id: StopId; readonly label: string }[] =
  [
    { id: "pregame", label: "Pregame" },
    { id: "meet", label: "Meet up" },
    { id: "game", label: "Game time" },
    { id: "after", label: "After" },
  ];

/**
 * Where the night is: the stop that matters now. Before the votes close it's
 * still dinner; from warm-up the group is on its way to meet; from puck drop
 * it's the game; once the horn goes, what's next.
 */
export function currentStop(phaseId: string): StopId {
  switch (phaseId) {
    case "before":
      return "pregame";
    case "warmup":
      return "meet";
    case "live":
    case "int1":
    case "p2":
    case "int2":
    case "p3":
      return "game";
    default:
      return "after";
  }
}

/** Minutes before puck drop the group meets, when the host hasn't said. */
export const DEFAULT_MEET_BEFORE_MINUTES = 30;

/** "18:30" (the host's meetup time) → minutes from puck drop, in Vancouver. */
export function meetOffsetMinutes(
  anchorAt: string,
  hhmm: string | undefined,
  timeZone = "America/Vancouver",
): number {
  const m = hhmm ? /^(\d{1,2}):(\d{2})$/.exec(hhmm) : null;
  if (!m) return -DEFAULT_MEET_BEFORE_MINUTES;
  const anchor = new Date(anchorAt);
  const local = anchor.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
  const [ah, am] = local.split(":").map(Number);
  const offset = Number(m[1]) * 60 + Number(m[2]) - (ah * 60 + am);
  // A meetup more than half a day from the game is a typo, not a plan.
  return Math.abs(offset) > 12 * 60 ? -DEFAULT_MEET_BEFORE_MINUTES : offset;
}

export interface MeetingPoint {
  readonly value: string;
  /** Why this is the answer, so nobody wonders who decided. */
  readonly source: "host" | "vote" | "tied" | "dinner" | "none";
}

/**
 * **One answer to "where are we meeting?"** — asked in one place.
 *
 * In order: the host made it official (their spot or gate); the group voted
 * (the leader, or a tie said as a tie); otherwise the sensible default — we
 * meet where we eat, and walk over together. Dinner is only a default when a
 * real place is winning outright: "the concourse" is already at the arena.
 */
export function meetingPoint(input: {
  readonly official?: string;
  readonly vote?: PlanItem;
  readonly dinner?: PlanItem;
  readonly concourseLabel?: string;
}): MeetingPoint {
  if (input.official) return { value: input.official, source: "host" };
  const vote = input.vote;
  if (vote && vote.leaders.length === 1)
    return { value: vote.leaders[0], source: "vote" };
  if (vote && vote.leaders.length > 1)
    return { value: `Tied: ${vote.leaders.join(" / ")}`, source: "tied" };
  const dinner = input.dinner;
  if (
    dinner &&
    dinner.leaders.length === 1 &&
    dinner.leaders[0] !== input.concourseLabel
  )
    return { value: dinner.leaders[0], source: "dinner" };
  return { value: "Not decided yet", source: "none" };
}

/** The line under the meeting point that says who decided it. */
export function meetingSourceLine(point: MeetingPoint): string {
  switch (point.source) {
    case "host":
      return "Made official by the host";
    case "vote":
      return "The group's vote";
    case "tied":
      return "Tied — one more vote settles it";
    case "dinner":
      return "Where we eat, then we walk over together";
    case "none":
      return "Vote, or it'll be wherever dinner is";
  }
}
