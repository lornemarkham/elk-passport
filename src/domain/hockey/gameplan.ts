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
  /**
   * Why this is the answer, so nobody wonders who decided:
   * the host's call; the pregame restaurant (the default); an earlier
   * "where are we meeting?" vote on a night that has one; or the arena.
   */
  readonly source: "host" | "pregame" | "vote" | "arena";
  /**
   * The group (or the host) settled it. False while the pregame vote is
   * still moving, or nobody has chosen one: that is the current default, said
   * as the default, never as the group's decision.
   */
  readonly decided: boolean;
  /** The pregame vote is level: the labels it is level between. */
  readonly tied?: readonly string[];
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
 * **One answer to "where are we meeting?"** — and nobody is asked twice.
 *
 * The pregame restaurant *is* the meeting point (2026-10-24): the group
 * already argued about where to start the night, so a second vote about where
 * to find each other was the same question again. In order:
 *
 * 1. the host overrode it (their spot or gate, `PUT /meetup`);
 * 2. the pregame vote has one leader — that restaurant, `decided` once the
 *    vote is settled and "leading" until then;
 * 3. an earlier "where are we meeting?" vote on a night that has one (the
 *    question is no longer asked, but its answer is not thrown away);
 * 4. the arena (`arena`), which is also where anyone skipping the pregame
 *    goes.
 *
 * "The concourse" is never a meeting point: it is already inside the arena,
 * so choosing it means the arena.
 */
export function meetingPoint(input: {
  readonly official?: string;
  readonly dinner?: PlanItem;
  readonly concourseLabel?: string;
  /** An earlier "where are we meeting?" vote, if the night has one. */
  readonly vote?: PlanItem;
  /** What the arena is called as a place to meet ("Outside Rogers Arena"). */
  readonly arena: string;
  /** People on the night, to tell a settled vote from an early lead. */
  readonly members?: number;
}): MeetingPoint {
  if (input.official)
    return { value: input.official, source: "host", decided: true };
  const { dinner, vote, members, concourseLabel } = input;
  const leader = dinner?.leaders[0];
  if (dinner && dinner.leaders.length === 1 && leader !== concourseLabel)
    return {
      value: leader as string,
      source: "pregame",
      decided: voteSettled(dinner, members),
    };
  if (voteSettled(vote, members))
    return { value: vote!.leaders[0], source: "vote", decided: true };
  if (dinner && dinner.leaders.length > 1)
    return {
      value: input.arena,
      source: "arena",
      decided: false,
      tied: dinner.leaders,
    };
  // The group chose the concourse: that is the arena, and it is decided.
  return {
    value: input.arena,
    source: "arena",
    decided: voteSettled(dinner, members),
  };
}

/** The line under the meeting point that says who decided it — or that nobody has. */
export function meetingSourceLine(point: MeetingPoint): string {
  switch (point.source) {
    case "host":
      return "The host's call, instead of the pregame plan";
    case "pregame":
      return point.decided
        ? "Pregame winner: everyone joining the pregame meets here"
        : "Leading the pregame vote: it's where we meet unless that changes";
    case "vote":
      return "The group's earlier vote on where to meet";
    case "arena":
      return point.tied
        ? `Pregame is tied (${point.tied.join(" / ")}): the arena until one wins`
        : point.decided
          ? "The pregame is at the arena, so that's where we meet"
          : "Nobody has picked a pregame yet: the arena until they do";
  }
}

/**
 * Where to meet at the arena, for anyone skipping the pregame: the nearest
 * curated meeting place if one is right at the doors (a plaza, a station
 * across the street), else the arena itself. Never a gate: Passport holds no
 * verified point for one (`arena.ts`).
 */
export function arenaMeetingSpot(
  venue: string,
  meetingPlaces: readonly {
    readonly name: string;
    readonly walkMinutes: number;
    readonly km: number;
  }[] = [],
): { readonly value: string; readonly detail: string } {
  const near = [...meetingPlaces]
    .filter((p) => p.km <= 0.35)
    .sort((a, b) => a.km - b.km)[0];
  return near
    ? {
        value: `Outside ${venue}`,
        detail: `${near.name} is the closest landmark, about ${near.walkMinutes}+ min on foot (straight line).`,
      }
    : {
        value: `Outside ${venue}`,
        detail:
          "Passport doesn't know which doors suit your seats, so ask the host if there's a gate.",
      };
}
