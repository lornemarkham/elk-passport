import { zonedToUtc } from "@/domain/conference-plans/time";
import type { AgendaItem, ConferenceDetails } from "./types";

/**
 * **The agenda as a calendar file (RFC 5545), for Apple, Google and Outlook.**
 *
 * Times are written as the agenda gives them — wall-clock in the conference's
 * own zone (`DTSTART;TZID=America/Vancouver:20261027T083000`) — with a
 * `VTIMEZONE` built from the zone's real offsets, so a phone set to Toronto
 * still files an 8:30 Vancouver session at 8:30 Vancouver.
 *
 * **End times are never invented.** An organiser's typed end is written as
 * it is. Most agenda lines have none, and calendar apps need one to draw a
 * block, so the file uses the same display rule the app does: the entry
 * ends when the next published line that day begins, or an hour after it
 * starts when it is the day's last. Every such entry says so in its
 * description, in words, so nobody mistakes a drawn block for the official
 * programme. The stored agenda is untouched by any of this.
 *
 * Each entry's `UID` is the line's id plus the conference's — stable across
 * exports, so importing the file again (after a room changes) updates the
 * event instead of adding a second one, and `SEQUENCE` rises with the
 * conference's last edit.
 *
 * Alarms are `VALARM`s, only where the person asked for one. Apple Calendar
 * and Outlook keep them; Google Calendar ignores alarms in imported files
 * and applies its own defaults (said in the app, beside the button).
 */

export interface CalendarInput {
  readonly conferenceId: string;
  readonly details: Pick<
    ConferenceDetails,
    "name" | "timeZone" | "venue" | "agenda"
  >;
  /** The lines to export, by id; every line when absent. */
  readonly ids?: readonly string[];
  /** Minutes before each line to alert, or `null` for none. */
  readonly alarmFor?: (item: AgendaItem) => number | null;
  /** A link to each line's page, for the event's URL. */
  readonly urlFor?: (item: AgendaItem) => string;
  /** The conference's last edit: becomes each event's `SEQUENCE`. */
  readonly revisedAt: string;
  readonly now: Date;
}

export type EndBasis = "official" | "next-line" | "one-hour";

/** When a line's calendar entry ends, and on what basis. */
export function calendarEnd(
  item: AgendaItem,
  agenda: readonly AgendaItem[],
): { readonly day: string; readonly time: string; readonly basis: EndBasis } {
  if (item.end) return { day: item.day, time: item.end, basis: "official" };
  const next = agenda
    .filter((i) => i.day === item.day && i.start > item.start)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  if (next) return { day: item.day, time: next.start, basis: "next-line" };
  const [h, m] = item.start.split(":").map(Number) as [number, number];
  if (h < 23)
    return {
      day: item.day,
      time: `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      basis: "one-hour",
    };
  // 23:xx: the hour runs past midnight.
  const d = new Date(`${item.day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    day: d.toISOString().slice(0, 10),
    time: `00:${String(m).padStart(2, "0")}`,
    basis: "one-hour",
  };
}

const twelve = (hm: string) => {
  const [h, m] = hm.split(":").map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export const END_NOTE: Record<Exclude<EndBasis, "official">, string> = {
  "next-line":
    "The agenda gives this a start time only. This calendar entry ends when the next item begins; that is not an official end time.",
  "one-hour":
    "The agenda gives this a start time only. This calendar entry is drawn as one hour; that is not an official end time.",
};

// ── Text ────────────────────────────────────────────────────────────────

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newlines are escaped. */
export const escapeText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

const encoder = new TextEncoder();

/**
 * RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF and a
 * space. Octets, not characters — an em dash is three — and never inside a
 * character.
 */
export function fold(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    // The first line may hold 75 octets; continuations 74 after their space.
    const limit = out.length ? 74 : 75;
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

// ── Time zone ───────────────────────────────────────────────────────────

const local = (ymd: string, hm: string) =>
  `${ymd.replace(/-/g, "")}T${hm.replace(":", "")}00`;

const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const offsetFormats = new Map<string, Intl.DateTimeFormat>();

/** The zone's offset from UTC at an instant, in minutes (Vancouver in October: -420). */
export function offsetMinutes(timeZone: string, at: Date): number {
  let f = offsetFormats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    });
    offsetFormats.set(timeZone, f);
  }
  const name =
    f.formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!m) return 0; // "GMT": UTC itself.
  const min = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -min : min;
}

