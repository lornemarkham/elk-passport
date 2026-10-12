/**
 * How an adventure's facts read on screen. Pure, so the wording is pinned by
 * tests rather than discovered in a browser.
 */

function dayLabel(day: string): string {
  // Calendar days are dates, not moments: format them in UTC so a day never
  // slides into the one before because of where the server happens to be.
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Sat, Oct 25", "Sat, Oct 24 – Tue, Oct 27", or null when nobody has said. */
export function whenLabel(
  startsOn: string | null,
  endsOn: string | null,
): string | null {
  if (!startsOn) return null;
  if (!endsOn || endsOn === startsOn) return dayLabel(startsOn);
  return `${dayLabel(startsOn)} – ${dayLabel(endsOn)}`;
}

/** A moment, in the adventure's own time zone when it has one. */
export function momentLabel(iso: string, timeZone: string | null): string {
  return new Date(iso).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone, timeZoneName: "short" } : {}),
  });
}

/** "2 in · 1 maybe", or "" when nobody has answered. */
export function responsesLabel(counts: {
  readonly in: number;
  readonly maybe: number;
  readonly out: number;
}): string {
  return [
    counts.in ? `${counts.in} in` : null,
    counts.maybe ? `${counts.maybe} maybe` : null,
    counts.out ? `${counts.out} out` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** What an invite link allows, in words. */
export function usesLabel(maxUses: number | null, uses: number): string {
  if (maxUses === null)
    return uses === 1 ? "Open link · 1 joined" : `Open link · ${uses} joined`;
  if (maxUses === 1) return uses >= 1 ? "Used" : "One person";
  return `${uses} of ${maxUses} used`;
}
