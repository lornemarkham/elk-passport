import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { INTENTS, availableIntents, intentOf, withIntent } from "./intents";
import { normaliseSubtype } from "./defaultFeed";

/**
 * **A person arrives wanting to get outside, not wanting an `Organization`.**
 *
 * Discovery's primary chips were Atlas's `ExperienceKind`, printed: Places,
 * Food & business, Things to do, Events, Experiences. Correct, and nobody
 * thinks in it. These pin that intent membership is read from a subtype Atlas
 * states and from nothing else — no prose, no keywords, no score — and that an
 * intent cuts across kind, which is the whole reason it is worth having.
 */

const make = (subtype: string | undefined, kind = "Place"): Experience =>
  ({
    id: subtype ?? "none",
    kind,
    slug: "s",
    title: "A thing",
    subtype,
    shortDescription: "",
    isActive: true,
    detailReady: true,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 1,
    priceLevel: 0,
    duration: { minMinutes: 0, maxMinutes: 0 },
    regionIds: [],
    familyFriendly: false,
    petFriendly: false,
    requiresReservation: false,
  }) as Experience;

describe("what an intent claims", () => {
  it("reads real subtypes from the live corpus", () => {
    expect(intentOf(make("provincial park"))).toBe("outside");
    expect(intentOf(make("winery"))).toBe("eat");
    expect(intentOf(make("museum"))).toBe("culture");
    expect(intentOf(make("orchard"))).toBe("local");
    expect(intentOf(make("hotel"))).toBe("stay");
  });

  it("cuts across kind, which is the point", () => {
    // A winery is an Organization and a provincial park is a Place. Both are
    // answers to "what do you feel like doing"; neither is answered by kind.
    expect(intentOf(make("winery", "Organization"))).toBe("eat");
    expect(intentOf(make("winery", "Place"))).toBe("eat");
    expect(intentOf(make("park", "Organization"))).toBe("outside");
  });

  it("normalises the spelling Atlas happens to hold", () => {
    expect(intentOf(make("Café"))).toBe("eat");
    expect(intentOf(make("CAFE"))).toBe("eat");
    expect(intentOf(make("Farmers' Market"))).toBe("local");
  });

  it("says nothing about a subtype no intent names", () => {
    // Roughly half the corpus. Real knowledge, still searchable, and not an
    // answer to "what do you feel like doing" — so the remainder section gets
    // it rather than an intent pretending to.
    expect(intentOf(make("unknown"))).toBeUndefined();
    expect(intentOf(make("non-profit organization"))).toBeUndefined();
    expect(intentOf(make("company"))).toBeUndefined();
    expect(intentOf(make(undefined))).toBeUndefined();
  });

  it("never matches on prose", () => {
    // A description mentioning a park does not make a law firm a park.
    const lawyer = make("company");
    (lawyer as { shortDescription: string }).shortDescription =
      "Across from the park, beside the brewery, near the museum.";
    expect(intentOf(lawyer)).toBeUndefined();
  });
});

describe("one intent at most", () => {
  it("gives each subtype a single owner", () => {
    const seen = new Map<string, string>();
    for (const intent of INTENTS) {
      for (const raw of intent.subtypes) {
        // Compared normalised, because that is how membership is decided —
        // `café` and `cafe` are one subtype once Atlas's spelling is flattened.
        const subtype = normaliseSubtype(raw);
        expect(
          seen.has(subtype),
          `"${raw}" is claimed by both ${seen.get(subtype)} and ${intent.key}`,
        ).toBe(false);
        seen.set(subtype, intent.key);
      }
    }
  });

  it("keeps somewhere to stay apart from somewhere to eat", () => {
    // A hundred hotels inside "Eat and drink" was one of the reasons the old
    // feed read as a directory.
    expect(intentOf(make("resort"))).toBe("stay");
    expect(intentOf(make("restaurant"))).toBe("eat");
  });
});

describe("offering an intent", () => {
  it("filters a pool to one intent", () => {
    const pool = [make("park"), make("winery"), make("museum")];
    expect(withIntent(pool, "eat").map((e) => e.subtype)).toEqual(["winery"]);
  });

  it("does not offer a chip the pool cannot fill", () => {
    // A dead control is worse than an absent one.
    const offered = availableIntents([make("park"), make("winery")]);
    expect(offered.map((o) => o.intent.key)).toEqual(["outside", "eat"]);
  });

  it("counts what each would show", () => {
    const offered = availableIntents([
      make("park"),
      make("trail"),
      make("winery"),
    ]);
    expect(offered.find((o) => o.intent.key === "outside")!.count).toBe(2);
  });

  it("offers nothing at all over a pool that names no subtypes", () => {
    expect(availableIntents([make("unknown"), make(undefined)])).toEqual([]);
  });

  it("keeps the order the intents are declared in", () => {
    const offered = availableIntents([
      make("hotel"),
      make("park"),
      make("winery"),
    ]);
    expect(offered.map((o) => o.intent.key)).toEqual([
      "outside",
      "eat",
      "stay",
    ]);
  });
});
