import { describe, expect, it } from "vitest";
import { agendaEntry } from "./agenda";
import {
  cleanPrefs,
  leadFor,
  sessionRemindersFor,
  type ReminderPrefs,
} from "./sessionReminders";
import type { AgendaItem } from "./types";

const TZ = "America/Vancouver";
const items: AgendaItem[] = [
  {
    id: "s1",
    day: "2026-10-27",
    start: "08:30",
    title: "General Session",
    where: "Grand Ballroom",
  },
  {
    id: "b1",
    day: "2026-10-27",
    start: "10:00",
    title: "Break",
    kind: "break",
  },
  {
    id: "m1",
    day: "2026-10-27",
    start: "12:00",
    title: "Lunch",
    where: "Room 4-5",
    kind: "meal",
  },
];
const rows = items.map((i) => ({
  ...i,
  startsAt: agendaEntry(i, TZ).startsAt,
}));
const at = (hm: string) => new Date(`2026-10-27T${hm}:00-07:00`);
const prefs = (p: Partial<ReminderPrefs>): ReminderPrefs => ({
  lead: 0,
  overrides: {},
  ...p,
});

describe("session reminders", () => {
  it("none unless asked", () => {
    expect(sessionRemindersFor(rows, prefs({}), at("08:20"), TZ)).toEqual([]);
  });
  it("from the lead time until just after the start, with where to go", () => {
    const p = prefs({ lead: 15 });
    expect(sessionRemindersFor(rows, p, at("08:14"), TZ)).toEqual([]);
    const [r] = sessionRemindersFor(rows, p, at("08:18"), TZ);
    expect(r).toMatchObject({
      key: "s1:2026-10-27:15",
      title: "General Session starts in 12 minutes.",
      body: "Head to Grand Ballroom. 8:30 AM.",
    });
    expect(sessionRemindersFor(rows, p, at("08:31"), TZ)[0]!.title).toBe(
      "General Session is starting now.",
    );
    expect(sessionRemindersFor(rows, p, at("08:35"), TZ)).toEqual([]);
  });
  it("breaks stay quiet by default; a per-line choice wins either way", () => {
    expect(leadFor(items[1]!, prefs({ lead: 15 }))).toBe(0);
    expect(leadFor(items[1]!, prefs({ lead: 15, overrides: { b1: 5 } }))).toBe(
      5,
    );
    expect(leadFor(items[0]!, prefs({ lead: 15, overrides: { s1: 0 } }))).toBe(
      0,
    );
    expect(leadFor(items[2]!, prefs({ overrides: { m1: 30 } }))).toBe(30);
  });
  it("reads stored prefs defensively", () => {
    expect(cleanPrefs(null)).toEqual({ lead: 0, overrides: {} });
    expect(
      cleanPrefs({ lead: 7, overrides: { s1: 30, "bad id": 5, m1: 9 } }),
    ).toEqual({
      lead: 0,
      overrides: { s1: 30 },
    });
  });
});
