"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  cleanPrefs,
  type Lead,
  type ReminderPrefs,
} from "@/domain/conference/sessionReminders";

/**
 * **My Schedule and reminder choices, kept on this device.**
 *
 * The published agenda is everyone's: nobody has to save a session to know
 * where to be. Saving is a person marking what they don't want to miss, and
 * the reminder lead is how far ahead they'd like a nudge. Both live in this
 * browser's storage, keyed by conference, and nowhere else — no table, no
 * server record of who starred what (a summit's attendance is not a
 * dataset). The cost, said plainly: a second phone starts empty.
 */

interface Stored {
  readonly saved: readonly string[];
  readonly prefs: ReminderPrefs;
  /** System notifications from an open tab, when the browser allows them. */
  readonly notify: boolean;
}

const EMPTY: Stored = {
  saved: [],
  prefs: { lead: 0, overrides: {} },
  notify: false,
};
const KEY = (c: string) => `conference-schedule:${c}`;
const EVENT = "conference-schedule-change";

const cache = new Map<string, { raw: string | null; value: Stored }>();

function read(conferenceId: string): Stored {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY(conferenceId));
  } catch {
    return EMPTY;
  }
  const hit = cache.get(conferenceId);
  if (hit && hit.raw === raw) return hit.value;
  let value = EMPTY;
  try {
    const j = raw ? (JSON.parse(raw) as Partial<Stored>) : null;
    if (j)
      value = {
        saved: Array.isArray(j.saved)
          ? j.saved.filter(
              (s): s is string =>
                typeof s === "string" && /^[\w-]{1,24}$/.test(s),
            )
          : [],
        prefs: cleanPrefs(j.prefs),
        notify: j.notify === true,
      };
  } catch {
    value = EMPTY;
  }
  cache.set(conferenceId, { raw, value });
  return value;
}

function write(conferenceId: string, next: Stored) {
  try {
    localStorage.setItem(KEY(conferenceId), JSON.stringify(next));
  } catch {
    // Private mode: the choice lasts this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (change: () => void) => {
  window.addEventListener("storage", change);
  window.addEventListener(EVENT, change);
  return () => {
    window.removeEventListener("storage", change);
    window.removeEventListener(EVENT, change);
  };
};

export function useMySchedule(conferenceId: string) {
  const state = useSyncExternalStore(
    subscribe,
    () => read(conferenceId),
    () => EMPTY,
  );
  const update = useCallback(
    (f: (s: Stored) => Stored) => write(conferenceId, f(read(conferenceId))),
    [conferenceId],
  );
  return {
    saved: state.saved,
    isSaved: (id: string) => state.saved.includes(id),
    toggle: (id: string) =>
      update((s) => ({
        ...s,
        saved: s.saved.includes(id)
          ? s.saved.filter((x) => x !== id)
          : [...s.saved, id],
      })),
    prefs: state.prefs,
    setLead: (lead: Lead) =>
      update((s) => ({ ...s, prefs: { ...s.prefs, lead } })),
    /** `null` goes back to the default lead. */
    setOverride: (id: string, lead: Lead | null) =>
      update((s) => {
        const overrides = { ...s.prefs.overrides };
        if (lead === null) delete overrides[id];
        else overrides[id] = lead;
        return { ...s, prefs: { ...s.prefs, overrides } };
      }),
    notify: state.notify,
    setNotify: (notify: boolean) => update((s) => ({ ...s, notify })),
  };
}

/** The calendar file's link, carrying this person's reminder choices. */
export function calendarHref(
  conferenceId: string,
  prefs: ReminderPrefs,
  ids?: readonly string[],
): string {
  const q = new URLSearchParams();
  if (ids) q.set("ids", ids.join(","));
  if (prefs.lead) q.set("lead", String(prefs.lead));
  const o = Object.entries(prefs.overrides)
    .filter(([id]) => !ids || ids.includes(id))
    .map(([id, n]) => `${id}:${n}`)
    .join(",");
  if (o) q.set("o", o);
  const s = q.toString();
  return `/api/conferences/${conferenceId}/calendar${s ? `?${s}` : ""}`;
}
