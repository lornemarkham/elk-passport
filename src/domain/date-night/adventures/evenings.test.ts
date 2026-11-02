import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sunsetOf } from "./compose";
import { EVENINGS, eveningNamed, eveningQuery, LEAVE, THREE } from "./evenings";
import { TOMORROW } from "./tomorrow";
import { stopsFrom, askFrom } from "@/lib/adventures/days";

const sunset = sunsetOf(TOMORROW)!;

describe("the three evenings", () => {
  it("are Into the Wild, Jess's Crazy Creek and Cold Water, Warm Fire", () => {
    expect(THREE.map((e) => e.title)).toEqual([
      "Into the Wild",
      "Crazy Creek Escape",
      "Cold Water, Warm Fire",
    ]);
    expect(THREE[1]!.pick).toBe("Jess's Pick");
  });

  it("each opens on a real photograph that ships with the app", () => {
    for (const e of EVENINGS) {
      expect(
        fs.existsSync(path.join(process.cwd(), "public", e.photo.src)),
      ).toBe(true);
      expect(e.photo.license).toMatch(/^CC/);
      expect(e.photo.page).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it("leave about 5 and run in time order", () => {
    for (const e of THREE) {
      const beats = e.beats(sunset);
      expect(beats[0]!.at).toBe(LEAVE);
      for (let i = 1; i < beats.length; i++)
        expect(beats[i]!.at).toBeGreaterThan(beats[i - 1]!.at);
      expect(beats.filter((b) => b.main)).toHaveLength(1);
    }
  });

  it("put the cold water and the view in daylight", () => {
    const cold = eveningNamed("Cold Water, Warm Fire")!.beats(sunset);
    const dip = cold.find((b) => b.main)!;
    const next = cold[cold.indexOf(dip) + 1]!;
    expect(next.at).toBeLessThan(sunset);
    const wild = eveningNamed("Into the Wild")!.beats(sunset);
    expect(wild.find((b) => b.main)!.at).toBeLessThan(sunset);
  });

  it("never plans hunting after dark", () => {
    const wild = eveningNamed("Into the Wild")!;
    const text = wild
      .beats(sunset)
      .map((b) => `${b.title} ${b.line}`)
      .join(" ");
    expect(text).not.toMatch(/\bhunt/i);
    expect(wild.otherwise!(sunset)).toContain("6:33pm");
  });

  it("reach Crazy Creek with time to soak before it closes at 10", () => {
    const pools = eveningNamed("Crazy Creek Escape")!
      .beats(sunset)
      .find((b) => b.main)!;
    expect(pools.at).toBeLessThanOrEqual(21 * 60 - 90);
  });

  it("save as an ordinary shared day where Atlas has the places", () => {
    const cold = eveningNamed("Cold Water, Warm Fire")!;
    const query = eveningQuery(cold, TOMORROW)!;
    expect(stopsFrom(query)).toEqual([...cold.stops]);
    expect(new URLSearchParams(askFrom(query)!).get("evening")).toBe(
      "cold-water",
    );
    expect(new URLSearchParams(query).get("on")).toBe("2026-11-02");
    // Crazy Creek isn't in Atlas: it is named, not invented as a stop.
    expect(eveningQuery(eveningNamed("Crazy Creek Escape")!, TOMORROW)).toBe(
      null,
    );
  });
});
