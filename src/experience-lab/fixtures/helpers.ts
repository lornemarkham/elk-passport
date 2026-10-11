import type { Moment, Response } from "../core/types";

/**
 * Fixture time. Every experience is anchored to a moving date so the lab is
 * never stale — open it in November and the hockey night is still on Friday.
 * Real anchors will come from Atlas (an Event's `startTime`); this is the
 * stand-in, and the only place a fixture is allowed to know about the clock.
 */
export function nextWeekdayAt(
  weekday: number,
  hour: number,
  minute = 0,
): string {
  const now = new Date();
  const date = new Date(now);
  date.setHours(hour, minute, 0, 0);
  const delta = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + (delta === 0 && date <= now ? 7 : delta));
  return date.toISOString();
}

export function offsetFrom(anchorIso: string, minutes: number): string {
  return new Date(
    new Date(anchorIso).getTime() + minutes * 60_000,
  ).toISOString();
}

export function answer(
  promptId: string,
  participantId: string,
  value: Response["value"],
  anchorIso: string,
  minutesBefore: number,
): Response {
  return {
    promptId,
    participantId,
    value,
    at: offsetFrom(anchorIso, -minutesBefore),
  };
}

let momentSeq = 0;
export function moment(
  anchorIso: string,
  offsetMinutes: number,
  moment: Omit<Moment, "id" | "at">,
): Moment {
  momentSeq += 1;
  return {
    ...moment,
    id: `m${momentSeq}`,
    at: offsetFrom(anchorIso, offsetMinutes),
  };
}
