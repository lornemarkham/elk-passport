import { describe, expect, it } from "vitest";
import { sunsetOf } from "./compose";
import { departure } from "./departure";
import { eveningOf } from "./evenings";
import { clock, planFromItems, templatePlan, type PlanStop } from "./itinerary";
import { TOMORROW } from "./tomorrow";

const day = TOMORROW;
const sunset = sunsetOf(day)!;
const eddie = eveningOf("king-eddie")!;
const FOUR = 16 * 60;
const key = (stops: readonly PlanStop[], k: string) =>
  stops.find((s) => s.key === k);

const at4 = (ending: "wild" | "warm") =>
  departure({
    stops: templatePlan(eddie, sunset, day, ending),
    leaveAt: FOUR,
    sunset,
    evening: eddie,
    day,
  });

describe("King Eddie, but we can't leave before 4", () => {
  const d = at4("wild");
  const option = (id: string) => d.options.find((o) => o.id === id)!;

  it("says how much light the hunt gets, and when legal hunting ends", () => {
    expect(d.was).toBe(14 * 60 + 15);
    expect(d.light).toContain("about 4:40 pm");
    expect(d.light).toContain("53 min of daylight");
    expect(d.light).toContain("Legal hunting ends at 6:35 pm");
  });

  it("keeps the plan as it is on offer, with its warnings said", () => {
    const keep = option("keep");
    expect(keep.stops.map((s) => s.key)).toEqual(
      templatePlan(eddie, sunset, day, "wild").map((s) => s.key),
    );
    expect(keep.warnings.map((w) => w.line).join(" ")).toMatch(
      /misses it|dip after sunset/,
    );
    expect(keep.recommended).toBe(false);
  });

  it("suggests a shorter hunt that still makes the sunset at the lake", () => {
    const tight = option("tighter");
    expect(tight.recommended).toBe(true);
    expect(tight.title).toBe("Shorter hunt, still the sunset");
    expect(tight.warnings).toEqual([]);
    const grouse = key(tight.stops, "grouse")!;
    expect(clock(grouse.at)).toBe("4:40 pm");
    expect(grouse.minutes).toBeGreaterThanOrEqual(45);
    expect(grouse.at + grouse.minutes).toBeLessThanOrEqual(sunset);
    expect(key(tight.stops, "sunset")!.at).toBeLessThanOrEqual(sunset + 5);
    expect(key(tight.stops, "dip")).toBeUndefined();
    expect(tight.trades).toContainEqual({
      sign: "-",
      text: "A quick dip, if you dare",
    });
    expect(clock(tight.home)).toBe("8:30 pm");
  });

  it("offers all the light for the hunt, giving up the lake sunset", () => {
    const first = option("main-first");
    const grouse = key(first.stops, "grouse")!;
    expect(grouse.at + grouse.minutes).toBe(sunset);
    expect(key(first.stops, "sunset")).toBeUndefined();
    expect(first.warnings).toEqual([]);
  });

  it("moves dinner into town as the other ending", () => {
    const warm = option("ending:warm");
    expect(warm.title).toMatch(/^Warm ending: dinner at BNA Brewing at /);
    expect(warm.warnings).toEqual([]);
    expect(key(warm.stops, "dinner")!.at).toBeGreaterThan(sunset);
  });

  it("offers a closer adventure honestly, and never a far one", () => {
    const cold = option("evening:cold-water");
    expect(cold.line).toContain("No hunting on this one.");
    expect(cold.stops[0]!.at).toBeGreaterThanOrEqual(FOUR);
    expect(d.options.some((o) => o.id === "evening:crazy-creek")).toBe(false);
  });

  it("never invents a closer place to hunt or a verified drive", () => {
    expect(d.honest.join(" ")).toMatch(/doesn't know a closer place to hunt/);
    expect(d.honest.join(" ")).toMatch(/estimates/);
  });

  it("nothing starts before 4, and every alternative works", () => {
    for (const o of d.options) {
      expect(o.stops.every((s) => s.at >= FOUR)).toBe(true);
      if (o.id !== "keep") expect(o.warnings).toEqual([]);
    }
  });

  it("on the warm ending, says dinner moves", () => {
    const tight = at4("warm").options.find((o) => o.id === "tighter")!;
    expect(tight.trades.map((t) => t.text)).toContain(
      `Dinner at BNA Brewing at ${clock(key(tight.stops, "dinner")!.at)}, not 6:30 pm`,
    );
  });
});

describe("other leave times", () => {
  it("earlier gives the light back: the plan as it is works", () => {
    const d = departure({
      stops: templatePlan(eddie, sunset, day, "wild"),
      leaveAt: 13 * 60 + 30,
      sunset,
      evening: eddie,
      day,
    });
    expect(d.options[0]!.id).toBe("keep");
    expect(d.options[0]!.recommended).toBe(true);
    expect(d.options[0]!.title).toBe("Everything, just earlier");
  });

  it("Crazy Creek late: home by 11, a shorter soak, not a long night", () => {
    const e = eveningOf("crazy-creek")!;
    const d = departure({
      stops: templatePlan(e, sunset, day),
      leaveAt: 18 * 60 + 30,
      sunset,
      evening: e,
      day,
    });
    const by = d.options.find((o) => o.id === "home-by")!;
    expect(by.recommended).toBe(true);
    expect(by.home).toBeLessThanOrEqual(23 * 60);
    expect(d.options.find((o) => o.id === "keep")!.warnings[0]!.line).toMatch(
      /Long night/,
    );
  });

  it("a cold dip is never lengthened, whatever the leave time", () => {
    const e = eveningOf("cold-water")!;
    const plan = templatePlan(e, sunset, day);
    for (const leaveAt of [15 * 60, FOUR, 17 * 60 + 15]) {
      const d = departure({ stops: plan, leaveAt, sunset, evening: e, day });
      for (const o of d.options)
        expect(key(o.stops, "dip")?.minutes ?? 15).toBeLessThanOrEqual(15);
    }
  });

  it("reads the forecast when there is one, and says wet means colder up high", () => {
    const d = departure({
      stops: templatePlan(eddie, sunset, day, "wild"),
      leaveAt: FOUR,
      sunset,
      evening: eddie,
      day,
      forecast: {
        source: "Environment Canada",
        city: "Vernon",
        issuedAt: "2026-11-02T10:00:00Z",
        covers: "9 am – 6 pm",
        wettestChance: 70,
        words: ["Rain"],
      },
    });
    expect(d.weather).toContain("Environment Canada for Vernon: Rain, 70%");
    expect(d.weather).toContain("colder up high");
  });
});

describe("a leave-time plan, stored and read back", () => {
  it("keeps the drive to a skipped stop as a drive, not more hunting", () => {
    const d = departure({
      stops: templatePlan(eddie, sunset, day, "wild"),
      leaveAt: FOUR,
      sunset,
      evening: eddie,
      day,
    });
    const tight = d.options.find((o) => o.id === "tighter")!.stops;
    const back = planFromItems(
      tight.map((s, i) => ({
        id: `i${i}`,
        label: s.title,
        note: s.line,
        atlasRef: s.atlasRef ?? null,
        at: s.at,
        position: i,
      })),
      eddie,
      day,
    )!;
    const grouse = (s: readonly PlanStop[]) => key(s, "grouse")!;
    expect(grouse(back).minutes).toBe(grouse(tight).minutes);
    expect(key(back, "sunset")!.travel).toBe(10);
    expect(back.map((s) => s.at)).toEqual(tight.map((s) => s.at));
  });
});
