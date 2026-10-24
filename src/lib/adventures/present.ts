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

export type AdventureStage = "today" | "upcoming" | "draft" | "done";

/** Where an adventure is, from its dates and its plan. */
export interface AdventureStatus {
  readonly stage: AdventureStage;
  /** "Today", "In 3 days · 2 to decide", "Planned", "Just ideas", "Done". */
  readonly label: string;
}

const daysApart = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

/**
 * **What state an adventure is in, said plainly.** Dates decide the stage —
 * on now, coming, or over — and the plan decides the rest: stops nobody has
 * kept yet are "to decide"; no stops at all is "just ideas".
 */
export function adventureStatus(
  dates: { readonly startsOn: string | null; readonly endsOn: string | null },
  plan: { readonly stops: number; readonly undecided: number },
  today: string,
): AdventureStatus {
  const { startsOn } = dates;
  const endsOn = dates.endsOn ?? dates.startsOn;
  if (startsOn && endsOn && startsOn <= today && today <= endsOn)
    return { stage: "today", label: "Today" };
  if (endsOn && endsOn < today) return { stage: "done", label: "Done" };
  const planning =
    plan.stops === 0
      ? "Just ideas"
      : plan.undecided > 0
        ? `${plan.undecided} to decide`
        : "Planned";
  if (!startsOn) return { stage: "draft", label: `No date yet · ${planning}` };
  const away = daysApart(today, startsOn);
  const when = away === 1 ? "Tomorrow" : `In ${away} days`;
  return {
    stage: plan.stops === 0 ? "draft" : "upcoming",
    label: `${when} · ${planning}`,
  };
}

/**
 * **Your next adventure**: the soonest one that has not happened, by start
 * date (today's first); without dates, the first undated one. `null` when
 * every adventure is over.
 */
export function nextAdventure<
  T extends {
    readonly startsOn: string | null;
    readonly endsOn: string | null;
  },
>(adventures: readonly T[], today: string): T | null {
  const live = adventures.filter(
    (a) => (a.endsOn ?? a.startsOn ?? today) >= today,
  );
  const dated = live
    .filter((a) => a.startsOn)
    .sort((a, b) => a.startsOn!.localeCompare(b.startsOn!));
  return dated[0] ?? live[0] ?? null;
}

/** "about 1 h 30", "45 min" — the plan's own arithmetic, said as such. */
export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Minutes after midnight as a clock: "9:30 am". */
export function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "Saturday", for a calendar day. */
export function weekdayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-CA", {
    weekday: "long",
    timeZone: "UTC",
  });
}
