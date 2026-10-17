import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { readAsk } from "@/lib/ai/ask/read";
import {
  ACTIVITIES,
  ACTIVITY_GROUPS,
  activitiesOf,
  activityByKey,
  activityEvidence,
  activityExplorer,
  activityForDoing,
  activityIn,
  activityMatches,
  activityOffers,
  doesActivity,
  inSeason,
  relatedActivities,
  seasonLine,
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

describe("the vocabulary, as a whole", () => {
  it("puts every activity on a shelf, and every narrow one after its broad one", () => {
    const groups = new Set(ACTIVITY_GROUPS.map((g) => g.key));
    ACTIVITIES.forEach((activity, index) => {
      expect(activity.groups.length, activity.key).toBeGreaterThan(0);
      for (const g of activity.groups) expect(groups.has(g)).toBe(true);
      if (activity.within) {
        const parent = ACTIVITIES.findIndex((a) => a.key === activity.within);
        expect(parent, activity.key).toBeGreaterThanOrEqual(0);
        expect(parent).toBeLessThan(index);
      }
      for (const key of activity.related ?? [])
        expect(activityByKey(key), `${activity.key} → ${key}`).toBeDefined();
    });
  });

  it("never gives one word to two activities", () => {
    const owner = new Map<string, string>();
    for (const activity of ACTIVITIES)
      for (const word of activity.words) {
        expect(owner.get(word), `"${word}"`).toBeUndefined();
        owner.set(word, activity.key);
      }
  });

  it("reads every label, said alone, as that activity and nothing else", () => {
    for (const activity of ACTIVITIES) {
      const ask = readAsk(activity.label, { today: "2026-10-16" });
      expect(ask.doing, activity.label).toBe(activity.key);
      expect(ask.avoid, activity.label).toBeUndefined();
    }
  });

  it("names the mission's activities, each in a person's words", () => {
    for (const [said, key] of [
      ["birdwatching", "birdwatching"],
      ["where can we see birds", "birdwatching"],
      ["skiing", "skiing"],
      ["snowboarding", "snowboarding"],
      ["snowshoeing", "snowshoeing"],
      ["cross-country skiing", "cross-country-skiing"],
      ["ice skating", "skating"],
      ["kayaking", "kayaking"],
      ["paddleboarding", "paddleboarding"],
      ["mountain biking", "mountain-biking"],
      ["climbing", "climbing"],
      ["camping", "camping"],
      ["wildlife watching", "wildlife-watching"],
      ["photography", "photography"],
      ["bowling", "bowling"],
      ["a museum", "museums"],
      ["the theatre", "theatre"],
      ["live music", "live-music"],
    ] as const)
      expect(activityIn(said)?.key, said).toBe(key);
  });
});

/**
 * **The committed Atlas fixture** (2,979 real candidates, 2026-10-11) — the
 * vocabulary measured against Atlas's actual words, not examples of them.
 */
const fixture = (
  JSON.parse(
    gunzipSync(
      readFileSync(
        "docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz",
      ),
    ).toString(),
  ) as DiscoveryCandidate[]
).map(candidateToExperience);

describe("against Atlas's own words", () => {
  it("puts every place in a narrow activity in its broad one too", () => {
    for (const activity of ACTIVITIES.filter((a) => a.within)) {
      const parent = activityByKey(activity.within)!;
      for (const e of fixture)
        if (activityEvidence(e, activity).length > 0)
          expect(
            activityEvidence(e, parent).length,
            `${e.title} is ${activity.key} but not ${parent.key}`,
          ).toBeGreaterThan(0);
    }
  });

  it("finds birdwatching where Atlas says birding, and nowhere it does not", () => {
    const birding = fixture.filter((e) => doesActivity(e, "birdwatching"));
    const titles = birding.map((e) => e.title);
    expect(titles).toContain("Allan Brooks Nature Centre");
    for (const e of birding)
      expect(
        activityEvidence(e, activityByKey("birdwatching")!).join(" "),
      ).toMatch(/bird/i);
  });

  it("finds skiing at the ski hills, and not on a water-ski beach", () => {
    const skiing = fixture.filter((e) => doesActivity(e, "skiing"));
    const titles = skiing.map((e) => e.title);
    expect(titles).toEqual(
      expect.arrayContaining(["Silver Star Mountain Resort"]),
    );
    for (const e of skiing)
      expect(
        activityEvidence(e, activityByKey("skiing")!).join(" "),
      ).not.toMatch(/water|cross-country|nordic/i);
  });
});

describe("the explorer", () => {
  const birding = thing(doing("Birdwatching"));
  const lake = thing(doing("Kayaking", "Fishing"));
  const hill = thing({ subtype: "ski resort" });
  const far = thing(doing("Bowling"));

  it("lists every activity, rare ones and out-of-season ones included", () => {
    const groups = activityExplorer(
      [birding, lake, hill],
      [birding, lake, hill, far],
      {
        day: "2026-10-16",
      },
    );
    const entry = (key: string) =>
      groups.flatMap((g) => g.entries).find((e) => e.activity.key === key)!;
    expect(entry("birdwatching").here).toHaveLength(1);
    expect(entry("skiing").here).toHaveLength(1);
    expect(entry("skiing").inSeason).toBe(false);
    // Atlas holds it, just not here.
    expect(entry("bowling").here).toHaveLength(0);
    expect(entry("bowling").anywhere).toBe(1);
    // Atlas holds nothing for it at all.
    expect(entry("casinos").anywhere).toBe(0);
    expect(groups.map((g) => g.label)).toEqual(
      ACTIVITY_GROUPS.map((g) => g.label),
    );
  });

  it("keeps the narrow activities off the row, which offers the broad one", () => {
    const keys = activityOffers([lake, lake], { day: "2026-07-01" }).map(
      (o) => o.activity.key,
    );
    expect(keys).toContain("paddling");
    expect(keys).not.toContain("kayaking");
  });

  it("knows what is close to an activity", () => {
    expect(relatedActivities("kayaking").map((a) => a.key)).toEqual([
      "paddling",
      "canoeing",
      "paddleboarding",
    ]);
    expect(relatedActivities("birdwatching").map((a) => a.key)).toEqual(
      expect.arrayContaining(["wildlife", "wildlife-watching"]),
    );
    expect(relatedActivities("skiing").map((a) => a.key)).toContain(
      "snowboarding",
    );
  });

  it("finds an activity by a word, a label or a shelf", () => {
    const find = (q: string) =>
      ACTIVITIES.filter((a) => activityMatches(a, q)).map((a) => a.key);
    expect(find("birds")).toEqual(["birdwatching"]);
    expect(find("kayak")).toContain("kayaking");
    expect(find("winter")).toEqual(
      expect.arrayContaining(["skiing", "snowshoeing", "skating"]),
    );
  });

  it("says when an out-of-season activity usually is", () => {
    expect(seasonLine(activityByKey("skiing")!)).toBe("December to March");
    expect(seasonLine(activityByKey("kayaking")!)).toBe("May to September");
    expect(seasonLine(activityByKey("museums")!)).toBeUndefined();
  });
});
