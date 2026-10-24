import { describe, expect, it } from "vitest";
import { agendaDays, dayEntries } from "./agenda";
import { planImport, readAgendaFile } from "./agendaImport";
import {
  firstProgrammeDay,
  freeTime,
  greeting,
  momentFor,
  startsWords,
  tonight,
  walkBudget,
} from "./moments";
import { BEFORE, SUMMIT_FILE } from "./testSummit";

const details = (() => {
  const r = readAgendaFile(JSON.stringify(SUMMIT_FILE));
  if (!r.ok) throw new Error(r.problem);
  const p = planImport(BEFORE, r.file, { replace: true });
  if (!p.ok) throw new Error("plan");
  return p.details;
})();
const TZ = "America/Vancouver";
/** Vancouver wall clock, October 2026 (UTC-7). */
const at = (day: number, hm: string) =>
  new Date(`2026-10-${day}T${hm}:00-07:00`);
const day = (ymd: string) => dayEntries(details, ymd);
const first = firstProgrammeDay(
  agendaDays(details).map((ymd) => ({ ymd, entries: day(ymd) })),
);
const moment = (d: number, hm: string) =>
  momentFor({
    kind: "conference",
    details,
    today: day(`2026-10-${d}`),
    firstProgrammeDay: first,
    ymd: `2026-10-${d}`,
    now: at(d, hm),
  });

describe("greeting", () => {
  it("reads the clock where the conference is", () => {
    expect(greeting("Vancouver", TZ, at(27, "08:18"))).toBe(
      "Good morning, Vancouver",
    );
    expect(greeting("Vancouver", TZ, at(27, "12:10"))).toBe(
      "Good afternoon, Vancouver",
    );
    expect(greeting("Vancouver", TZ, at(28, "18:00"))).toBe(
      "Good evening, Vancouver",
    );
  });
});

describe("little moments: at most one, and only from what was published", () => {
  it("the first morning of sessions", () => {
    expect(first).toBe("2026-10-27");
    expect(moment(27, "07:40")).toBe(
      "Time to meet the people behind the Slack avatars.",
    );
  });
  it("a social line on now or next", () => {
    expect(moment(27, "09:50")).toBe("Your mission: meet someone new.");
    expect(moment(26, "17:00")).toBe("Your mission: meet someone new.");
  });
  it("the celebration, all day until it starts", () => {
    expect(moment(28, "09:00")).toBe("Tonight, we celebrate.");
    expect(moment(28, "18:40")).toBeNull();
  });
  it("a line with its own aside speaks for itself", () => {
    expect(moment(29, "10:20")).toBeNull();
  });
  it("afterwards, the send-off counts the days", () => {
    expect(moment(30, "09:00")).toBe(
      "Four days. A lot of conversations. Let's keep the good stuff going.",
    );
  });
  it("nothing before the conference", () => {
    expect(moment(25, "09:00")).toBeNull();
  });
});

describe("free time", () => {
  it("a break, measured to the next line that isn't a break", () => {
    const f = freeTime(day("2026-10-27"), TZ, at(27, "14:31"));
    expect(f).toMatchObject({ kind: "gap", minutes: 29 });
    if (f?.kind !== "gap") throw new Error();
    expect(f.until.id).toBe("tue-wrap");
    expect(f.during?.id).toBe("tue-break");
  });
  it("never during a session or a meal", () => {
    expect(freeTime(day("2026-10-27"), TZ, at(27, "09:00"))).toBeNull();
    expect(freeTime(day("2026-10-27"), TZ, at(27, "12:30"))).toBeNull();
  });
  it("not before the day's first line", () => {
    expect(freeTime(day("2026-10-27"), TZ, at(27, "06:00"))).toBeNull();
  });
  it("the evening once the last line has run, until eleven", () => {
    expect(freeTime(day("2026-10-28"), TZ, at(28, "20:00"))).toMatchObject({
      kind: "evening",
    });
    expect(freeTime(day("2026-10-28"), TZ, at(28, "23:30"))).toBeNull();
  });
  it("a walk fits there and back with five minutes to order", () => {
    expect(walkBudget(15)).toBe(5);
    expect(walkBudget(29)).toBe(12);
    expect(walkBudget(10)).toBeNull();
    expect(walkBudget(120)).toBe(20);
  });
});

describe("tonight", () => {
  it("is the first line from 5 p.m. that hasn't finished", () => {
    expect(tonight(day("2026-10-27"), TZ, at(27, "09:00"))?.id).toBe(
      "tue-dinner",
    );
    expect(tonight(day("2026-10-28"), TZ, at(28, "09:00"))?.id).toBe(
      "wed-gala",
    );
    expect(tonight(day("2026-10-29"), TZ, at(29, "09:00"))).toBeNull();
  });
});

describe("countdown words", () => {
  it("minutes, hours, and after", () => {
    const now = at(27, "08:18");
    expect(startsWords(at(27, "08:30"), now)).toBe("Starts in 12 minutes");
    expect(startsWords(at(27, "08:19"), now)).toBe("Starts in 1 minute");
    expect(startsWords(at(27, "10:00"), now)).toBe("Starts in 1 h 42 min");
    expect(startsWords(at(27, "08:08"), now)).toBe("Started 10 minutes ago");
  });
});
