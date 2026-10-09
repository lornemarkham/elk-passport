/**
 * **How an event's date is written for a traveller.**
 *
 * `America/Vancouver`, deliberately hard-coded. Every entity Atlas holds is in
 * the Okanagan, and `Event.startTime` is a `Date` in Atlas, so the publisher's
 * own offset (`-0700` on O'Keefe's JSON-LD) is already gone before Passport
 * sees it — the instant is exact, the stated local time is not stored. Naming
 * the zone here means a traveller in Toronto reads Okanagan time, which is the
 * time printed on the ticket. Known debt, recorded in Atlas; building timezone
 * infrastructure today would be solving a problem no data has yet.
 */
export const ZONE = "America/Vancouver";

const day = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: ZONE,
});
const clock = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONE,
});
const ymd = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ZONE,
});
/** The same label as `day`, read off the timestamp's own UTC components. */
const statedDayLabel = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * **What Atlas knows about how precisely a publisher stated an event's time.**
 * Mirrors Atlas's `Event.timePrecision`; `undefined` is a third answer.
 */
export type TimePrecision = "day" | "minute";

/**
 * The local calendar day an **instant** falls on, as `2026-10-31`.
 *
 * For `now`, and for a timestamp whose clock a publisher actually stated. Not
 * for a date-only Event — see `statedDay`, which is what every caller reading
 * an Event's own timestamp should use.
 */
export function localDay(at: Date | string): string {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? "" : ymd.format(d);
}

/**
 * **The calendar day an event is on — the one rule, used by every surface.**
 *
 * ## The defect this exists for
 *
 * A publisher states `2026-10-24` and no time. Atlas records the instant
 * `2026-10-24T00:00:00Z` and, since 2026-09-27, records that the publisher
 * stated a *day* (`Event.timePrecision`). Passport read the instant and
 * localised it, and `2026-10-24T00:00:00Z` in `America/Vancouver` is
 * **October 23rd at 5 p.m.** — so HorrorFest XVII, stated for the 24th,
 * appeared on the 23rd, and 47 of the 86 October Events did the same. The
 * instant was never wrong; localising it was.
 *
 * ## The rule
 *
 * ```
 * 'day'      the publisher stated a calendar date. THAT date is the fact, and
 *            it lives in the timestamp's UTC components. Never converted — a
 *            date has no zone, so moving it can only be wrong.
 * 'minute'   the publisher stated a clock time. The timestamp is a real
 *            instant, so it converts to local time like any other.
 * undefined  Atlas does not know. Behaviour is unchanged from before this
 *            field existed: localised, exactly as it always was. A midnight
 *            instant is NOT read as evidence of a stated date — that inference
 *            is the very mistake `timePrecision` was introduced to stop, and
 *            the 11 legacy Events that look like this keep their behaviour
 *            until their sources are read again.
 * ```
 *
 * Nothing here knows about October, about a publisher, or about a title, and
 * the zone only appears on the branch where an instant genuinely has one. A
 * viewer in Tokyo sees the same stated date as a viewer in Vancouver, which is
 * the whole point of a date.
 */
export function statedDay(
  at: Date | string | undefined,
  precision?: TimePrecision,
): string {
  if (at === undefined) return "";
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return precision === "day" ? d.toISOString().slice(0, 10) : localDay(d);
}

/**
 * One line: `Sat, Sep 12, 2026 · 6:00 p.m. – 10:00 p.m.`, or with both dates
 * when it spans days. Returns undefined when there is nothing to say, so a
 * caller renders no date rather than an empty one.
 */
export function formatEventWhen(
  startTime: string | undefined,
  endTime: string | undefined,
  precision?: TimePrecision,
): string | undefined {
  if (!startTime) return undefined;
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return undefined;

  // **A publisher who printed no time has none to show.** Printing one anyway
  // was how a date-only Event came to read `Fri, Oct 23, 2026 · 5:00 p.m.` — a
  // day early and an hour nobody stated. The date comes off the UTC components
  // for the reason `statedDay` gives, and no clock is invented.
  if (precision === "day") {
    const end = endTime ? new Date(endTime) : undefined;
    const sameDay =
      !end ||
      Number.isNaN(end.getTime()) ||
      statedDay(start, "day") === statedDay(end, "day");
    return sameDay
      ? statedDayLabel.format(start)
      : `${statedDayLabel.format(start)} – ${statedDayLabel.format(end!)}`;
  }

  if (!endTime) return `${day.format(start)} · ${clock.format(start)}`;

  const end = new Date(endTime);
  if (Number.isNaN(end.getTime()))
    return `${day.format(start)} · ${clock.format(start)}`;

  // **An interval that ends when it starts is a start time, not a range.**
  // Atlas stores an Event whose publisher stated only a start as `startTime`
  // equal to `endTime`, so Urge/Detour read `Fri, Oct 9, 2026 · 7:30 p.m. –
  // 7:30 p.m.` — which looks like a bug in the page rather than a show that
  // begins at half past seven.
  if (start.getTime() === end.getTime())
    return `${day.format(start)} · ${clock.format(start)}`;

  const sameDay = day.format(start) === day.format(end);
  return sameDay
    ? `${day.format(start)} · ${clock.format(start)} – ${clock.format(end)}`
    : `${day.format(start)} ${clock.format(start)} – ${day.format(end)} ${clock.format(end)}`;
}
