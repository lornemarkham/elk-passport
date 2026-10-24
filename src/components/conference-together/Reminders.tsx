"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  remindersFor,
  type Reminder,
} from "@/domain/conference-plans/reminders";
import type { PlansBoard } from "@/lib/conference-plans/service";

/**
 * **"Morning walk starts in 30 minutes."** — on the page, and, if the person
 * asks for it on this device, as a notification.
 *
 * What exists and what doesn't, said plainly: Passport has no push service
 * (no service worker, no web push keys, no email reminders; nothing in the
 * repository sends a message to a closed app). So a reminder reaches a
 * person while Conference is open in a tab or on their phone's screen. The
 * banner covers the open page; "Remind me on this device" adds a system
 * notification from that open tab, once per reminder.
 *
 * Never twice: every reminder has a stable key (`<occurrence>:today|soon`).
 * Keys already shown or dismissed are kept in this browser, so a reload, a
 * second tab or the next poll doesn't repeat one. Only plans the person said
 * _I'm in_ to remind at all (`remindersFor`).
 */
const SEEN = (c: string) => `conference-reminders-seen:${c}`;
const DISMISSED = (c: string) => `conference-reminders-dismissed:${c}`;
const NOTIFY = (c: string) => `conference-reminders-notify:${c}`;

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
    // Private mode: reminders may repeat on reload. Nothing else breaks.
  }
};

const subscribeStorage = (change: () => void) => {
  window.addEventListener("storage", change);
  return () => window.removeEventListener("storage", change);
};

export function Reminders({
  conferenceId,
  controls = true,
}: {
  conferenceId: string;
  /** Show the "remind me on this device" switch (Plans, your profile). */
  controls?: boolean;
}) {
  const [due, setDue] = useState<Reminder[]>([]);
  const [, bump] = useState(0);
  // Read from the browser on every render; the server shows no toggle.
  const notify = useSyncExternalStore(
    subscribeStorage,
    () =>
      typeof Notification === "undefined"
        ? "unsupported"
        : localStorage.getItem(NOTIFY(conferenceId)) === "on" &&
            Notification.permission === "granted"
          ? "on"
          : "off",
    () => "unsupported",
  );

  useEffect(() => {
    let board: PlansBoard | null = null;
    let live = true;
    const load = async () => {
      if (document.visibilityState !== "visible" && board) return;
      try {
        const r = await fetch(`/api/conferences/${conferenceId}/plans`, {
          cache: "no-store",
        });
        if (r.ok) board = ((await r.json()) as { board: PlansBoard }).board;
      } catch {
        // Keep the last board.
      }
    };
    const check = () => {
      if (!board || !live) return;
      const now = new Date();
      const all = remindersFor(board.plans, now, board.timeZone);
      const dismissed = readSet(DISMISSED(conferenceId));
      setDue(all.filter((r) => !dismissed.has(r.key)));
      // A system notification at most once per reminder, ever, per browser.
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        localStorage.getItem(NOTIFY(conferenceId)) === "on"
      ) {
        const seen = readSet(SEEN(conferenceId));
        for (const r of all)
          if (!seen.has(r.key)) {
            seen.add(r.key);
            try {
              new Notification(r.title, { body: r.body, tag: r.key });
            } catch {
              // Some phones only notify from a service worker; the banner stands.
            }
          }
        writeSet(SEEN(conferenceId), seen);
      }
    };
    void load().then(check);
    const poll = window.setInterval(() => void load().then(check), 60_000);
    const tick = window.setInterval(check, 20_000);
    return () => {
      live = false;
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [conferenceId]);

  const dismiss = (key: string) => {
    const d = readSet(DISMISSED(conferenceId));
    d.add(key);
    writeSet(DISMISSED(conferenceId), d);
    setDue((x) => x.filter((r) => r.key !== key));
  };

  return (
    <div data-testid="reminders">
      {due.map((r) => (
        <div
          key={r.key}
          role="status"
          className="cf-rise border-cf-line border-l-cf-brass mt-4 flex items-start justify-between gap-3 rounded-2xl border border-l-[3px] bg-white p-4 shadow-[0_1px_2px_rgba(23,24,27,0.05)]"
          data-testid="reminder"
        >
          <span>
            <span className="cf-eyebrow text-cf-brass block">Reminder</span>
            <span className="text-cf-ink mt-1 block text-[16px] font-semibold">
              {r.title}
            </span>
            <span className="text-cf-slate text-[14px]">{r.body}</span>
          </span>
          <button
            type="button"
            onClick={() => dismiss(r.key)}
            className="text-cf-slate hover:text-cf-ink min-h-11 shrink-0 px-2 text-[14px] font-semibold"
            aria-label="Got it"
          >
            Got it
          </button>
        </div>
      ))}
      {!controls ? null : notify === "off" ? (
        <button
          type="button"
          className="text-cf-slate mt-3 min-h-11 text-[14px] underline underline-offset-4"
          onClick={async () => {
            const p = await Notification.requestPermission();
            if (p === "granted") {
              localStorage.setItem(NOTIFY(conferenceId), "on");
              bump((n) => n + 1);
            }
          }}
        >
          Remind me on this device (while Conference is open)
        </button>
      ) : notify === "on" ? (
        <button
          type="button"
          className="text-cf-slate mt-3 min-h-11 text-[14px] underline underline-offset-4"
          onClick={() => {
            localStorage.removeItem(NOTIFY(conferenceId));
            bump((n) => n + 1);
          }}
        >
          Reminders on this device: on · turn off
        </button>
      ) : null}
    </div>
  );
}
