import { describe, expect, it } from "vitest";
import { planImport, readAgendaFile } from "./agendaImport";
import {
  calendarEnd,
  calendarFile,
  escapeText,
  fold,
  offsetMinutes,
  vtimezone,
} from "./calendar";
import { BEFORE, SUMMIT_FILE } from "./testSummit";

const details = (() => {
  const r = readAgendaFile(JSON.stringify(SUMMIT_FILE));
  if (!r.ok) throw new Error(r.problem);
  const p = planImport(BEFORE, r.file, { replace: true });
  if (!p.ok) throw new Error("plan");
  return p.details;
})();

const NOW = new Date("2026-10-24T18:00:00Z");
const ics = (extra: Partial<Parameters<typeof calendarFile>[0]> = {}) =>
  calendarFile({
    conferenceId: "conf123",
    details,
    revisedAt: "2026-10-24T17:00:00Z",
    now: NOW,
    ...extra,
  });

/** Unfolded lines of one VEVENT, by UID prefix. */
const event = (text: string, id: string) => {
  const lines = text.replace(/\r\n /g, "").split("\r\n");
  const at = lines.indexOf(`UID:${id}.conf123@gohaveaday.com`);
  const end = lines.indexOf("END:VEVENT", at);
  return lines.slice(at, end);
};

describe("the calendar file", () => {
  it("is CRLF-delimited, folded at 75 octets, and well nested", () => {
    const text = ics();
    expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text.replace(/\r\n/g, "")).not.toMatch(/\n/);
    for (const line of text.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const count = (s: string) => text.split(s).length - 1;
    expect(count("BEGIN:VEVENT")).toBe(SUMMIT_FILE.agenda.length);
    expect(count("END:VEVENT")).toBe(SUMMIT_FILE.agenda.length);
  });

  it("writes times as the agenda gives them, in the conference's zone", () => {
    const e = event(ics(), "tue-general");
    expect(e).toContain("DTSTART;TZID=America/Vancouver:20261027T083000");
    expect(e).toContain("SUMMARY:General Session");
    expect(e).toContain("LOCATION:Grand Ballroom\\, Harbour Hotel");
  });

  it("uses a typed end as it is", () => {
    const e = event(ics(), "tue-breakfast");
    expect(e).toContain("DTEND;TZID=America/Vancouver:20261027T083000");
    expect(e.join("\n")).not.toMatch(/not an official end time/);
  });

  it("never invents an end: start-only lines end at the next line, and say so", () => {
    const e = event(ics(), "tue-general");
    expect(e).toContain("DTEND;TZID=America/Vancouver:20261027T100000");
    expect(e.join("")).toMatch(
      /start time only.*next item begins.*not an official end time/,
    );
    const last = event(ics(), "thu-travel");
    expect(last).toContain("DTEND;TZID=America/Vancouver:20261029T140000");
    expect(last.join("")).toMatch(/drawn as one hour/);
    // The stored agenda is untouched.
    expect(
      details.agenda!.find((i) => i.id === "tue-general")!.end,
    ).toBeUndefined();
  });

  it("gives no location where the agenda gives none", () => {
    expect(
      event(ics(), "tue-games").some((l) => l.startsWith("LOCATION")),
    ).toBe(false);
  });

  it("puts topics and notes in the description, escaped", () => {
    const e = event(ics(), "tue-general").join("");
    expect(e).toContain(
      "• Welcome\\; the year ahead\\n• Values\\, with a comma",
    );
  });

  it("has stable UIDs, so a second import updates instead of duplicating", () => {
    const a = ics();
    const b = ics({
      now: new Date("2026-10-27T01:00:00Z"),
      revisedAt: "2026-10-26T09:00:00Z",
    });
    const uids = (t: string) =>
      t.split("\r\n").filter((l) => l.startsWith("UID:"));
    expect(uids(a)).toEqual(uids(b));
    const seq = (t: string) =>
      Number(
        event(t, "tue-lunch")
          .find((l) => l.startsWith("SEQUENCE:"))!
          .slice(9),
      );
    expect(seq(b)).toBeGreaterThan(seq(a));
  });

  it("exports one line, or a chosen few", () => {
    const one = ics({ ids: ["wed-gala"] });
    expect(one.split("BEGIN:VEVENT").length - 1).toBe(1);
    expect(one).toContain("SUMMARY:Celebration Dinner");
    expect(
      ics({ ids: ["tue-lunch", "wed-gala"] }).split("BEGIN:VEVENT").length - 1,
    ).toBe(2);
  });

  it("adds an alarm only where one was asked for", () => {
    const text = ics({ alarmFor: (i) => (i.id === "tue-lunch" ? 15 : null) });
    expect(event(text, "tue-lunch")).toContain("TRIGGER:-PT15M");
    expect(event(text, "tue-general")).not.toContain("BEGIN:VALARM");
  });
});

describe("the time zone", () => {
  it("reads Vancouver's offsets from the platform, not from memory", () => {
    // The summit's week is UTC-7.
    expect(
      offsetMinutes("America/Vancouver", new Date("2026-10-27T15:30:00Z")),
    ).toBe(-420);
    expect(
      offsetMinutes("America/Vancouver", new Date("2026-03-01T15:30:00Z")),
    ).toBe(-480);
  });

  it("builds a VTIMEZONE whose observances are the zone's real changes", () => {
    const tz = vtimezone("America/Vancouver", [2026]).join("\n");
    expect(tz).toContain(
      "BEGIN:DAYLIGHT\nDTSTART:20260308T020000\nTZOFFSETFROM:-0800\nTZOFFSETTO:-0700",
    );
    // Whatever the platform's data says after November 1, 2026 (tzdata
    // 2026c keeps British Columbia on UTC-7), the file follows it.
    const after = offsetMinutes(
      "America/Vancouver",
      new Date("2026-12-01T15:30:00Z"),
    );
    if (after === -480)
      expect(tz).toContain("DTSTART:20261101T020000\nTZOFFSETFROM:-0700");
    else expect(tz).not.toContain("DTSTART:20261101");
  });

  it("handles a zone that never changes", () => {
    const tz = vtimezone("Asia/Tokyo", [2026]).join("\n");
    expect(tz).toContain("TZOFFSETTO:+0900");
  });
});

describe("text rules", () => {
  it("escapes RFC 5545 specials", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
  it("folds by octets, never splitting a character", () => {
    const line = `SUMMARY:${"—".repeat(40)}`;
    const folded = fold(line);
    for (const part of folded.split("\r\n"))
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
  it("calendarEnd past 11 p.m. runs into the next day", () => {
    expect(
      calendarEnd(
        { id: "x", day: "2026-10-27", start: "23:30", title: "Late" },
        [],
      ),
    ).toEqual({
      day: "2026-10-28",
      time: "00:30",
      basis: "one-hour",
    });
  });
});
