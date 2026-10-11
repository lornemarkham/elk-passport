import type { Experience } from "@/domain/experience/types";
import { ageEvidence } from "./suitability";
import { arguesAgainst, standsUpToRain } from "./environment";

/**
 * **Soft preferences: what the answers lift and lower, never remove.**
 *
 * Discovery's answers come in three strengths, and this file holds only the
 * middle one:
 *
 * ```
 * hard      a stated rule against this age; stated hours, season or dates
 *           that leave the chosen day out; outside the chosen radius
 *           → removed (DiscoveryListView `answering`)
 * soft      a stated welcome for this age; stated hours that cover the day;
 *           Atlas reading a place as sheltered on a wet day — or as out in
 *           the open on one
 *           → reordered here, nothing removed
 * unknown   Atlas says nothing either way — 90% of the corpus for age,
 *           80% for hours, 93% for rain
 *           → left exactly where it was
 * ```
 *
 * A stable sort on a small integer, so everything Atlas is silent about keeps
 * the order it arrived in (picture first, nearest first) and only subjects
 * with real evidence move. Nothing here is a score anybody sees.
 */
export interface Preferences {
  /** The age somebody named, so Atlas's verdict for it can count. */
  readonly age?: number;
  /** Whether the forecast for the day on screen is wet. */
  readonly wet?: boolean;
  /** Whether a day was chosen, so stated hours covering it can count. */
  readonly day?: boolean;
}

export function preferenceOf(
  experience: Experience,
  { age, wet, day }: Preferences,
): number {
  let score = 0;
  if (age !== undefined) {
    const { verdict } = ageEvidence(experience, age);
    if (verdict === "welcome") score += 2;
    else if (verdict === "described" || verdict === "priced") score += 1;
  }
  if (day && experience.schedule?.onDate?.reading === "on") score += 1;
  if (wet) {
    // The case the brief names: lake swimming on a rainy October day sinks
    // when Atlas reads the place as out in the open, and only then.
    if (standsUpToRain(experience)) score += 2;
    else if (arguesAgainst(experience)) score -= 3;
  }
  return score;
}

export function byPreference(
  experiences: readonly Experience[],
  preferences: Preferences,
): readonly Experience[] {
  if (preferences.age === undefined && !preferences.wet && !preferences.day) {
    return experiences;
  }
  return experiences
    .map((experience, index) => ({
      experience,
      index,
      score: preferenceOf(experience, preferences),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.experience);
}

/**
 * **What a chosen day rules out, in Atlas's words.** Stated hours that leave
 * the weekday out, a stated season that has ended, a held interval the day
 * falls outside. `conflicting` and `unknown` rule out nothing.
 */
export const statedNotOn = (experience: Experience): boolean =>
  experience.schedule?.onDate?.reading === "not-on";

/** The line a card prints about the chosen day, where Atlas has one. */
export function dayLine(experience: Experience): string | undefined {
  const reading = experience.schedule?.onDate?.reading;
  if (reading === "on" && experience.schedule?.onDate?.basis === "stated-hours")
    return "Open that day, by its stated hours";
  if (reading === "conflicting") return "Its stated hours disagree — check";
  return undefined;
}
