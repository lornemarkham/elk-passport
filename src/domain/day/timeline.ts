import type { DayPlanned } from "./build";
import type { Journey, TravelMode } from "@/lib/routing/journey";
import { shownLeg } from "@/lib/routing/legs";
import { dayLegs } from "@/lib/routing/dayLegs";

/**
 * **What time you would be where — and how sure that is.**
 *
 * The doctrine sketches a day with clock times ("Leave at 8:40. You'll be home
 * around 12:50", §2.5) and roadmap decision D-8 asks whether `/go` may state
 * them. This is the narrow version of yes: a clock time is built **only** from
 * what the person said (when they leave), the minutes the plan or the person
 * gave each stop, and Atlas's routed minutes for each move. It never turns a
 * kilometre into minutes, and it never invents a speed.
 *
 * A move Atlas routed is its estimate. A move Atlas did not route is the
 * plan's own flat allowance (`MOVE_MINUTES`), which is neither a floor nor a
 * forecast — a short hop is padded, a long one is short-changed — so every
 * time that depends on one is **about**, and says the road was not measured.
 * Uncertainty accumulates down the day, so the doubt is carried forward
 * rather than reset at each stop.
 *
 * A start that is really *now* (`startsNow`) is the device's clock, not
 * something the person said: the timeline is built on it and says so
 * (`fromNow`).
 *
 * No leaving time, no clock: the day says so instead of assuming one.
 */
export type TimeBasis =
  /** Every move so far is a routed estimate. */
  | "routed"
  /** At least one move so far is only the plan's allowance: this is "about". */
  | "allowance";

export interface TimelineStop {
  readonly arrive: number;
  readonly leave: number;
  readonly basis: TimeBasis;
  /** Minutes the move into this stop was given, and where that came from. */
  readonly move?: { readonly minutes: number; readonly routed: boolean };
}

export type Verdict =
  /** Home by the time they said, with room, on routed moves only. */
  | "ok"
  /** Home by then on paper, but a road is unmeasured — or under 15 min to spare. */
  | "tight"
  /** Home after the time they said, on what is already measured or planned. */
  | "over";

export interface Timeline {
  readonly stops: readonly TimelineStop[];
  readonly home?: {
    readonly arrive: number;
    readonly basis: TimeBasis;
    readonly move: { readonly minutes: number; readonly routed: boolean };
  };
  /** The last point of the day: home if there is a way home, else the last stop. */
  readonly ends: number;
  readonly basis: TimeBasis;
  /** Counted from the device's clock ("leave now"), not a time the person said. */
  readonly fromNow: boolean;
  readonly homeBy?: number;
  /** Minutes from `ends` to `homeBy` (negative when late). */
  readonly slack?: number;
  readonly verdict?: Verdict;
}

const TIGHT_MINUTES = 15;

/** A routed answer in the mode asked, with no access caution: the only kind that is counted. */
const routedMinutes = (
  journey: Journey | undefined,
  mode: TravelMode,
): number | undefined =>
  journey?.kind === "routed" && journey.mode === mode && !journey.accessCaution
    ? journey.minutes
    : undefined;

export function timelineFor(
  day: DayPlanned,
  journeys: readonly (Journey | undefined)[],
  mode: TravelMode,
): Timeline | undefined {
  const start = day.brief.startAt;
  if (start === undefined || day.stops.length === 0) return undefined;

  const { legs, into, home } = dayLegs(day);
  const buffer = day.budget?.perMove ?? 15;
  const move = (leg: number | undefined) => {
    if (leg === undefined) return undefined;
    const shown = shownLeg(legs[leg]!, journeys[leg]);
    const minutes = routedMinutes(shown, mode);
    return minutes !== undefined
      ? { minutes, routed: true }
      : { minutes: buffer, routed: false };
  };

  let clock = start;
  let basis: TimeBasis = "routed";
  const stops: TimelineStop[] = day.stops.map((stop, i) => {
    const arriving = move(into[i]);
    if (arriving) {
      clock += arriving.minutes;
      if (!arriving.routed) basis = "allowance";
    }
    const arrive = clock;
    clock += stop.minutes;
    return {
      arrive,
      leave: clock,
      basis,
      ...(arriving ? { move: arriving } : {}),
    };
  });

  const back = move(home);
  let homeEntry: Timeline["home"];
  if (back) {
    clock += back.minutes;
    if (!back.routed) basis = "allowance";
    homeEntry = { arrive: clock, basis, move: back };
  }

  const homeBy = day.brief.homeBy;
  const slack = homeBy !== undefined ? homeBy - clock : undefined;
  const verdict: Verdict | undefined =
    slack === undefined
      ? undefined
      : slack < 0
        ? "over"
        : basis === "allowance" || slack < TIGHT_MINUTES
          ? "tight"
          : "ok";

  return {
    stops,
    ...(homeEntry ? { home: homeEntry } : {}),
    ends: clock,
    basis,
    fromNow: day.brief.startsNow === true,
    ...(homeBy !== undefined ? { homeBy } : {}),
    ...(slack !== undefined ? { slack } : {}),
    ...(verdict ? { verdict } : {}),
  };
}
