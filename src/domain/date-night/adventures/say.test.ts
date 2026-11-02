import { describe, expect, it } from "vitest";
import { sunsetOf } from "./compose";
import { eveningOf, type EveningId } from "./evenings";
import {
  clock,
  homeAt,
  templatePlan,
  warningsFor,
  type PlanStop,
} from "./itinerary";
import { readRequest } from "./say";
import { TOMORROW } from "./tomorrow";

/**
 * **The brief's six sentences, on every adventure** (mission 495). Each one
 * either changes the plan in a way a person would agree with, or changes
 * nothing and says why — never a place Atlas doesn't hold, never a longer
 * cold dip.
 */

const day = TOMORROW;
const sunset = sunsetOf(day)!;

function plan(id: EveningId, ending?: string) {
  const e = eveningOf(id)!;
  return { e, stops: templatePlan(e, sunset, day, ending) };
}

function read(id: EveningId, said: string, ending?: string) {
  const { e, stops } = plan(id, ending);
  return { r: readRequest(said, stops, e, day, sunset), before: stops, e };
}

const titles = (stops: readonly PlanStop[]) => stops.map((s) => s.title);
const find = (stops: readonly PlanStop[], title: RegExp) =>
  stops.find((s) => title.test(s.title))!;

describe("“Let's leave later”", () => {
  it("King Eddie: half an hour later, the grouse gives the time back and the sunset stays", () => {
    const { r, before } = read("king-eddie", "Let's leave later.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(clock(r.stops[0]!.at)).toBe("2:45 pm");
    expect(r.heard[0]).toMatch(
      /less for grouse, so you still catch the sunset/,
    );
    expect(clock(find(r.stops, /^Sunset/).at)).toBe(
      clock(find(before, /^Sunset/).at),
    );
    expect(titles(r.stops)).toEqual(titles(before));
  });

  it("Crazy Creek: half an hour later, everything follows", () => {
    const { r } = read("crazy-creek", "Let's leave later.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(clock(r.stops[0]!.at)).toBe("5:30 pm");
  });
});

describe("“Get us home by eight”", () => {
  it("King Eddie: trims after the sunset, never the sunset", () => {
    const { r } = read("king-eddie", "Get us home by eight.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(clock(homeAt(r.stops)!)).toBe("8:00 pm");
    expect(r.heard[0]).toMatch(/less time for stars/);
  });

  it("Crazy Creek: says it doesn't fit rather than pretending", () => {
    const { r } = read("crazy-creek", "Get us home by eight.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(r.heard[0]).toMatch(/doesn't fit without dropping something/);
    expect(r.heard.join(" ")).not.toMatch(/closes at/);
  });
});

describe("“Find somewhere warm for dinner”", () => {
  it("King Eddie: the warm ending, the lake untouched", () => {
    const { r } = read("king-eddie", "Find somewhere warm for dinner.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(titles(r.stops)).toContain("Dinner at BNA Brewing");
    expect(titles(r.stops)).not.toContain("Stars");
  });

  it("Crazy Creek: dinner to go becomes a sit-down dinner at a place Atlas holds, open then; the pools still close at 10", () => {
    const { r, e } = read("crazy-creek", "Find somewhere warm for dinner.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(titles(r.stops)).toContain("Dinner at BNA Brewing");
    expect(titles(r.stops)).not.toContain("Dinner to go in Vernon");
    const pools = find(r.stops, /Hot Pools/);
    expect(pools.at + pools.minutes).toBeLessThanOrEqual(22 * 60);
    expect(r.heard.join(" ")).toMatch(/closes at 10:00 pm/);
    expect(warningsFor(r.stops, sunset, e, day)).toEqual([
      { line: "Home after 11:00 pm. Long night." },
    ]);
  });

  it("Cold Water: already warm, so nothing changes, and it says so", () => {
    const { r } = read("cold-water", "Find somewhere warm for dinner.");
    expect(r).toEqual({
      kind: "none",
      reply: "Dinner's already somewhere warm: BNA Brewing.",
    });
  });
});

describe("“Skip the swim”", () => {
  it("King Eddie: the dip comes off", () => {
    const { r } = read("king-eddie", "Skip the swim.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(titles(r.stops)).not.toContain("A quick dip, if you dare");
  });

  it("Crazy Creek: the pools are the adventure, so they stay", () => {
    const { r } = read("crazy-creek", "Skip the swim.");
    expect(r.kind).toBe("none");
    if (r.kind === "none") expect(r.reply).toMatch(/choose another adventure/);
  });
});

describe("“Make it more romantic”", () => {
  it("King Eddie, staying wild: longer under the stars", () => {
    const { r } = read("king-eddie", "Make it more romantic.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(r.heard[0]).toBe("Twenty more minutes for stars.");
  });

  it("King Eddie, warm ending: a romantic dinner Atlas holds, its unknown hours said", () => {
    const { r } = read("king-eddie", "Make it more romantic.", "warm");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(r.heard[0]).toMatch(/^Dinner moves to The Edge Restaurant/);
    expect(r.heard[0]).toMatch(/Atlas has no hours/);
  });

  it("Crazy Creek: later, for the adults-only hour, and never past closing", () => {
    const { r } = read("crazy-creek", "Make it more romantic.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(r.heard[0]).toMatch(/adults-only hour, 9 to 10/);
    const pools = find(r.stops, /Hot Pools/);
    expect(clock(pools.at + pools.minutes)).toBe("10:00 pm");
  });
});

describe("“We want more time at the lake”", () => {
  it("King Eddie: the lake stop, half an hour more", () => {
    const { r } = read("king-eddie", "We want more time at the lake.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(find(r.stops, /^Explore King Edward Lake/).minutes).toBe(60);
  });

  it("Cold Water: by the water, never a longer cold dip", () => {
    const { r, before } = read("cold-water", "We want more time at the lake.");
    if (r.kind !== "change") throw new Error(r.reply);
    expect(find(r.stops, /^The dip/).minutes).toBe(
      find(before, /^The dip/).minutes,
    );
    expect(find(r.stops, /^Warm up/).minutes).toBe(55);
  });

  it("Crazy Creek: there is no lake, and it says so", () => {
    const { r } = read("crazy-creek", "We want more time at the lake.");
    expect(r).toEqual({
      kind: "none",
      reply: "There's no lake on Crazy Creek Escape, so nothing changed there.",
    });
  });
});

describe("what it can't do, it says", () => {
  it("a place Atlas doesn't hold is never invented", () => {
    for (const said of [
      "Find us a sushi place",
      "Can we go bowling instead?",
    ]) {
      const { r } = read("king-eddie", said);
      expect(r.kind).toBe("none");
      if (r.kind === "none") expect(r.reply).toMatch(/won't make one up/);
    }
  });

  it("nonsense lists what it understands", () => {
    const { r } = read("king-eddie", "purple monkey dishwasher");
    if (r.kind !== "none") throw new Error("changed");
    expect(r.reply).toMatch(/^I didn't catch a change in that. I understand/);
  });

  it("already home in time is a note, not a change", () => {
    const { r } = read("cold-water", "home by ten");
    expect(r.kind).toBe("none");
  });
});
