import { CalendarDays } from "lucide-react";
import { SectionShell } from "./SectionShell";
import type { PlaceSectionProps } from "./types";

/**
 * **What's on here — the Events Atlas asserts happen at this Place.**
 *
 * The one section on this page that reads `kind: "Event"`. Before it, Atlas's
 * 174 Events reached no traveller: the ones with a `happens_at` edge to a
 * Place arrived in `relatedEntities` as a bare name and nothing rendered
 * them, and the ones attached to the venue's operator never arrived. Now
 * `/detail` carries them with their dates (see `PlaceEvent`).
 *
 * **Only what is still ahead.** An event whose end has passed is a true fact
 * about the place and a useless one for someone deciding whether to go this
 * weekend, so it is not shown — the same "hide, don't explain" rule every
 * section here follows, applied to time. Nothing is inferred: no recurrence
 * ("it happened last October, so…"), no "annual". If Atlas holds a 2025
 * haunted house and no 2026 one, the page shows nothing, which is the truth.
 *
 * Dates are rendered from the publisher's stated times. `via` says the event
 * belongs to the operator rather than the ground, in the operator's name —
 * a reader should know that "Apple Harvest Fest" is Davison Orchards' event
 * at Davison Orchards, not a festival that merely happens to be nearby.
 */
export function PlaceEvents({
  events,
  now = new Date(),
}: PlaceSectionProps & { now?: Date }) {
  const upcoming = (events ?? [])
    .filter((event) => {
      const end = event.endTime
        ? new Date(event.endTime)
        : event.startTime
          ? new Date(event.startTime)
          : undefined;
      return (
        end !== undefined &&
        !Number.isNaN(end.getTime()) &&
        end >= startOfDay(now)
      );
    })
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  if (upcoming.length === 0) return null;

  return (
    <SectionShell title="What's on">
      <ul className="flex flex-col gap-3">
        {upcoming.map((event) => (
          <li key={event.id} className="flex gap-3 text-sm">
            <CalendarDays className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">{event.name}</div>
              <div className="text-muted-foreground">
                {formatRange(event.startTime, event.endTime)}
                {event.via ? ` · ${event.via.name}` : ""}
              </div>
              {event.description ? (
                <p className="mt-1">{event.description}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * "Sep 17" · "Aug 28 – Oct 1" · "Aug 28 – Oct 1, 2027" when the year is not this one.
 *
 * Rendered in the venue's own timezone, not the reader's. A publisher states
 * "September 12, 6:00 p.m." and Atlas stores the instant; a reader in London
 * looking at that instant in their own clock would see September 13. The
 * corpus is the Okanagan today and Vancouver next, both Pacific — when a
 * venue outside that zone arrives, the zone should travel with the Place.
 */
const VENUE_TIME_ZONE = "America/Vancouver";
export function formatRange(
  start?: string,
  end?: string,
  now: Date = new Date(),
): string {
  const s = start ? new Date(start) : undefined;
  const e = end ? new Date(end) : undefined;
  if (!s || Number.isNaN(s.getTime())) return "";
  const day = (d: Date) =>
    d.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      timeZone: VENUE_TIME_ZONE,
    });
  const yearOf = (d: Date) =>
    Number(
      d.toLocaleDateString("en-CA", {
        year: "numeric",
        timeZone: VENUE_TIME_ZONE,
      }),
    );
  const year = (d: Date) => (yearOf(d) === yearOf(now) ? "" : `, ${yearOf(d)}`);
  if (!e || Number.isNaN(e.getTime()) || day(e) === day(s))
    return `${day(s)}${year(s)}`;
  return `${day(s)} – ${day(e)}${year(e)}`;
}
