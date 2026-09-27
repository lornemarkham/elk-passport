import { describe, expect, it } from "vitest";
import { asDiscoveryUnits, namesOf } from "./discoveryUnits";
import { happeningTonight } from "@/domain/october/calendar";
import type { Experience } from "@/domain/experience/types";

/**
 * **The seven cases the rule has to get right**, none of which mentions
 * Halloween: the rule reads one asserted edge and nothing about what a Thing is.
 */

const thing = (id: string, over: Partial<Experience> = {}): Experience =>
  ({
    id,
    kind: "Experience",
    slug: id,
    title: id,
    shortDescription: "",
    detailReady: true,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 3,
    priceLevel: 1,
    duration: { min: 60, max: 120 },
    ...over,
  }) as unknown as Experience;

const partOf = (id: string, name: string) =>
  ({ id, kind: "Experience", name }) as Experience["partOf"];

const days = (list: readonly string[]): Experience["availability"] => ({
  basis: "stated-days",
  days: [...list],
});

// An attraction with two modes, the shape ADR 054 describes and the corpus holds.
const ATTRACTION = thing("attraction", { title: "The attraction" });
const EVENING = thing("evening", {
  title: "Evening option",
  partOf: partOf("attraction", "The attraction"),
  availability: days(["2026-10-16", "2026-10-17"]),
});
const AFTERNOON = thing("afternoon", {
  title: "Afternoon option",
  partOf: partOf("attraction", "The attraction"),
  availability: days(["2026-10-17"]),
});
const UNRELATED = thing("elsewhere", {
  title: "Something else",
  availability: days(["2026-10-17"]),
});
const ALL = [ATTRACTION, EVENING, AFTERNOON, UNRELATED];

const shape = (units: ReturnType<typeof asDiscoveryUnits>) =>
  units.map(
    (u) =>
      `${u.head.title}${u.options.length ? ` → ${namesOf(u).join(", ")}` : ""}`,
  );

describe("asDiscoveryUnits", () => {
  it("presents a whole with the parts that matched — 1, 3", () => {
    const saturday = new Date("2026-10-18T01:00:00Z"); // Sat 17 Oct, 18:00 Okanagan
    // The options keep the lane's own order, which for claim-bearing subjects
    // is by name — not the order they were declared in.
    expect(
      shape(asDiscoveryUnits(happeningTonight(ALL, saturday), ALL)),
    ).toEqual([
      "The attraction → Afternoon option, Evening option",
      "Something else",
    ]);
  });

  it("names only the part that is actually on — 2", () => {
    const friday = new Date("2026-10-17T01:00:00Z"); // Fri 16 Oct
    expect(shape(asDiscoveryUnits(happeningTonight(ALL, friday), ALL))).toEqual(
      ["The attraction → Evening option"],
    );
  });

  it("keeps a whole out of a lane when none of its parts is on — 4", () => {
    const monday = new Date("2026-10-20T01:00:00Z"); // Mon 19 Oct
    expect(asDiscoveryUnits(happeningTonight(ALL, monday), ALL)).toEqual([]);
    // And the whole is never given its parts' days.
    expect(ATTRACTION.availability).toBeUndefined();
  });

  it("leaves unrelated candidates separate — 5", () => {
    const units = asDiscoveryUnits([EVENING, UNRELATED], ALL);
    expect(shape(units)).toEqual([
      "The attraction → Evening option",
      "Something else",
    ]);
    expect(units[1]!.options).toEqual([]);
  });

  it("leaves an ordinary Event exactly as it was — 6", () => {
    const event = thing("event", {
      kind: "Event",
      title: "A concert",
      startTime: "2026-10-18T02:00:00Z",
      endTime: "2026-10-18T05:00:00Z",
    });
    const units = asDiscoveryUnits(
      happeningTonight([event, ...ALL], new Date("2026-10-18T03:00:00Z")),
      [event, ...ALL],
    );
    expect(units[0]!.head.id).toBe("event");
    expect(units[0]!.options).toEqual([]);
  });

  it("groups on nothing but the asserted edge — 7", () => {
    // Same name, same provider, side by side, no `includes` edge: two cards.
    const twin = thing("twin", {
      title: "The attraction",
      kind: "Organization",
    });
    const mode = thing("mode", {
      title: "A mode",
      availability: days(["2026-10-17"]),
    });
    const units = asDiscoveryUnits([twin, mode], [twin, mode]);
    expect(shape(units)).toEqual(["The attraction", "A mode"]);
  });

  it("stands a part on its own when Atlas does not offer its whole", () => {
    const orphan = thing("orphan", {
      title: "A mode with no whole",
      partOf: partOf("not-a-candidate", "Something Discovery cannot show"),
      availability: days(["2026-10-17"]),
    });
    expect(shape(asDiscoveryUnits([orphan], [orphan]))).toEqual([
      "A mode with no whole",
    ]);
  });

  it("follows a chain to the outermost whole, and survives a cycle", () => {
    const outer = thing("outer", { title: "Outer" });
    const middle = thing("middle", {
      title: "Middle",
      partOf: partOf("outer", "Outer"),
    });
    const inner = thing("inner", {
      title: "Inner",
      partOf: partOf("middle", "Middle"),
      availability: days(["2026-10-17"]),
    });
    expect(shape(asDiscoveryUnits([inner], [outer, middle, inner]))).toEqual([
      "Outer → Inner",
    ]);

    const a = thing("a", { title: "A", partOf: partOf("b", "B") });
    const b = thing("b", { title: "B", partOf: partOf("a", "A") });
    expect(asDiscoveryUnits([a], [a, b]).length).toBe(1);
  });
});
