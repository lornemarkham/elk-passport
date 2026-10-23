import { clock, untilWords } from "./time";
import type { PlanView } from "./views";

/**
 * **Reminders: the few that are worth an interruption.**
 *
 * Doctrine §6: the best interaction may be one well-timed line after ninety
 * minutes of silence. So a reminder exists only for something the person
 * said _I'm in_ to — never for Maybe, never for plans they were merely
 * invited to — and at most two per occurrence:
 *
 * - `today`: on the day, once, the first time Conference is opened before it
 *   starts ("Your lunch group meets at 12:30.")
 * - `soon`: from 30 minutes before until it starts ("Morning walk starts in
 *   30 minutes.")
 *
 * Each has a stable `key`. The browser remembers which keys it has already
 * shown (`useReminders`), so a reload, a second tab or the next poll never
 * repeats one, and nothing here schedules anything.
 */

export interface Reminder {
  readonly key: string;
  readonly planId: string;
  readonly occurrenceId: string;
  readonly kind: "today" | "soon";
  readonly title: string;
  readonly body: string;
  readonly startsAt: string;
}

export const SOON_WINDOW_MS = 30 * 60_000;
/** How long after its start a `soon` reminder still makes sense. */
const LATE_MS = 5 * 60_000;

const dayKey = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);

const what = (p: PlanView): string => {
  switch (p.kind) {
    case "morning-walk":
      return "Morning walk";
    case "lunch":
      return "Your lunch group";
    case "dinner":
      return "Dinner";
    case "coffee":
      return "Coffee";
    case "drinks":
      return "Drinks";
    default:
      return p.title;
  }
};

const where = (p: PlanView): string => {
  const at = p.meeting?.label ?? p.venue?.name;
  return at ? ` at ${at}` : "";
};

export function remindersFor(
  plans: readonly PlanView[],
  now: Date,
  timeZone: string,
): Reminder[] {
  const out: Reminder[] = [];
  for (const p of plans)
    for (const o of p.occurrences) {
      if (o.mine !== "in") continue;
      const at = new Date(o.startsAt);
      const ms = at.getTime() - now.getTime();
      if (ms <= SOON_WINDOW_MS && ms > -LATE_MS) {
        const mins = Math.max(1, Math.round(ms / 60_000));
        out.push({
          key: `${o.id}:soon`,
          planId: p.id,
          occurrenceId: o.id,
          kind: "soon",
          title:
            ms > 0
              ? `${what(p)} ${p.kind === "lunch" ? "meets" : "starts"} in ${mins} minute${mins === 1 ? "" : "s"}.`
              : `${what(p)} is starting now.`,
          body: `${p.title}${where(p)} · ${clock(at, timeZone)}`,
          startsAt: o.startsAt,
        });
      } else if (ms > 0 && dayKey(at, timeZone) === dayKey(now, timeZone)) {
        out.push({
          key: `${o.id}:today`,
          planId: p.id,
          occurrenceId: o.id,
          kind: "today",
          title: `${what(p)} ${p.kind === "lunch" ? "meets" : "is"} at ${clock(at, timeZone)}${where(p)}.`,
          body: `${p.title} · ${untilWords(at, now)}`,
          startsAt: o.startsAt,
        });
      }
    }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
