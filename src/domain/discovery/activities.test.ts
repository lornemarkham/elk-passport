import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import {
  ACTIVITIES,
  activitiesOf,
  activityEvidence,
  activityForDoing,
  activityIn,
  activityOffers,
  inSeason,
} from "./activities";

let n = 0;
const thing = (over: Partial<DiscoveryCandidate>) =>
  candidateToExperience({
    id: `t-${(n += 1)}`,
    kind: "Place",
    name: `Thing ${n}`,
    subtype: "park",
    description: "Somewhere.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    ...over,
  });
const doing = (...names: string[]) => ({
  knowledge: {
    affordances: names.map((name) => ({ name, basis: "offers" })),
  },
});

describe("activities, in a person's words", () => {
  it("every label reads back as its own activity", () => {
    for (const activity of ACTIVITIES)
      expect(activityIn(activity.label)?.key, activity.label).toBe(
        activity.key,
      );
  });

  it("gathers Atlas's many spellings of one idea", () => {
    for (const verb of [
      "Hiking",
      "walking/hiking",
      "Hike",
      "Short hike",
      "Walking",
    ])
      expect(activitiesOf(thing(doing(verb))).map((a) => a.key)).toContain(
        "hiking",
      );
    for (const verb of ["Canoeing", "Kayaking", "SUP", "Paddleboarding"])
      expect(activitiesOf(thing(doing(verb))).map((a) => a.key)).toContain(
        "paddling",
      );
    expect(activitiesOf(thing(doing("Biking"))).map((a) => a.key)).toContain(
      "cycling",
    );
    expect(
      activitiesOf(thing(doing("mountain biking"))).map((a) => a.key),
    ).toEqual(["mountain-biking"]);
  });

  it("reads what a place is, where it lists no verbs", () => {
    expect(
      activitiesOf(thing({ subtype: "cinema" })).map((a) => a.key),
    ).toEqual(["movies"]);
    expect(
      activitiesOf(thing({ subtype: "museum" })).map((a) => a.key),
    ).toContain("museums");
    // A film commission is not a night at the movies.
    expect(activitiesOf(thing({ subtype: "film commission" }))).toEqual([]);
  });

  it("never offers an amenity as something to do", () => {
    const toilets = thing({
      knowledge: { features: ["Washrooms", "Drinking water", "ATM"] },
    });
    expect(activitiesOf(toilets)).toEqual([]);
    const play = thing({
      knowledge: { features: ["Playground", "Washrooms"] },
    });
    expect(activitiesOf(play).map((a) => a.key)).toEqual(["playgrounds"]);
  });

  it("says which Atlas words put a place in an activity", () => {
    const lake = thing(doing("Kayaking", "Canoeing", "Fishing"));
    const paddling = ACTIVITIES.find((a) => a.key === "paddling")!;
    expect(activityEvidence(lake, paddling)).toEqual(["Kayaking", "Canoeing"]);
  });

  it("understands an old ?doing= verb", () => {
    expect(activityForDoing("Hiking")?.key).toBe("hiking");
    expect(activityForDoing("Swimming")?.key).toBe("swimming");
    expect(activityForDoing("paddling")?.key).toBe("paddling");
  });
});

describe("what is offered", () => {
  const pool = [
    thing(doing("Hiking")),
    thing(doing("Hiking")),
    thing({ subtype: "museum" }),
    thing({ subtype: "museum" }),
    thing({ subtype: "ski resort" }),
    thing({ subtype: "ski resort" }),
    thing({ subtype: "winery" }),
    thing({ subtype: "winery" }),
  ];
  const keys = (context: Parameters<typeof activityOffers>[1]) =>
    activityOffers(pool, context).map((o) => o.activity.key);

  it("skiing is not a first idea in October, and is in January", () => {
    expect(keys({ day: "2026-10-16" })).not.toContain("skiing");
    expect(keys({ day: "2027-01-16" })).toContain("skiing");
    const skiing = ACTIVITIES.find((a) => a.key === "skiing")!;
    expect(inSeason(skiing, "2026-10-16")).toBe(false);
  });

  it("leans with the situation without inventing anything", () => {
    expect(keys({ day: "2026-10-16", wet: true })[0]).toBe("museums");
    expect(
      keys({ day: "2026-10-16", child: true }).indexOf("wine"),
    ).toBeGreaterThan(
      keys({ day: "2026-10-16", child: true }).indexOf("museums"),
    );
    expect(keys({ day: "2026-10-16", without: ["hiking"] })).not.toContain(
      "hiking",
    );
  });
});
