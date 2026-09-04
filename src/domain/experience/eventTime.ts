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
const ZONE = "America/Vancouver";

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

/**
 * One line: `Sat, Sep 12, 2026 · 6:00 p.m. – 10:00 p.m.`, or with both dates
 * when it spans days. Returns undefined when there is nothing to say, so a
 * caller renders no date rather than an empty one.
 */
export function formatEventWhen(
  startTime: string | undefined,
  endTime: string | undefined,
): string | undefined {
  if (!startTime) return undefined;
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return undefined;
  if (!endTime) return `${day.format(start)} · ${clock.format(start)}`;

  const end = new Date(endTime);
  if (Number.isNaN(end.getTime()))
    return `${day.format(start)} · ${clock.format(start)}`;

  const sameDay = day.format(start) === day.format(end);
  return sameDay
    ? `${day.format(start)} · ${clock.format(start)} – ${clock.format(end)}`
    : `${day.format(start)} ${clock.format(start)} – ${day.format(end)} ${clock.format(end)}`;
}
