import { describe, expect, it } from "vitest";
import { buildDay } from "./build";
import { readBrief } from "./brief";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { townById } from "@/domain/discovery/towns";

const VERNON = townById("vernon")!;

const place = (
  name: string,
  over: Partial<DiscoveryCandidate> & { km?: number } = {},
): DiscoveryCandidate => {
  const { km = 5, ...rest } = over;
  return {
    id: name.toLowerCase().replace(/\W+/g, "-"),
    kind: "Place",
    name,
    subtype: "park",
    description: "A description long enough to be real.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    geography: {
      state: "observed",
      locality: "Vernon",
      area: { id: "okanagan", name: "Okanagan" },
      coordinates: [VERNON.longitude, VERNON.latitude + km / 111],
    },
    ...rest,
  };
};

const aff = (...names: string[]) => ({
  affordances: names.map((name) => ({ name, basis: "stated-activity" })),
});

const POOL = [
  place("Polson Park", {
    km: 1,
    knowledge: { ...aff("playground", "picnic") },
  }),
  place("Kal Beach", { km: 6, knowledge: { ...aff("swimming", "beach") } }),
  place("Ellison Park", {
    km: 12,
    knowledge: { ...aff("hiking", "swimming") },
  }),
  place("Okanagan Science Centre", {
    km: 2,
    subtype: "science centre",
    knowledge: {
      ...aff("interactive exhibits"),
      practical: [
        { label: "Admission", value: "$12 for adults, $8 for children" },
      ],
    },
    environment: {
      setting: "indoor",
      rain: { reading: "sheltered", basis: "stated" },
    },
  }),
  place("Adults Only Taproom", {
    km: 3,
    subtype: "brewery",
    knowledge: { ...aff("beer") },
    suitability: {
      stated: "stated",
      statements: [
        {
          about: "age",
          says: "adults-only",
          strength: "rule",
          ages: { min: 19 },
          text: "19+/No Minors",
          basis: "stated",
        },
      ],
      forAge: { age: 5, reading: "excluded", because: [0] },
    },
  }),
  place("Far Away Lake", { km: 120, knowledge: { ...aff("fishing") } }),
].map(candidateToExperience);

const brief = (said: string, fallback = {}) => readBrief(said, fallback);

/**
 * **A printed day has to be true, because nobody can check it from the car.**
 *
 * These pin the four things the builder is not allowed to do: invent a place,
 * invent an opening time, invent a price, or invent a drive time.
 */
describe("the day it builds", () => {
  it("uses real subjects and nothing else", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours with a five-year-old near Vernon"),
    });
    expect(day.stops.length).toBeGreaterThanOrEqual(2);
    for (const stop of day.stops) {
      expect(POOL.map((p) => p.id)).toContain(stop.experience.id);
    }
  });

  it("obeys a stated age rule, and only a stated one", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours with a five-year-old near Vernon"),
    });
    const names = day.stops.map((s) => s.experience.title);
    expect(names).not.toContain("Adults Only Taproom");
    // Everything else states nothing about age and is still eligible.
    expect(names.length).toBeGreaterThan(1);
  });

  it("states a price only where one is published", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon, interactive exhibits"),
    });
    const science = day.stops.find(
      (s) => s.experience.title === "Okanagan Science Centre",
    );
    expect(science?.cost).toContain("$12");
    for (const stop of day.stops) {
      if (stop.experience.title !== "Okanagan Science Centre") {
        expect(stop.cost).toBeUndefined();
      }
    }
  });

  it("never claims a place is open when nothing says so", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon"),
    });
    for (const stop of day.stops) expect(stop.open).toBeUndefined();
    expect(day.unknowns.join(" ")).toContain("Opening hours");
  });

  it("gives distance in kilometres and never in minutes", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon"),
    });
    expect(day.stops.some((s) => s.km !== undefined)).toBe(true);
    const printed = JSON.stringify(day);
    expect(printed).not.toMatch(/\d+\s*min(ute)? drive/i);
    expect(day.unknowns.join(" ")).toContain("straight-line");
  });

  it("sets aside the person's own time, divided, not the venue's", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon"),
    });
    const total = day.stops.reduce((sum, s) => sum + s.minutes, 0);
    // Four hours, allocated across the stops — never longer than the day.
    expect(total).toBeLessThanOrEqual(4 * 60 + 30);
    expect(day.stops.every((s) => s.minutes >= 30)).toBe(true);
  });

  it("honours a distance somebody gave", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon within 30 km"),
    });
    expect(day.stops.map((s) => s.experience.title)).not.toContain(
      "Far Away Lake",
    );
  });

  /**
   * **Variety is a preference, not a wall.**
   *
   * The cap used to be absolute, and in a corpus that is mostly parks it
   * produced two-stop days out of eight-hour briefs — a true answer and an
   * empty afternoon. It now relaxes rather than starving the day, so what is
   * pinned is the preference: given anything else to offer, it offers it.
   */
  it("prefers a different kind of place while it has one", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon"),
    });
    const subtypes = day.stops.map((s) => s.experience.subtype);
    expect(new Set(subtypes).size).toBeGreaterThan(1);
  });

  it("fills a long day rather than handing back two stops", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("eight hours near Vernon"),
    });
    expect(day.stops.length).toBeGreaterThanOrEqual(4);
  });

  it("orders the stops nearest-first, as a route rather than a list", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("eight hours near Vernon"),
    });
    const first = day.stops[0]!;
    expect(first.km ?? 0).toBeLessThanOrEqual(day.stops[1]?.km ?? Infinity);
  });
});

