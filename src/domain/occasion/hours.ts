import type { Experience } from "@/domain/experience/types";

/**
 * **When a place says it closes, on one weekday — in its own words.**
 *
 * Atlas holds the publisher's opening-hours sentences on 149 of 4,022
 * candidates (corpus of 2026-10-24) — "Mon: 9:00 AM – 6:00 PM · … · Sat:
 * 10:00 AM – 5:00 PM · Sun: Closed". An evening plan has to ask the one
 * question those sentences answer: *is it still open when we get there?*
 *
 * This reads only what is there and only the subject's own hours (a market
 * inside a park is the market's, not the park's). It finds the segment for
 * the weekday, takes the last clock time in it as the close, and returns the
 * quote it read so the page can show it. A sentence it cannot read cleanly
 * returns nothing — unknown, never a guess.
 */

const DAYS = [
  ["sunday", "sun"],
  ["monday", "mon"],
  ["tuesday", "tue|tues"],
  ["wednesday", "wed"],
  ["thursday", "thu|thur|thurs"],
  ["friday", "fri"],
  ["saturday", "sat"],
] as const;

const ANY_DAY = new RegExp(
  String.raw`\b(${DAYS.map(([full, short]) => `${full}|${short}`).join("|")})\b\.?\s*:`,
  "gi",
);

const CLOCK = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/gi;

const minutesOf = (h: string, m: string | undefined, half: string): number => {
  let hour = Number(h) % 12;
  if (/p/i.test(half)) hour += 12;
  return hour * 60 + Number(m ?? 0);
};

export interface StatedClose {
  /** Minutes after midnight. `0` with `closed` means closed all day. */
  readonly minutes: number;
  readonly closed?: true;
  /** The words read, for the page. */
  readonly quote: string;
}

const weekdayOf = (on: string): number =>
  new Date(`${on}T12:00:00Z`).getUTCDay();

export function statedCloseOn(
  experience: Experience,
  on: string,
): StatedClose | undefined {
  const day = weekdayOf(on);
  const [full, short] = DAYS[day]!;
  for (const statement of experience.schedule?.statements ?? []) {
    if (statement.scope && statement.scope !== "subject") continue;
    if (statement.closedWeekdays?.includes(full))
      return { minutes: 0, closed: true, quote: statement.text };
    const text = statement.text;
    // Weekday segments: "Sat: 10:00 AM – 5:00 PM · Sun: Closed".
    const marks = [...text.matchAll(ANY_DAY)];
    const mine = marks.findIndex((m) =>
      new RegExp(`^(${full}|${short})$`, "i").test(m[1]!),
    );
    if (mine >= 0) {
      const from = marks[mine]!.index! + marks[mine]![0].length;
      const to = marks[mine + 1]?.index ?? text.length;
      const segment = text
        .slice(from, to)
        .replace(/[·|,;]\s*$/, "")
        .trim();
      if (/^closed\b/i.test(segment))
        return {
          minutes: 0,
          closed: true,
          quote: `${marks[mine]![0]} ${segment}`,
        };
      const times = [...segment.matchAll(CLOCK)];
      if (times.length < 2) return undefined;
      const last = times[times.length - 1]!;
      return {
        minutes: minutesOf(last[1]!, last[2], last[3]!),
        quote: `${marks[mine]![0].replace(/\s*:$/, "")} ${segment}`.trim(),
      };
    }
    // One range for every day it names: "11:00 am - 5:00 pm 7 days/week".
    if (marks.length === 0 && statement.weekdays?.includes(full)) {
      const times = [...text.matchAll(CLOCK)];
      if (times.length !== 2) continue;
      const last = times[1]!;
      return { minutes: minutesOf(last[1]!, last[2], last[3]!), quote: text };
    }
  }
  return undefined;
}

/** "5:00 pm", for a sentence. */
export function clockWords(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const half = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${half}`;
}
