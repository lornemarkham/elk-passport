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

export const NOT_DECIDED = "Meeting point not decided.";

export interface MeetingPoint {
  readonly value: string;
  /** Why this is the answer, so nobody wonders who decided. */
  readonly source: "host" | "vote" | "dinner" | "leading" | "tied" | "none";
  /**
   * The group (or the host) settled it. False for a suggestion or a vote
   * still going — those are never shown as the group's decision.
   */
  readonly decided: boolean;
  /** For `leading` and `tied`: what the open vote says so far. */
  readonly leading?: readonly string[];
}

/**
 * Has the group settled a vote? Voting closed with one leader, or everybody
 * has voted and one option leads. One person's vote is not the group's.
 */
export function voteSettled(
  item: PlanItem | undefined,
  members?: number,
): boolean {
  if (!item || item.leaders.length !== 1) return false;
  if (item.locked) return true;
  return members !== undefined && members > 0 && item.voters >= members;
}

/**
 * **One answer to "where are we meeting?"** — asked in one place, and never
 * an assumption dressed as a decision (2026-10-23).
 *
 * In order: the host made it official (their spot or gate); the group
 * settled the meet-up vote; the group has chosen where to eat, so that is
 * *suggested* (we eat, then walk over together) — labelled a suggestion;
 * otherwise "Meeting point not decided.", saying where an open vote stands.
 * "The concourse" is never suggested: it is already inside the arena.
 */
export function meetingPoint(input: {
  readonly official?: string;
  readonly vote?: PlanItem;
  readonly dinner?: PlanItem;
  readonly concourseLabel?: string;
  /** People on the night, to tell a settled vote from an early lead. */
  readonly members?: number;
}): MeetingPoint {
  if (input.official)
    return { value: input.official, source: "host", decided: true };
  const { vote, dinner, members } = input;
  if (voteSettled(vote, members))
    return { value: vote!.leaders[0], source: "vote", decided: true };
  if (vote && vote.leaders.length > 0)
    return {
      value: NOT_DECIDED,
      source: vote.leaders.length > 1 ? "tied" : "leading",
      decided: false,
      leading: vote.leaders,
    };
  if (
    voteSettled(dinner, members) &&
    dinner!.leaders[0] !== input.concourseLabel
  )
    return { value: dinner!.leaders[0], source: "dinner", decided: false };
  return { value: NOT_DECIDED, source: "none", decided: false };
}

/** The line under the meeting point that says who decided it — or that nobody has. */
export function meetingSourceLine(point: MeetingPoint): string {
  switch (point.source) {
    case "host":
      return "Made official by the host";
    case "vote":
      return "The group's vote";
    case "dinner":
      return "Suggested: it's where we eat. Not confirmed — the host can make it official";
    case "leading":
      return `Leading the vote: ${point.leading?.[0]} — not final`;
    case "tied":
      return `Tied: ${point.leading?.join(" / ")} — one more vote settles it`;
    case "none":
      return "Vote, or the host makes it official";
  }
}
