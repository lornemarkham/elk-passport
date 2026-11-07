import { describe, expect, it } from "vitest";
import raw from "../../app/snow/_server/fixtures/open-meteo-whistler-2026-11-07.json";
import {
  dayFor,
  headline,
  nowWords,
  parseConditions,
  skyWords,
  snowAhead,
  type ConditionsDay,
} from "./conditions";

const FETCHED = "2026-11-07T16:00:00.000Z";
const c = parseConditions(raw, FETCHED)!;

const day = (o: Partial<ConditionsDay>): ConditionsDay => ({
  date: "2026-12-12",
  code: 3,
  snowCm: 0,
  minC: -3,
  maxC: 1,
  gustKmh: 10,
  precipChance: 20,
  sunrise: "2026-12-12T07:50",
  sunset: "2026-12-12T16:20",
  ...o,
});

describe("parseConditions (a real Open-Meteo answer for Whistler)", () => {
  it("reads seven days and the current reading", () => {
    expect(c.days).toHaveLength(7);
    expect(c.days[0].date).toBe("2026-11-07");
    expect(c.now?.tempC).toBe(3.9);
    expect(c.elevationM).toBe(672);
    expect(c.source).toBe("Open-Meteo");
  });

  it("refuses anything that is not a forecast", () => {
    expect(parseConditions(null, FETCHED)).toBeNull();
    expect(parseConditions({}, FETCHED)).toBeNull();
    expect(parseConditions({ daily: { time: [] } }, FETCHED)).toBeNull();
  });

  it("drops a day with a hole in it instead of guessing it", () => {
    const broken = structuredClone(raw) as typeof raw;
    (broken.daily.wind_gusts_10m_max as (number | null)[])[2] = null;
    const p = parseConditions(broken, FETCHED)!;
    expect(p.days).toHaveLength(6);
    expect(dayFor(p, "2026-11-09")).toBeUndefined();
  });

  it("keeps the forecast when the current block is bad", () => {
    const p = parseConditions({ ...raw, current: { time: "x" } }, FETCHED)!;
    expect(p.now).toBeNull();
    expect(p.days.length).toBeGreaterThan(0);
  });
});

describe("headline", () => {
  it("says what the numbers are and never that it is a good day", () => {
    const h = headline(dayFor(c, "2026-11-08")!);
    expect(h.line).toMatch(/gusts to 79 km\/h/);
    expect(h.tips.join(" ")).toMatch(/Lifts can slow or close in wind/);
    expect(h.line.toLowerCase()).not.toMatch(/great|perfect|epic|bluebird/);
  });

  it("tells a cold day what to bring, from the number", () => {
    const h = headline(day({ minC: -14, maxC: -8 }));
    expect(h.line).toContain("−14° to −8°");
    expect(h.tips.join(" ")).toMatch(/hand warmers/);
  });

  it("flags rain at the valley point rather than calling it snow", () => {
    const h = headline(day({ code: 63, maxC: 6, minC: 2, snowCm: 0 }));
    expect(h.wet).toBe(true);
    expect(h.tips.join(" ")).toMatch(/waterproof/);
  });

  it("says thunderstorms are not for riding in", () => {
    expect(headline(day({ code: 95 })).tips.join(" ")).toMatch(/Do not ride/);
  });

  it("warns about a big dump by slowing the plan, not by hyping it", () => {
    const h = headline(day({ snowCm: 30, code: 73 }));
    expect(h.tips.join(" ")).toMatch(/easier day/);
    expect(h.tips.join(" ")).not.toMatch(/powder day!|shred/i);
  });
});

describe("small readers", () => {
  it("snowAhead sums the next days from a date", () => {
    expect(snowAhead(c, "2026-11-07")).toBe(0);
    const p = { ...c, days: [day({ snowCm: 4 }), day({ snowCm: 6 })] };
    expect(snowAhead(p, "2026-12-12", 2)).toBe(10);
  });
  it("words the sky and the present", () => {
    expect(skyWords(73)).toBe("snow");
    expect(skyWords(0)).toBe("clear");
    expect(nowWords(c.now!)).toMatch(/overcast, 4°/);
  });
});
