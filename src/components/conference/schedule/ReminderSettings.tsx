"use client";

import { Bell } from "lucide-react";
import { useSyncExternalStore } from "react";
import { LEADS, type Lead } from "@/domain/conference/sessionReminders";
import { useMySchedule } from "./mySchedule";

const noop = () => () => {};

/**
 * **"Remind me before sessions: 15 minutes."** One choice for every line
 * (breaks excepted), on this device. What it reaches is said beside it:
 * a banner while Conference is open, a notification from that open tab if
 * the browser allows, and alarms in any calendar file exported after.
 */
export function ReminderSettings({
  conferenceId,
  full = false,
}: {
  conferenceId: string;
  /** The longer version, with the device switch and what it reaches. */
  full?: boolean;
}) {
  const s = useMySchedule(conferenceId);
  const canNotify = useSyncExternalStore(
    noop,
    () => "Notification" in window,
    () => false,
  );
  return (
    <div className="shrink-0" data-testid="reminder-settings">
      <label className="border-cf-line text-cf-ink inline-flex min-h-11 items-center gap-2 rounded-full border bg-white pr-2 pl-3.5 text-[13px] font-semibold">
        <Bell aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
        <span>Reminders</span>
        <select
          className="cursor-pointer bg-transparent font-semibold outline-none"
          value={s.prefs.lead}
          onChange={(e) => s.setLead(Number(e.target.value) as Lead)}
          data-testid="reminder-lead"
          aria-label="Remind me before each session"
        >
          {LEADS.map((n) => (
            <option key={n} value={n}>
              {n ? `${n} min before` : "Off"}
            </option>
          ))}
        </select>
      </label>
      {full ? (
        <div className="text-cf-slate mt-3 space-y-2 text-[13px] leading-relaxed">
          <p>
            Applies to every session, meal and evening on the agenda — not to
            breaks. Change any single one from its own card. Saved on this
            device only.
          </p>
          <p>
            <strong className="text-cf-ink">What actually reaches you:</strong>{" "}
            a reminder at the top of Conference while it&apos;s open, and the
            alarms in any calendar file you add after choosing (Apple Calendar
            and Outlook keep them; Google Calendar uses its own). Passport
            can&apos;t notify a closed app.
          </p>
          {canNotify ? (
            <label className="text-cf-ink flex min-h-11 items-center gap-3 text-[14px]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#17181b]"
                checked={s.notify}
                onChange={async (e) => {
                  if (!e.target.checked) return s.setNotify(false);
                  const p = await Notification.requestPermission();
                  s.setNotify(p === "granted");
                }}
                data-testid="reminder-notify"
              />
              Also show a notification while Conference is open in a tab
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
