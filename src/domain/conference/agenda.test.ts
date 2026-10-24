import { describe, expect, it } from "vitest";
import {
  agendaDays,
  conferenceDays,
  dayEntries,
  journeyPhase,
  nowAndNext,
  type DayEntry,
} from "./agenda";
import { parseDetails } from "./details";
import type { ConferenceDetails } from "./types";

const base = {
  name: "Sycle Vancouver 2026",
  place: { label: "Vancouver", townId: "vancouver" },
  timeZone: "America/Vancouver",
  startsOn: "2026-10-24",
  endsOn: "2026-10-26",
};

const parsed = (extra: object): ConferenceDetails => {
  const r = parseDetails({ ...base, ...extra });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.details;
};

const agenda = [
  {
    day: "2026-10-24",
    start: "10:45",
    end: "12:00",
    title: "Product strategy",
  },
  {
    day: "2026-10-24",
    start: "09:00",
    end: "10:15",
    title: "Opening keynote",
    where: "Ballroom A",
  },
  { day: "2026-10-24", start: "12:00", title: "Lunch" },
  { day: "2026-10-24", start: "18:00", title: "Reception" },
  {
    day: "2026-10-25",
    start: "19:30",
    title: "Staff hockey game",
    featured: true,
  },
];

describe("the agenda in the conference's details", () => {
  it("is optional, sorted, given ids, and keeps only what was said", () => {
    expect(parsed({}).agenda).toBeUndefined();
    const d = parsed({ agenda });
    expect(d.agenda!.map((i) => i.title)).toEqual([
      "Opening keynote",
      "Product strategy",
      "Lunch",
      "Reception",
      "Staff hockey game",
    ]);
    expect(new Set(d.agenda!.map((i) => i.id)).size).toBe(5);
    expect(d.agenda![2]).not.toHaveProperty("end");
    expect(d.agenda![4]!.featured).toBe(true);
    expect(d.agenda![0]).not.toHaveProperty("featured");
  });

  it("refuses an end before the start, a bad time, and a day far from the conference", () => {
    const bad = (item: object) =>
      parseDetails({
        ...base,
        agenda: [{ day: "2026-10-24", start: "09:00", title: "x", ...item }],
      });
    expect(bad({ end: "08:00" }).ok).toBe(false);
    expect(bad({ start: "9am" }).ok).toBe(false);
    expect(bad({ day: "2062-10-24" }).ok).toBe(false);
    expect(bad({ day: "2026-10-22" }).ok).toBe(true); // arrivals, the day before
  });

  it("takes a venue only with a name", () => {
    expect(
      parsed({ venue: { name: "", address: "1055 Canada Place" } }).venue,
    ).toBeUndefined();
    expect(parsed({ venue: { name: "Convention Centre West" } }).venue).toEqual(
      {
        name: "Convention Centre West",
      },
    );
  });
});

describe("the day", () => {
  const d = parsed({ agenda });
  const at = (iso: string) => new Date(iso);

  it("lists the conference's days and any day the agenda adds", () => {
    expect(conferenceDays(d)).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ]);
    expect(
      agendaDays({
        ...d,
        agenda: [
          ...d.agenda!,
          { ...d.agenda![0]!, id: "early", day: "2026-10-23" },
        ],
      })[0],
    ).toBe("2026-10-23");
  });

  it("says what's on now, what's next and what's later, in Vancouver time", () => {
    // 10:50 in Vancouver on day one.
    const day = dayEntries(d, "2026-10-24");
    const nn = nowAndNext(day, at("2026-10-24T17:50:00Z"));
    expect(nn.now.map((e) => e.title)).toEqual(["Product strategy"]);
    expect(nn.next?.title).toBe("Lunch");
    expect(nn.later.map((e) => e.title)).toEqual(["Reception"]);
    expect(nn.done.map((e) => e.title)).toEqual(["Opening keynote"]);
  });

  it("lets a line with no end run to the next published line, or an hour", () => {
    const day = dayEntries(d, "2026-10-24");
    // 12:30: lunch (no end) is on until the reception starts.
    expect(
      nowAndNext(day, at("2026-10-24T19:30:00Z")).now.map((e) => e.title),
    ).toEqual(["Lunch"]);
    // 19:10: the reception (no end, last) is over after an hour.
    expect(nowAndNext(day, at("2026-10-25T02:10:00Z")).now).toEqual([]);
  });

  it("puts colleagues' plans on the day, after a published line at the same minute", () => {
    const plan: DayEntry = {
      source: "plan",
      id: "p1",
      occurrenceId: "o1",
      title: "Lunch away from the venue",
      startsAt: "2026-10-24T19:00:00Z",
      endsAt: null,
      where: "Chambar",
      note: null,
      featured: false,
      going: 3,
      mine: "in",
      kindLabel: "Lunch",
    };
    const day = dayEntries(d, "2026-10-24", [plan]);
    expect(day.map((e) => e.title)).toEqual([
      "Opening keynote",
      "Product strategy",
      "Lunch",
      "Lunch away from the venue",
      "Reception",
    ]);
    // A plan never ends a session.
    expect(
      nowAndNext(day, at("2026-10-24T19:30:00Z")).now.map((e) => e.title),
    ).toEqual(["Lunch", "Lunch away from the venue"]);
  });
});

describe("the journey", () => {
  const d = parsed({});
  it("is before, arrival, during and after, by the conference's calendar", () => {
    expect(journeyPhase(d, new Date("2026-10-20T18:00:00Z"), 0)).toBe("before");
    expect(journeyPhase(d, new Date("2026-10-20T18:00:00Z"), 2)).toBe(
      "arrival",
    );
    // The eve of day one, in Vancouver, is arrival day even at 23:30 UTC-7.
    expect(journeyPhase(d, new Date("2026-10-24T06:30:00Z"), 0)).toBe(
      "arrival",
    );
    expect(journeyPhase(d, new Date("2026-10-24T17:00:00Z"), 3)).toBe("during");
    expect(journeyPhase(d, new Date("2026-10-27T18:00:00Z"), 0)).toBe("after");
  });
});
