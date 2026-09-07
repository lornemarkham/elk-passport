import type { ExperienceDefinition, Phase } from "./types";

/**
 * Which phase the experience is in, and what that means for the page.
 *
 * Phases are declared as offsets from the anchor rather than as absolute
 * times so a fixture stays alive forever — a hockey night written in
 * September is still "four days out" whenever you open it, because the lab
 * anchors it to a date that keeps moving. That is a lab convenience, and the
 * seam where a real event's real time would arrive from Atlas.
 */

export function phaseTimes(
  definition: ExperienceDefinition,
): { phase: Phase; at: Date }[] {
  const anchor = new Date(definition.anchorAt).getTime();
  return definition.phases.map((phase) => ({
    phase,
    at: new Date(anchor + phase.offsetMinutes * 60_000),
  }));
}

/** The last phase whose time has arrived. Never undefined: the first phase is the floor. */
export function activePhase(
  definition: ExperienceDefinition,
  now: Date,
): Phase {
  const times = phaseTimes(definition);
  let current = times[0].phase;
  for (const { phase, at } of times) {
    if (at.getTime() <= now.getTime()) current = phase;
  }
  return current;
}

export function phaseIndex(
  definition: ExperienceDefinition,
  phaseId: string,
): number {
  return definition.phases.findIndex((p) => p.id === phaseId);
}

/** Has `phaseId` begun by `now`? Used for locking. */
export function phaseReached(
  definition: ExperienceDefinition,
  phaseId: string,
  now: Date,
): boolean {
  const target = phaseIndex(definition, phaseId);
  if (target < 0) return false;
  return phaseIndex(definition, activePhase(definition, now).id) >= target;
}

/**
 * "in 3 days", "in 2 hours", "starting now", "2 hours ago".
 *
 * A countdown is not decoration here. The gap between now and the anchor is
 * the single strongest source of anticipation the product has, and it costs
 * nothing — which is why it sits in the poster rather than in a widget.
 */
export function relativeTime(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  const abs = Math.abs(ms);
  if (abs < 60_000) return "right now";

  // The unit is chosen from the true magnitude, then rounded. Rounding first
  // turned thirteen hours into "1 day", which is the sort of small lie that
  // makes a countdown untrustworthy.
  const amount =
    abs >= 86_400_000
      ? plural(Math.round(abs / 86_400_000), "day")
      : abs >= 3_600_000
        ? plural(Math.round(abs / 3_600_000), "hour")
        : plural(Math.round(abs / 60_000), "minute");
  return ms > 0 ? `in ${amount}` : `${amount} ago`;
}

function plural(count: number, unit: string): string {
  return `${count} ${count === 1 ? unit : `${unit}s`}`;
}
