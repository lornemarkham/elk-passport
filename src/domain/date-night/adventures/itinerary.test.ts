import { describe, expect, it } from "vitest";
import { sunsetOf } from "./compose";
import { eveningOf } from "./evenings";
import {
  addStop,
  clock,
  endingOf,
  homeAt,
  moveStop,
  planFromItems,
  removeStop,
  switchEnding,
  templatePlan,
  untouched,
  warningsFor,
  type PlanStop,
} from "./itinerary";
import { diffPlans, readRequest, substantial } from "./say";
import { TOMORROW } from "./tomorrow";

const day = TOMORROW;
const sunset = sunsetOf(day)!;
const eddie = eveningOf("king-eddie")!;
const wild = templatePlan(eddie, sunset, day, "wild");
const warm = templatePlan(eddie, sunset, day, "warm");
const at = (stops: readonly PlanStop[], key: string) =>
  stops.find((s) => s.key === key)!;
const say = (s: string, stops: readonly PlanStop[] = wild) => {
  const r = readRequest(s, stops, eddie, day, sunset);
  if (r.kind !== "change") throw new Error(r.reply);
  return r;
};

describe("King Eddie Lake, laid out against Monday's sunset", () => {
  it("is 5:33 pm, BC legal time", () => {
    expect(clock(sunset)).toBe("5:35 pm");
    expect(sunset).toBe(17 * 60 + 33);
  });

  it("leaves at 2:15, hunts in daylight, and is at the lake for sunset", () => {
    expect(clock(wild[0]!.at)).toBe("2:15 pm");
    const grouse = at(wild, "grouse");
    expect(grouse.at + grouse.minutes).toBeLessThanOrEqual(sunset);
    expect(Math.abs(at(wild, "sunset").at - (sunset - 10))).toBeLessThanOrEqual(
      5,
    );
    expect(warningsFor(wild, sunset, eddie, day)).toEqual([]);
  });

  it("stays wild by default and is home about 8:20", () => {
    expect(endingOf(wild, eddie)?.id).toBe("wild");
    expect(wild.map((s) => s.key)).toEqual([
      "leave",
      "grouse",
      "lake",
      "dip",
      "sunset",
      "fire",
      "stars",
      "home",
    ]);
    expect(clock(homeAt(wild)!)).toBe("8:20 pm");
  });

  it("the warm ending keeps the lake and ends at BNA, open on a Monday", () => {
    const switched = switchEnding(wild, eddie, "warm", sunset, day);
    expect(switched.slice(0, 5)).toEqual(wild.slice(0, 5));
    expect(switched.map((s) => s.key).slice(5)).toEqual(["dinner", "home"]);
    expect(at(switched, "dinner").atlasRef).toBe(
      "0ff70057-6723-47bb-8f05-2c6dec38dead",
    );
    expect(warningsFor(switched, sunset, eddie, day)).toEqual([]);
    expect(switched).toEqual(warm);
  });

  it("switching the ending keeps someone's own changes before it", () => {
    const longer = say("more time at the lake").stops;
    const switched = switchEnding(longer, eddie, "warm", sunset, day);
    expect(at(switched, "lake").minutes).toBe(at(longer, "lake").minutes);
  });
});

