/**
 * **Date Night's music.** Which moods from the Passport Soundtrack suit
 * tonight's plan: always a romantic drive and the sunset; the backroads and
 * the mountain when the night goes up a forest road or to a lake; the
 * road-trip classics when there's real time in the car.
 *
 * Pure.
 */

import type { Mood } from "@/domain/soundtrack/moods";
import type { Theme } from "./plays";

export function nightMoods(
  themes: ReadonlySet<Theme>,
  driveMinutes: number,
): Mood[] {
  const out: Mood[] = ["romantic-drive"];
  if (themes.has("hunt") || themes.has("fire")) out.push("country-backroads");
  if (themes.has("lake") || themes.has("hunt") || themes.has("swim"))
    out.push("mountain");
  out.push("sunset");
  if (driveMinutes >= 25) out.push("road-trip");
  return out;
}

/** Minutes in the car tonight: every drive in the plan, there and back. */
export const driveOf = (stops: readonly { travel: number }[]): number =>
  stops.reduce((sum, s) => sum + Math.max(0, s.travel), 0);