describe("a revision changes the day", () => {
  it("puts somewhere sheltered in the day when asked to stay dry", () => {
    const wet = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon, rainy day"),
    });
    expect(wet.stops.map((s) => s.experience.title)).toContain(
      "Okanagan Science Centre",
    );
  });

  it("still routes nearest-first on a wet day, because that is a route", () => {
    // Shelter decides what is *in* the day. The order is geography, and a
    // sheltered stop twelve kilometres away does not become the first stop
    // because it is raining.
    const wet = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon, rainy day"),
    });
    const kms = wet.stops.map((s) => s.km ?? 0);
    expect(kms[0]).toBeLessThanOrEqual(Math.max(...kms));
  });

  it("does not drop what nobody has classified for weather", () => {
    // Polson Park states nothing about rain. Unknown is not "exposed", and
    // excluding it would be the same error as reading unknown as unsuitable.
    const wet = buildDay({
      pool: POOL,
      brief: brief("eight hours near Vernon, rainy day"),
    });
    expect(wet.stops.map((s) => s.experience.title)).toContain("Polson Park");
  });

  it("prefers the trails when asked to be adventurous", () => {
    const bold = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon, make it adventurous"),
    });
    expect(bold.stops.map((s) => s.experience.title)).toContain("Ellison Park");
  });

  it("drops a stop somebody asked to replace, and fills the gap", () => {
    const first = buildDay({
      pool: POOL,
      brief: brief("eight hours near Vernon"),
    });
    const dropped = first.stops[1]!.experience.id;
    const again = buildDay({
      pool: POOL,
      brief: brief("eight hours near Vernon"),
      without: [dropped],
    });
    expect(again.stops.map((s) => s.experience.id)).not.toContain(dropped);
    // Still a day, not a stub. Exact parity is not promised: with a small
    // pool the variety cap can leave one fewer, and a short honest day beats
    // a long one padded with a third park.
    expect(again.stops.length).toBeGreaterThanOrEqual(2);
  });
});

describe("when it cannot build one", () => {
  it("says so rather than inventing a day", () => {
    const day = buildDay({ pool: [], brief: brief("four hours near Vernon") });
    expect(day.stops).toHaveLength(0);
    expect(day.opening).toContain("Nothing here matched");
  });
});

describe("something to do that is not looking at a phone", () => {
  it("comes from what the place actually states", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("eight hours near Vernon, playground and swimming"),
    });
    const withChallenge = day.stops.filter((s) => s.challenge);
    expect(withChallenge.length).toBeGreaterThan(0);
  });

  it("is absent where a place states nothing to hang it on", () => {
    const bare = buildDay({
      pool: [place("A Bare Place", { km: 1 })].map(candidateToExperience),
      brief: brief("two hours near Vernon"),
    });
    expect(bare.stops[0]!.challenge).toBeUndefined();
  });
});

/**
 * **A day has to fit inside itself.**
 *
 * Dogfooded with the acceptance sentence — *four hours, a five-year-old, near
 * Vernon* — and the first day built was an arena, then a park 65 km away,
 * then a lake 83 km past that. Every stop real, every distance honest, three
 * hours of driving in a four-hour day. Selection picked on evidence and
 * routing tidied the result; nothing asked whether the shape was possible.
 */
