"use client";

import { Bell, BellOff, CalendarPlus, Star } from "lucide-react";
import {
  LEADS,
  leadFor,
  type Lead,
} from "@/domain/conference/sessionReminders";
import type { AgendaKind } from "@/domain/conference/types";
import { calendarHref, useMySchedule } from "./mySchedule";

const chip =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition active:scale-[0.98]";

/**
 * Save, remind, add to calendar — for one published line. Everything is the
 * person's own choice on this device (`useMySchedule`).
 */
export function SessionActions({
  conferenceId,
  id,
  kind,
  title,
  dark = false,
  past = false,
}: {
  conferenceId: string;
  id: string;
  kind?: AgendaKind;
  title: string;
  /** On a charcoal card. */
  dark?: boolean;
  /** Already over: no reminder to set. */
  past?: boolean;
}) {
  const s = useMySchedule(conferenceId);
  const saved = s.isSaved(id);
  const effective = leadFor({ id, kind }, s.prefs);
  const tone = dark
    ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
    : "border-cf-line bg-white text-cf-ink hover:border-cf-ink/30";
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="session-actions"
    >
      <button
        type="button"
        className={`${chip} ${saved ? (dark ? "border-[#e2cc9f]/60 bg-[#e2cc9f]/20 text-white" : "border-cf-brass/50 bg-[#fbf3e3] text-[#7a5a28]") : tone}`}
        aria-pressed={saved}
        onClick={() => s.toggle(id)}
        data-testid="save-session"
      >
        <Star
          aria-hidden="true"
          className="h-4 w-4"
          strokeWidth={1.8}
          fill={saved ? "currentColor" : "none"}
        />
        {saved ? "In my schedule" : "Save"}
      </button>
      {past ? null : (
        <label
          className={`${chip} ${tone} relative cursor-pointer pr-2`}
          title="Reminder for this one"
        >
          {effective ? (
            <Bell aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
          ) : (
            <BellOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
          )}
          <span className="sr-only">Reminder for {title}</span>
          <select
            className="cursor-pointer appearance-none bg-transparent pr-1 font-semibold outline-none"
            value={String(effective)}
            onChange={(e) => {
              const n = Number(e.target.value) as Lead;
              // Choosing what the default would give anyway clears the override.
              const byDefault = leadFor(
                { id, kind },
                { ...s.prefs, overrides: {} },
              );
              s.setOverride(id, n === byDefault ? null : n);
            }}
            data-testid="session-reminder"
          >
            {LEADS.map((n) => (
              <option key={n} value={n}>
                {n ? `Remind ${n} min before` : "No reminder"}
              </option>
            ))}
          </select>
        </label>
      )}
      <a
        href={calendarHref(conferenceId, s.prefs, [id])}
        className={`${chip} ${tone}`}
        data-testid="session-calendar"
        download
      >
        <CalendarPlus
          aria-hidden="true"
          className="h-4 w-4"
          strokeWidth={1.8}
        />
        Add to calendar
      </a>
    </div>
  );
}
