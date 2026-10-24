"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  sessionRemindersFor,
  type SessionReminder,
} from "@/domain/conference/sessionReminders";
import type { AgendaKind } from "@/domain/conference/types";
import { wrap } from "../kit";
import { useMySchedule } from "./mySchedule";
import { useNow } from "./useNow";

const DISMISSED = (c: string) => `conference-session-reminders-dismissed:${c}`;
const SHOWN = (c: string) => `conference-session-reminders-notified:${c}`;

const readSet = (key: string): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
};
const writeSet = (key: string, s: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify([...s].slice(-200)));
  } catch {
    // Private mode: a reminder may show again after a reload.
  }
};

/**
 * **"General Session starts in 15 minutes. Head to the ballroom."** At the
 * top of every Conference tab, for the lines the person asked to be reminded
 * of (`ReminderSettings`), from the lead time until just after the start.
 * Each is shown until dismissed and, if they turned it on, notified once
 * from this open tab. Nothing is scheduled anywhere else.
 */
export function SessionReminders({
  conferenceId,
  timeZone,
  serverNow,
  items,
}: {
  conferenceId: string;
  timeZone: string;
  serverNow: string;
  items: readonly {
    id: string;
    day: string;
    title: string;
    where?: string;
    kind?: AgendaKind;
    startsAt: string;
  }[];
}) {
  const now = useNow(serverNow, 20_000);
  const s = useMySchedule(conferenceId);
  // Nothing shows before the browser's own choices are read (the server
  // knows none), so reading storage on the first client render is safe.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() =>
    typeof window === "undefined"
      ? new Set()
      : readSet(DISMISSED(conferenceId)),
  );

  const due: SessionReminder[] = sessionRemindersFor(
    items,
    s.prefs,
    now,
    timeZone,
  ).filter((r) => !dismissed.has(r.key));

  const keys = due.map((r) => r.key).join("|");
  useEffect(() => {
    if (!s.notify || !keys) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const shown = readSet(SHOWN(conferenceId));
    for (const r of due)
      if (!shown.has(r.key)) {
        shown.add(r.key);
        try {
          new Notification(r.title, { body: r.body, tag: r.key });
        } catch {
          // Some phones only notify from a service worker; the banner stands.
        }
      }
    writeSet(SHOWN(conferenceId), shown);
    // `due` is derived from `keys`; re-running on it alone is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, s.notify, conferenceId]);

  if (!due.length) return null;
  const dismiss = (key: string) => {
    const d = readSet(DISMISSED(conferenceId));
    d.add(key);
    writeSet(DISMISSED(conferenceId), d);
    setDismissed(new Set(d));
  };
  return (
    <div className={`${wrap} pt-3`} data-testid="session-reminders">
      {due.slice(0, 2).map((r) => (
        <div
          key={r.key}
          role="status"
          className="cf-rise border-cf-line border-l-cf-sage mt-2 flex items-start justify-between gap-3 rounded-2xl border border-l-[3px] bg-white p-4 shadow-[0_8px_24px_-18px_rgba(23,24,27,0.5)]"
          data-testid="session-reminder-banner"
        >
          <Link
            href={`/conferences/${conferenceId}/schedule/${r.id}`}
            className="min-w-0"
          >
            <span className="cf-eyebrow text-cf-sage block">Coming up</span>
            <span className="text-cf-ink mt-1 block text-[16px] font-semibold">
              {r.title}
            </span>
            <span className="text-cf-slate text-[14px]">{r.body}</span>
          </Link>
          <button
            type="button"
            onClick={() => dismiss(r.key)}
            className="text-cf-slate hover:text-cf-ink min-h-11 shrink-0 px-2 text-[14px] font-semibold"
          >
            Got it
          </button>
        </div>
      ))}
    </div>
  );
}
