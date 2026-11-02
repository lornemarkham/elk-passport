/**
 * **"Tonight, just us."** The night's title, said the way the two of you
 * would say it: from the day it is and when you leave. An afternoon start is
 * an afternoon, not a night (mission 495); before an adventure is chosen
 * there is no leave time, so it is just the day. No names: those are shown
 * beside it, from the people actually on the adventure.
 */

const WEEKDAY = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  timeZone: "UTC",
});

type Part = "morning" | "afternoon" | "evening";

function partOf(leaveAt: number | undefined): Part | undefined {
  if (leaveAt === undefined) return undefined;
  if (leaveAt < 12 * 60) return "morning";
  if (leaveAt < 17 * 60) return "afternoon";
  return "evening";
}

/** "Tonight", "This afternoon", "Tomorrow night", "Monday", "That night". */
export function whenSaid(on: string, today: string, leaveAt?: number): string {
  const days = Math.round(
    (Date.parse(`${on}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86_400_000,
  );
  const part = partOf(leaveAt);
  const suffix = part === "evening" ? " night" : part ? ` ${part}` : "";
  if (days < 0)
    return part === "evening"
      ? "That night"
      : part
        ? `That ${part}`
        : "That day";
  if (days === 0)
    return part === "evening" ? "Tonight" : part ? `This ${part}` : "Today";
  if (days === 1) return `Tomorrow${suffix}`;
  if (days < 7)
    return `${WEEKDAY.format(new Date(`${on}T12:00:00Z`))}${suffix}`;
  return "One day soon";
}

/** "Tonight, just us." */
export const justUs = (on: string, today: string, leaveAt?: number): string =>
  `${whenSaid(on, today, leaveAt)}, just us`;

/** "Lorne & Jess", or nothing when nobody has a name yet. */
export function namesOf(
  names: readonly (string | null | undefined)[],
): string | null {
  const known = names.filter((n): n is string => Boolean(n && n.trim()));
  if (known.length === 0) return null;
  if (known.length === 1) return known[0]!;
  return `${known.slice(0, -1).join(", ")} & ${known[known.length - 1]}`;
}
