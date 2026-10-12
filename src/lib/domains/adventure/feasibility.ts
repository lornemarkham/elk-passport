import { distanceKm } from "@/lib/environment/geo";
import {
  availableMinutes,
  type Adventure,
  type AdventurePoint,
  type Reading,
  type SubjectMoment,
} from "./contracts";

/**
 * **Does the day fit inside itself — and how do we know?**
 *
 * Every check answers `fits`, `does-not-fit`, `unknown` or `unconstrained`
 * (nobody set a limit to check against), with a sentence saying why. A check
 * says `does-not-fit` only when the evidence makes it certain, and the travel
 * check leans on one fact to get there without a routing provider:
 * **straight-line distance is the shortest any road can be.** A stop past the
 * radius they gave is past it by road too; a day with no minutes left cannot
 * drive any distance at all. Anything short of that is `unknown`, and says so.
 */
export type Verdict = "fits" | "does-not-fit" | "unknown" | "unconstrained";

export interface Check {
  readonly verdict: Verdict;
  readonly because: string;
}

/** One hop of the day, between two placed-or-not points. */
export interface Leg {
  /** `"origin"`, or the moment it leaves from. */
  readonly from: string;
  readonly to: string;
  /** Haversine km. Never a road distance. */
  readonly straightLineKm: Reading<number>;
  /**
   * Minutes on the road. `known` only with `source.by === "routing"`; anything
   * else claiming to be a drive time is ignored by `assessFeasibility`.
   */
  readonly travelMinutes: Reading<number>;
}

export interface Feasibility {
  /** `does-not-fit` if any check is; `fits` if every check fits or is unconstrained; else `unknown`. */
  readonly verdict: Exclude<Verdict, "unconstrained">;
  readonly time: Check;
  readonly travel: Check & {
    /** Sum of the legs that could be measured. */
    readonly straightLineKm: number;
    /** Legs with no measurable distance — an end Atlas has not placed. */
    readonly unmeasuredLegs: number;
  };
  readonly schedule: Check;
  readonly budget: Check;
  readonly party: Check;
}

export const NO_ROUTING =
  "No routing provider — distances are straight-line, not drive times.";

const STRAIGHT_LINE = { by: "plan", method: "haversine" } as const;

const pointOf = (moment: SubjectMoment): AdventurePoint | undefined =>
  moment.point.state === "known" ? moment.point.value : undefined;

const round1 = (km: number) => Math.round(km * 10) / 10;

const subjectMoments = (adventure: Adventure): SubjectMoment[] =>
  adventure.moments.filter((m): m is SubjectMoment => m.kind === "subject");

/**
 * **The hops of the day, in order**, from the origin where one is placed.
 *
 * Free moments have no place and are stepped over. A hop from or to a subject
 * Atlas has not placed is `unknown` — the next hop does not pretend the
 * person is still standing at the last place that had coordinates.
 */
export function legsOf(adventure: Adventure): Leg[] {
  const legs: Leg[] = [];
  const origin = adventure.constraints.origin?.point;
  let previous: { id: string; point?: AdventurePoint } | undefined = origin
    ? { id: "origin", point: origin }
    : undefined;

  for (const moment of subjectMoments(adventure)) {
    const here = pointOf(moment);
    if (previous) {
      legs.push({
        from: previous.id,
        to: moment.id,
        straightLineKm:
          previous.point && here
            ? {
                state: "known",
                value: round1(distanceKm(previous.point, here)),
                source: STRAIGHT_LINE,
              }
            : {
                state: "unknown",
                because: "One end of this hop has no location in Atlas.",
              },
        travelMinutes: { state: "unknown", because: NO_ROUTING },
      });
    }
    previous = { id: moment.id, ...(here ? { point: here } : {}) };
  }
  return legs;
}

const routedMinutes = (leg: Leg): number | undefined =>
  leg.travelMinutes.state === "known" &&
  leg.travelMinutes.source.by === "routing"
    ? leg.travelMinutes.value
    : undefined;

