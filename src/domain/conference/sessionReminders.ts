import { clock } from "@/domain/conference-plans/time";
import type { AgendaItem, AgendaKind } from "./types";

/**
 * **Reminders for the published agenda: useful, not annoying.**
 *
 * The person chooses one lead time — none, 5, 15 or 30 minutes — and may
 * change it for any single line ("this one, 30 minutes"; "not this one").
 * Breaks are never reminded by default: a nudge every hour is how an app
 * gets muted. Everything is the person's choice on their own device; no
 * reminder is ever sent to somebody who didn't ask.
 *
 * What a reminder can reach, said plainly: Passport has no push service,
 * so these appear while Conference is open (a banner on every tab, and a
 * system notification from that open tab if allowed), and — the reliable
 * one — as alarms inside the calendar file, which the phone's own calendar
 * fires whether Conference is open or not.
 */

export const LEADS = [0, 5, 15, 30] as const;
export type Lead = (typeof LEADS)[number];

export interface ReminderPrefs {
  /** Minutes before each line; 0 is none. */
  readonly lead: Lead;
  /** Per line, by id: overrides `lead`. */
  readonly overrides: Readonly<Record<string, Lead>>;
}

export const NO_PREFS: ReminderPrefs = { lead: 0, overrides: {} };

const QUIET: readonly AgendaKind[] = ["break"];

/** Minutes before this line to remind, or 0 for none. */
export function leadFor(
  item: Pick<AgendaItem, "id" | "kind">,
  p: ReminderPrefs,
): Lead {
  const o = p.overrides[item.id];
  if (o !== undefined) return o;
  return QUIET.includes(item.kind ?? "session") ? 0 : p.lead;
}

export const isLead = (n: unknown): n is Lead =>
  typeof n === "number" && (LEADS as readonly number[]).includes(n);

/** Prefs read back from storage, with anything unrecognised dropped. */
export function cleanPrefs(raw: unknown): ReminderPrefs {
  if (!raw || typeof raw !== "object") return NO_PREFS;
  const r = raw as { lead?: unknown; overrides?: unknown };
  const overrides: Record<string, Lead> = {};
  if (r.overrides && typeof r.overrides === "object")
    for (const [k, v] of Object.entries(r.overrides))
      if (/^[\w-]{1,24}$/.test(k) && isLead(v)) overrides[k] = v;
  return { lead: isLead(r.lead) ? r.lead : 0, overrides };
}

export interface SessionReminder {
  /** Stable: a line, its day and the lead — shown at most once. */
  readonly key: string;
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly startsAt: string;
}

/** After its start, a reminder still makes sense for this long. */
const LATE_MS = 2 * 60_000;

/**
 * The reminders due now: a line whose lead time has begun and which hasn't
 * started more than two minutes ago.
 */
export function sessionRemindersFor(
  items: readonly (Pick<
    AgendaItem,
    "id" | "day" | "title" | "where" | "kind"
  > & {
    readonly startsAt: string;
  })[],
  prefs: ReminderPrefs,
  now: Date,
  timeZone: string,
): SessionReminder[] {
  const out: SessionReminder[] = [];
  for (const i of items) {
    const lead = leadFor(i, prefs);
    if (!lead) continue;
    const at = new Date(i.startsAt);
    const ms = at.getTime() - now.getTime();
    if (ms > lead * 60_000 || ms < -LATE_MS) continue;
    const mins = Math.max(1, Math.round(ms / 60_000));
    out.push({
      key: `${i.id}:${i.day}:${lead}`,
      id: i.id,
      title:
        ms > 0
          ? `${i.title} starts in ${mins} minute${mins === 1 ? "" : "s"}.`
          : `${i.title} is starting now.`,
      body: i.where
        ? `Head to ${i.where}. ${clock(at, timeZone)}.`
        : `${clock(at, timeZone)}.`,
      startsAt: i.startsAt,
    });
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
