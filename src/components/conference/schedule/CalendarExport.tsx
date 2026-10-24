"use client";

import { CalendarPlus } from "lucide-react";
import { calendarHref, useMySchedule } from "./mySchedule";

const link =
  "border-cf-line text-cf-ink hover:border-cf-ink/30 inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-3.5 text-[13px] font-semibold transition";

/**
 * Add the agenda to a calendar: this day, the whole event, or what you
 * saved. Standard `.ics` files — Apple Calendar, Google Calendar and Outlook
 * all open them — carrying the reminders chosen here as alarms.
 */
export function CalendarExport({
  conferenceId,
  dayIds,
  dayLabel,
  mineOnly = false,
}: {
  conferenceId: string;
  dayIds?: readonly string[];
  dayLabel?: string;
  /** Only "my schedule" (on that view). */
  mineOnly?: boolean;
}) {
  const s = useMySchedule(conferenceId);
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2"
      data-testid="calendar-export"
    >
      {mineOnly ? (
        s.saved.length ? (
          <a
            href={calendarHref(conferenceId, s.prefs, s.saved)}
            className={link}
            download
            data-testid="export-mine"
          >
            <CalendarPlus
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={1.8}
            />
            Add my schedule to calendar
          </a>
        ) : null
      ) : (
        <>
          <a
            href={calendarHref(conferenceId, s.prefs)}
            className={link}
            download
            data-testid="export-all"
          >
            <CalendarPlus
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={1.8}
            />
            Add all to calendar
          </a>
          {dayIds?.length ? (
            <a
              href={calendarHref(conferenceId, s.prefs, dayIds)}
              className={link}
              download
              data-testid="export-day"
            >
              {dayLabel ?? "This day"}
            </a>
          ) : null}
        </>
      )}
    </div>
  );
}