function timeCheck(adventure: Adventure): Check {
  const available = availableMinutes(adventure.constraints.time);
  const planned = adventure.moments.reduce((sum, m) => sum + m.minutes, 0);
  if (available === undefined) {
    return {
      verdict: "unconstrained",
      because: `${planned} minutes set aside; no time limit was given.`,
    };
  }
  if (planned > available) {
    return {
      verdict: "does-not-fit",
      because: `${planned} minutes of stops in ${available} minutes available.`,
    };
  }
  return {
    verdict: "fits",
    because: `${planned} of ${available} minutes set aside for stops.`,
  };
}

function travelCheck(
  adventure: Adventure,
  legs: readonly Leg[],
): Feasibility["travel"] {
  const measured = legs.flatMap((l) =>
    l.straightLineKm.state === "known" ? [l.straightLineKm.value] : [],
  );
  const straightLineKm = round1(measured.reduce((a, b) => a + b, 0));
  const unmeasuredLegs = legs.length - measured.length;
  const summary = { straightLineKm, unmeasuredLegs };

  const { origin, withinKm } = adventure.constraints;
  if (origin?.point && withinKm !== undefined) {
    for (const moment of subjectMoments(adventure)) {
      const here = pointOf(moment);
      if (!here) continue;
      const km = round1(distanceKm(origin.point, here));
      if (km > withinKm) {
        return {
          verdict: "does-not-fit",
          because: `${moment.label} is ${km} km from ${origin.name} in a straight line — past the ${withinKm} km you gave, and no road is shorter.`,
          ...summary,
        };
      }
    }
  }

  // A hop needs travel time unless it is measured as zero distance.
  const needsTime = legs.filter(
    (l) =>
      !(l.straightLineKm.state === "known" && l.straightLineKm.value === 0),
  );
  const unrouted = needsTime.filter((l) => routedMinutes(l) === undefined);
  const routed = needsTime.reduce((sum, l) => sum + (routedMinutes(l) ?? 0), 0);

  const available = availableMinutes(adventure.constraints.time);
  if (available !== undefined) {
    const planned = adventure.moments.reduce((sum, m) => sum + m.minutes, 0);
    const slack = available - planned - routed;
    if (slack < 0) {
      return {
        verdict: "does-not-fit",
        because: `Stops and routed travel need ${planned + routed} of ${available} minutes.`,
        ...summary,
      };
    }
    if (slack === 0 && unrouted.length > 0) {
      return {
        verdict: "does-not-fit",
        because: "No minutes are left for travelling between stops.",
        ...summary,
      };
    }
    if (unrouted.length > 0) {
      return {
        verdict: "unknown",
        because: `${slack} minutes left for ${straightLineKm} km of straight-line travel${unmeasuredLegs ? ` and ${unmeasuredLegs} unmeasured hop${unmeasuredLegs === 1 ? "" : "s"}` : ""}. ${NO_ROUTING}`,
        ...summary,
      };
    }
    return {
      verdict: "fits",
      because:
        needsTime.length === 0
          ? "No travel between stops."
          : `${routed} routed minutes on the road, inside the time left.`,
      ...summary,
    };
  }

  if (withinKm === undefined) {
    return {
      verdict: "unconstrained",
      because: `${straightLineKm} km of straight-line travel; no time or distance limit was given.`,
      ...summary,
    };
  }
  const unplaced = subjectMoments(adventure).filter((m) => !pointOf(m));
  if (!origin?.point || unplaced.length > 0) {
    return {
      verdict: "unknown",
      because: origin?.point
        ? `Atlas has no location for ${unplaced.map((m) => m.label).join(", ")}, so the ${withinKm} km limit cannot be checked.`
        : `There is no starting point to measure the ${withinKm} km limit from.`,
      ...summary,
    };
  }
  return {
    verdict: "fits",
    because: `Every stop is inside ${withinKm} km of ${origin.name} in a straight line.`,
    ...summary,
  };
}