describe("one sentence, the same itinerary", () => {
  it("leave earlier and get home by eight", () => {
    const r = say("Let's leave earlier and get home by eight.");
    expect(clock(r.stops[0]!.at)).toBe("1:45 pm");
    expect(homeAt(r.stops)!).toBeLessThanOrEqual(20 * 60);
    expect(r.stops.map((s) => s.key)).toEqual(wild.map((s) => s.key));
    // The extra daylight went to the grouse; sunset is still at the lake.
    expect(at(r.stops, "grouse").minutes).toBeGreaterThan(
      at(wild, "grouse").minutes,
    );
    expect(
      Math.abs(at(r.stops, "sunset").at - (sunset - 10)),
    ).toBeLessThanOrEqual(5);
  });

  it("more time at the lake and home by eight", () => {
    const r = say("Let's spend more time at the lake and get home by eight");
    expect(at(r.stops, "lake").minutes).toBe(at(wild, "lake").minutes + 30);
    expect(homeAt(r.stops)!).toBeLessThanOrEqual(20 * 60);
  });

  it("an hour earlier", () => {
    const r = say("Can we leave an hour earlier?");
    expect(clock(r.stops[0]!.at)).toBe("1:15 pm");
  });

  it("skip the swim", () => {
    const r = say("Let's skip the swim");
    expect(r.stops.some((s) => s.key === "dip")).toBe(false);
    expect(r.stops).toHaveLength(wild.length - 1);
    expect(substantial(diffPlans(wild, r.stops))).toBe(true);
  });

  it("somewhere warm for dinner switches the ending, lake intact", () => {
    const r = say("Find somewhere warm for dinner.");
    expect(endingOf(r.stops, eddie)?.id).toBe("warm");
    expect(r.stops.slice(0, 5).map((s) => s.title)).toEqual(
      wild.slice(0, 5).map((s) => s.title),
    );
  });

  it("more romantic moves dinner to a romantic Atlas place, honestly", () => {
    const r = say("Make it a little more romantic", warm);
    const dinner = at(r.stops, "dinner");
    expect(dinner.title).toBe("Dinner at The Edge Restaurant");
    expect(r.heard.join(" ")).toMatch(/no hours/i);
  });

  it("something fun along the way is a real place that's open", () => {
    const r = say("Find something fun along the way");
    const added = r.stops.find((s) => s.key?.startsWith("atlas:"));
    expect(added?.title).toBe("Planet Bee Honey Farm");
    expect(warningsFor(r.stops, sunset, eddie, day)).toEqual([]);
  });

  it("changes nothing it doesn't understand", () => {
    const r = readRequest("purple monkey dishwasher", wild, eddie, day, sunset);
    expect(r.kind).toBe("none");
  });

  it("leaving at 5 says the hunt is too late", () => {
    const r = say("leave at 5");
    expect(
      warningsFor(r.stops, sunset, eddie, day)
        .map((w) => w.line)
        .join(" "),
    ).toMatch(/hunt|sunset/i);
  });
});

describe("hand edits", () => {
  it("move, remove and add keep leaving and home in place", () => {
    expect(moveStop(wild, 0, 1, sunset, eddie, day)).toBeNull();
    const moved = moveStop(wild, 5, 1, sunset, eddie, day)!;
    expect(moved.map((s) => s.key).slice(5, 7)).toEqual(["stars", "fire"]);
    const removed = removeStop(wild, 3, sunset, eddie, day)!;
    expect(removed.some((s) => s.key === "dip")).toBe(false);
    const added = addStop(
      wild,
      { title: "Hot chocolate at the truck", line: "", minutes: 20, travel: 0 },
      undefined,
      sunset,
      eddie,
      day,
    );
    expect(added[added.length - 2]!.title).toBe("Hot chocolate at the truck");
    expect(added[added.length - 1]!.key).toBe("home");
    expect(homeAt(added)!).toBe(homeAt(wild)! + 20);
    expect(untouched(wild, eddie, sunset, day)).toBe(true);
    expect(untouched(added, eddie, sunset, day)).toBe(false);
  });

  it("reads back from stored items exactly as it was written", () => {
    const items = warm.map((s, i) => ({
      id: `i${i}`,
      label: s.title,
      note: s.line,
      atlasRef: s.atlasRef ?? null,
      at: s.at,
      position: i,
    }));
    const back = planFromItems(items, eddie, day)!;
    expect(back.map(({ id: _id, ...s }) => s)).toEqual(warm);
    expect(planFromItems([{ ...items[0]!, at: null }], eddie, day)).toBeNull();
  });
});
