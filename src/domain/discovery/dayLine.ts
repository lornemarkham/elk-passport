import { ZONE } from "@/domain/experience/eventTime";

/**
 * **Today, written out where the subjects are** — `Thursday, October 15`.
 *
 * One function because three places say it and must agree: the page, its
 * loading state, and the view the page hands the same string to. `ZONE` keeps
 * "today" meaning the day it is in the Okanagan rather than wherever the
 * server or the reader happens to be.
 */
export function dayLine(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: ZONE,
  }).format(now);
}