function scheduleCheck(adventure: Adventure): Check {
  const on = adventure.constraints.time.on;
  if (!on) return { verdict: "unknown", because: "No day was chosen." };
  const unclear: string[] = [];
  for (const moment of subjectMoments(adventure)) {
    const open = moment.open;
    if (open.state === "known" && open.value.date === on) {
      if (!open.value.open) {
        return {
          verdict: "does-not-fit",
          because: `${moment.label} is published as not open on ${on}.`,
        };
      }
      continue;
    }
    unclear.push(moment.label);
  }
  if (unclear.length === 0) {
    return {
      verdict: "fits",
      because: `Every stop is published as open on ${on}.`,
    };
  }
  return {
    verdict: "unknown",
    because: `Nothing published says whether ${unclear.join(", ")} ${unclear.length === 1 ? "is" : "are"} open on ${on}.`,
  };
}

function budgetCheck(adventure: Adventure): Check {
  const max = adventure.constraints.budget?.maxDollars;
  if (max === undefined) {
    return { verdict: "unconstrained", because: "No budget was given." };
  }
  let known = 0;
  const unpriced: string[] = [];
  for (const moment of subjectMoments(adventure)) {
    const dollars =
      moment.cost.state === "known" ? moment.cost.value.dollars : undefined;
    if (dollars === undefined) unpriced.push(moment.label);
    else known += dollars;
  }
  if (known > max) {
    return {
      verdict: "does-not-fit",
      because: `Published prices already come to $${known}, over $${max}.`,
    };
  }
  if (unpriced.length > 0) {
    return {
      verdict: "unknown",
      because: `No total for the party is published for ${unpriced.join(", ")}.`,
    };
  }
  return {
    verdict: "fits",
    because: `Published prices come to $${known} of $${max}.`,
  };
}

function partyCheck(adventure: Adventure): Check {
  const { companions, needs } = adventure.constraints.party;
  const ages = companions.flatMap((c) =>
    c.role === "child" && c.age !== undefined ? [c.age] : [],
  );
  if (ages.length === 0 && needs.length === 0) {
    return {
      verdict: "unconstrained",
      because: "No ages or needs were given.",
    };
  }
  const unclear: string[] = [];
  for (const moment of subjectMoments(adventure)) {
    for (const age of ages) {
      const reading = moment.suitability;
      if (reading?.state === "known" && reading.value.age === age) {
        if (reading.value.verdict === "excluded") {
          return {
            verdict: "does-not-fit",
            because: `${moment.label} states a rule against ${age}-year-olds.`,
          };
        }
        continue;
      }
      unclear.push(`${moment.label} (age ${age})`);
    }
  }
  if (needs.length > 0) {
    return {
      verdict: "unknown",
      because: `Passport cannot check ${needs.map((n) => `"${n}"`).join(", ")} against what Atlas knows.`,
    };
  }
  if (unclear.length > 0) {
    return {
      verdict: "unknown",
      because: `Atlas states nothing for ${unclear.join(", ")}.`,
    };
  }
  return {
    verdict: "fits",
    because: "No stop states a rule against anyone coming.",
  };
}

/** Check the day against everything the person said, from evidence alone. */
export function assessFeasibility(
  adventure: Adventure,
  legs: readonly Leg[] = legsOf(adventure),
): Feasibility {
  const time = timeCheck(adventure);
  const travel = travelCheck(adventure, legs);
  const schedule = scheduleCheck(adventure);
  const budget = budgetCheck(adventure);
  const party = partyCheck(adventure);
  const verdicts = [time, travel, schedule, budget, party].map(
    (c) => c.verdict,
  );
  const verdict = verdicts.includes("does-not-fit")
    ? "does-not-fit"
    : verdicts.every((v) => v === "fits" || v === "unconstrained")
      ? "fits"
      : "unknown";
  return { verdict, time, travel, schedule, budget, party };
}