const offsetWords = (min: number) => {
  const sign = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}${String(a % 60).padStart(2, "0")}`;
};

/**
 * A `VTIMEZONE` for the years the events fall in, from the zone's own
 * offsets: every change of offset in that span becomes an observance at the
 * local time it happened. No rules are recalled; the platform's zone data
 * is read.
 */
export function vtimezone(
  timeZone: string,
  years: readonly number[],
): string[] {
  const from = Math.min(...years) - 1;
  const to = Math.max(...years) + 1;
  const start = Date.UTC(from, 0, 1);
  const end = Date.UTC(to + 1, 0, 1);
  // A day at a time (zones change at most a few times a year), then the
  // minute it happened.
  const STEP = 86_400_000;
  const lines = ["BEGIN:VTIMEZONE", `TZID:${timeZone}`];
  let prev = offsetMinutes(timeZone, new Date(start));
  let any = false;
  for (let t = start + STEP; t < end; t += STEP) {
    const off = offsetMinutes(timeZone, new Date(t));
    if (off === prev) continue;
    let lo = t - STEP;
    let hi = t;
    while (hi - lo > 60_000) {
      const mid = lo + Math.floor((hi - lo) / 120_000) * 60_000;
      if (offsetMinutes(timeZone, new Date(mid)) === prev) lo = mid;
      else hi = mid;
    }
    // The observance starts at the local time just before the change, in
    // the old offset (RFC 5545 §3.6.5).
    const wall = new Date(hi + prev * 60_000).toISOString();
    const kind = off > prev ? "DAYLIGHT" : "STANDARD";
    lines.push(
      `BEGIN:${kind}`,
      `DTSTART:${local(wall.slice(0, 10), wall.slice(11, 16))}`,
      `TZOFFSETFROM:${offsetWords(prev)}`,
      `TZOFFSETTO:${offsetWords(off)}`,
      `END:${kind}`,
    );
    any = true;
    prev = off;
  }
  if (!any) {
    // A zone without changes: one standard observance.
    lines.push(
      "BEGIN:STANDARD",
      `DTSTART:${from}0101T000000`,
      `TZOFFSETFROM:${offsetWords(prev)}`,
      `TZOFFSETTO:${offsetWords(prev)}`,
      "END:STANDARD",
    );
  }
  lines.push("END:VTIMEZONE");
  return lines;
}

// ── The file ────────────────────────────────────────────────────────────

export function calendarFile(input: CalendarInput): string {
  const { details, conferenceId } = input;
  const agenda = details.agenda ?? [];
  const wanted = input.ids ? new Set(input.ids) : null;
  const items = agenda.filter((i) => !wanted || wanted.has(i.id));
  const tz = details.timeZone;
  const stamp = utcStamp(input.now);
  // Minutes since 1970 at the last edit: only ever rises, fits in 32 bits.
  const sequence = Math.max(
    0,
    Math.floor(Date.parse(input.revisedAt) / 60_000) || 0,
  );
  const years = items.length
    ? [...new Set(items.map((i) => Number(i.day.slice(0, 4))))]
    : [input.now.getUTCFullYear()];

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Go Have A Day//Passport Conference//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(details.name)}`,
    `X-WR-TIMEZONE:${tz}`,
    ...vtimezone(tz, years),
  ];

  for (const item of items) {
    const end = calendarEnd(item, agenda);
    const where = item.where
      ? [item.where, details.venue?.name].filter(Boolean).join(", ")
      : null;
    const description = [
      item.note,
      item.topics?.length ? item.topics.map((t) => `• ${t}`).join("\n") : null,
      end.basis === "official"
        ? null
        : `Starts ${twelve(item.start)} (${tz.replace(/_/g, " ")}). ${END_NOTE[end.basis]}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const alarm = input.alarmFor?.(item) ?? null;
    const url = input.urlFor?.(item);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}.${conferenceId}@gohaveaday.com`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${sequence}`,
      `DTSTART;TZID=${tz}:${local(item.day, item.start)}`,
      `DTEND;TZID=${tz}:${local(end.day, end.time)}`,
      `SUMMARY:${escapeText(item.title)}`,
      ...(where ? [`LOCATION:${escapeText(where)}`] : []),
      ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
      ...(url ? [`URL:${url}`] : []),
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      ...(alarm !== null && alarm >= 0
        ? [
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            `DESCRIPTION:${escapeText(
              where ? `${item.title} · ${item.where}` : item.title,
            )}`,
            `TRIGGER:-PT${Math.round(alarm)}M`,
            "END:VALARM",
          ]
        : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** The UTC instant a line starts, for anything that needs one. */
export const startsAt = (item: AgendaItem, timeZone: string) =>
  zonedToUtc(item.day, item.start, timeZone)!;