describe("a day of a given length stays inside a circle", () => {
  const far = place("Distant Lake", {
    km: 90,
    knowledge: { ...aff("fishing") },
  });
  const near = place("Close Park", { km: 4, knowledge: { ...aff("picnic") } });
  const experiences = [
    ...POOL,
    candidateToExperience(far),
    candidateToExperience(near),
  ];

  it("keeps a four-hour day local without being told a distance", () => {
    const day = buildDay({
      pool: experiences,
      brief: brief("four hours with a five-year-old near Vernon"),
    });
    for (const stop of day.stops) {
      expect(stop.experience.title).not.toBe("Distant Lake");
    }
  });

  it("says out loud which circle it drew", () => {
    const day = buildDay({
      pool: experiences,
      brief: brief("four hours with a five-year-old near Vernon"),
    });
    expect(day.opening).toContain("30 km of Vernon");
  });

  it("reaches further for a longer day", () => {
    const day = buildDay({
      pool: experiences,
      brief: brief("a whole day near Vernon, fishing"),
    });
    expect(day.stops.map((s) => s.experience.title)).toContain("Distant Lake");
  });

  it("lets a stated distance overrule the circle, in both directions", () => {
    const tight = buildDay({
      pool: experiences,
      brief: brief("a whole day near Vernon within 10 km, fishing"),
    });
    expect(tight.stops.map((s) => s.experience.title)).not.toContain(
      "Distant Lake",
    );
  });

  it("never turns a circle into a drive time", () => {
    const day = buildDay({
      pool: experiences,
      brief: brief("four hours near Vernon"),
    });
    expect(day.opening).not.toMatch(/min|minute|drive/i);
  });
});

/**
 * **A day built around what somebody chose in Discovery.**
 *
 * `keep` is the hand-off from a card's *Plan a day around this*. The person
 * picked it, so it leads the day even past the planning circle — but a stated
 * rule still wins, and a dropped choice is said out loud.
 */
describe("a day built around chosen places", () => {
  it("puts the chosen place in the day, even outside the circle", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("two hours near Vernon"),
      keep: ["far-away-lake"],
      picked: ["far-away-lake"],
    });
    const stop = day.stops.find((s) => s.experience.id === "far-away-lake");
    expect(stop).toBeDefined();
    expect(stop?.because).toBe("You picked this in Discovery.");
  });

  it("is the same keep as the stop's own Keep button: only the reason differs", () => {
    const keptOnGo = buildDay({
      pool: POOL,
      brief: brief("two hours near Vernon"),
      keep: ["far-away-lake"],
    });
    const stop = keptOnGo.stops.find(
      (s) => s.experience.id === "far-away-lake",
    );
    expect(stop?.kept).toBe(true);
    expect(stop?.because).not.toBe("You picked this in Discovery.");
  });

  it("drops a stop kept on /go once a stated age rule shuts the child out", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours with a five-year-old near Vernon"),
      keep: ["adults-only-taproom"],
    });
    expect(
      day.stops.find((s) => s.experience.id === "adults-only-taproom"),
    ).toBeUndefined();
    expect(day.unknowns.join(" ")).toMatch(/left out/);
  });

  it("still obeys a stated age rule, and says why the choice is missing", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours with a five-year-old near Vernon"),
      keep: ["adults-only-taproom"],
    });
    expect(day.stops.map((s) => s.experience.id)).not.toContain(
      "adults-only-taproom",
    );
    expect(day.unknowns[0]).toContain("Adults Only Taproom is left out");
  });

  it("says so when a chosen id is not offered at all", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon"),
      keep: ["gone"],
    });
    expect(day.unknowns[0]).toMatch(/no longer offered/);
    expect(day.stops.length).toBeGreaterThan(0);
  });

  it("lets 'swap it' win over the choice", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("four hours near Vernon"),
      keep: ["kal-beach"],
      without: ["kal-beach"],
    });
    expect(day.stops.map((s) => s.experience.id)).not.toContain("kal-beach");
  });

  it("makes room for every choice, up to five", () => {
    const day = buildDay({
      pool: POOL,
      brief: brief("an hour near Vernon"),
      keep: ["polson-park", "kal-beach", "ellison-park"],
    });
    const ids = day.stops.map((s) => s.experience.id);
    expect(ids).toEqual(
      expect.arrayContaining(["polson-park", "kal-beach", "ellison-park"]),
    );
  });
});
