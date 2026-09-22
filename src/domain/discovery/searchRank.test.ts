import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import {
  normalizeForSearch,
  rankByQuery,
  rankQuery,
  searchTokens,
} from "./searchRank";

/**
 * The M10 frozen cohort, as a fixture corpus shaped like the real one: the
 * named Places, the neighbours that share their tokens, the towns whose
 * names appear inside intent queries, and the descriptions that made the old
 * substring matcher return what it returned.
 */

const exp = (
  id: string,
  title: string,
  description: string,
  over: Partial<Experience> = {},
): Experience => ({
  id,
  kind: "Place",
  slug: id,
  title,
  shortDescription: description,
  description,
  detailReady: true,
  regionIds: [],
  moods: [],
  activities: [],
  seasons: [],
  timeOfDay: [],
  weather: [],
  companions: [],
  energyLevel: 1,
  priceLevel: 0,
  duration: { minMinutes: 0, maxMinutes: 0 },
  familyFriendly: false,
  petFriendly: false,
  requiresReservation: false,
  isActive: true,
  ...over,
});

const corpus: Experience[] = [
  exp(
    "knox-park",
    "Knox Mountain Park",
    "Kelowna's largest natural area with trails for hiking to summit lookouts over downtown.",
  ),
  exp("knox", "Knox Mountain", "The mountain north of downtown Kelowna."),
  exp(
    "pauls-tomb",
    "Paul's Tomb Trail",
    "A trail in Knox Mountain Park along the lake.",
  ),
  exp("mckinley", "McKinley Mountain Park", "A park with trails."),
  exp("dilworth", "Dilworth Mountain Park", "A park with a lookout."),
  exp("kasugai", "Kasugai Gardens", "A Japanese garden downtown."),
  exp(
    "kal-park",
    "Kalamalka Lake Park",
    "A provincial park with beaches and hiking.",
    { aliases: ["Kalamalka Lake Provincial Park"] },
  ),
  exp("kal-lake", "Kalamalka Lake", "A lake of many colours."),
  exp("kal-beach", "Kal Beach", "A beach on Kalamalka Lake in Coldstream."),
  exp("okanagan-lake-park", "Okanagan Lake Park", "Beaches and camping."),
  exp("hurlburt", "Hurlburt Park", "A pet-friendly park with a dock."),
  exp("ellison", "Ellison Park", "A provincial park with beaches.", {
    aliases: ["Ellison Provincial Park"],
  }),
  exp("vernon", "Vernon", "A city in the North Okanagan.", {
    aliases: ["City of Vernon"],
  }),
  exp("kelowna", "Kelowna", "The largest city in the Okanagan."),
  exp("silver-star", "Silver Star Mountain Resort", "A ski resort."),
  exp("silverstar", "SilverStar Mountain Resort", "The resort's operator.", {
    kind: "Organization",
  }),
  exp("lakers", "Lakers Park", "A neighbourhood park."),
  exp("lake-country", "Lake Country Bike Park", "A bike park."),
  exp("downtown-marina", "Downtown Marina", "Moorage on the lake."),
  exp("gyro", "Gyro Beach", "One of the beaches in Kelowna."),
  exp("bx-falls", "BX Falls", "A waterfall.", {
    aliases: ["BX Falls waterfall"],
  }),
];

const ranked = (q: string) => rankByQuery(corpus, q).map((e) => e.id);
const tier = (id: string, q: string) =>
  rankQuery(
    corpus.find((e) => e.id === id)!,
    q,
  )?.tier;

describe("normalisation", () => {
  it("lower-cases, strips diacritics, turns separators into spaces, collapses", () => {
    expect(normalizeForSearch("  O'Keefe  Ranch — Café ")).toBe(
      "o keefe ranch cafe",
    );
    expect(searchTokens("Knox Mountain Park!")).toEqual([
      "knox",
      "mountain",
      "park",
    ]);
    expect(searchTokens("   ")).toEqual([]);
  });
});

describe("exact", () => {
  it.each([
    ["Knox Mountain Park", "knox-park"],
    ["Kasugai Gardens", "kasugai"],
    ["Kalamalka Lake Park", "kal-park"],
  ])("%s → %s at rank 1, tier 0", (q, id) => {
    expect(ranked(q)[0]).toBe(id);
    expect(tier(id, q)).toBe(0);
  });
});

describe("extra words are harmless when the name is fully present", () => {
  it("Knox Mountain Park first — the park above the mountain, because it explains more of the query", () => {
    expect(ranked("Knox Mountain Park first").slice(0, 2)).toEqual([
      "knox-park",
      "knox",
    ]);
    expect(tier("knox-park", "Knox Mountain Park first")).toBe(1);
  });
  it("show me Knox Mountain Park", () => {
    expect(ranked("show me Knox Mountain Park")[0]).toBe("knox-park");
  });
  it("Knox Mountain hiking — the mountain is the full name; the park is weak", () => {
    expect(ranked("Knox Mountain hiking")[0]).toBe("knox");
    expect(tier("knox-park", "Knox Mountain hiking")).toBe(3);
  });
  it("Kasugai gardens downtown", () => {
    expect(ranked("Kasugai gardens downtown")[0]).toBe("kasugai");
  });
  it("Kalamalka lake park swimming", () => {
    expect(ranked("Kalamalka lake park swimming").slice(0, 2)).toEqual([
      "kal-park",
      "kal-lake",
    ]);
  });
});

describe("partial: the query is the start of the name", () => {
  it("Knox Mountain — the mountain exactly, then the park by prefix", () => {
    expect(ranked("Knox Mountain").slice(0, 2)).toEqual(["knox", "knox-park"]);
  });
  it("Kasugai, Hurlburt", () => {
    expect(ranked("Kasugai")[0]).toBe("kasugai");
    expect(ranked("Hurlburt")[0]).toBe("hurlburt");
  });
  it("Kalamalka — the lake and the park first (shorter name first), mentions after", () => {
    expect(ranked("Kalamalka").slice(0, 2)).toEqual(["kal-lake", "kal-park"]);
    expect(tier("kal-beach", "Kalamalka")).toBe(4);
  });
});

describe("word order does not matter", () => {
  it("Mountain Knox Park", () => {
    expect(ranked("Mountain Knox Park").slice(0, 2)).toEqual([
      "knox-park",
      "knox",
    ]);
  });
  it("Park Kalamalka Lake — the park (3 tokens) above the lake (2)", () => {
    expect(ranked("Park Kalamalka Lake").slice(0, 2)).toEqual([
      "kal-park",
      "kal-lake",
    ]);
  });
});

describe("aliases are names", () => {
  it.each([
    ["Kalamalka Lake Provincial Park", "kal-park"],
    ["Ellison Provincial Park", "ellison"],
    ["City of Vernon", "vernon"],
    ["BX Falls waterfall", "bx-falls"],
  ])("%s → %s at rank 1 by alias", (q, id) => {
    expect(ranked(q)[0]).toBe(id);
    const m = rankQuery(
      corpus.find((e) => e.id === id)!,
      q,
    );
    expect(m?.tier).toBe(0);
    expect(m?.primary).toBe(false);
  });
  it("the name outranks an alias when otherwise equal", () => {
    const twin = exp("twin", "Vernon Parks", "x", { aliases: ["Vernon"] });
    expect(rankByQuery([twin, corpus[12]!], "Vernon")[0]?.id).toBe("vernon");
  });
});

describe("weak / typo-adjacent — on surviving exact tokens only", () => {
  it("Knox Mountian Park still finds the park, weakly", () => {
    expect(ranked("Knox Mountian Park")[0]).toBe("knox-park");
    expect(tier("knox-park", "Knox Mountian Park")).toBe(3);
  });
  it("Kalamalka Provincial finds the park through its alias, weakly", () => {
    expect(ranked("Kalamalka Provincial")[0]).toBe("kal-park");
    expect(tier("kal-park", "Kalamalka Provincial")).toBe(3);
  });
  it("Kasugai Garden is a prefix of Kasugai Gardens", () => {
    expect(tier("kasugai", "Kasugai Garden")).toBe(2);
  });
});

describe("negative and regression", () => {
  const strong = (q: string) =>
    corpus.filter((e) => (rankQuery(e, q)?.tier ?? 9) <= 1).map((e) => e.id);
  it.each([
    "mountain park",
    "first park",
    "lake",
    "downtown",
    "silver mountain",
  ])("%s has no exact or full-name hit", (q) => expect(strong(q)).toEqual([]));
  it("a town inside an intent query is weak, not strong", () => {
    expect(tier("kelowna", "hiking near Kelowna")).toBe(3);
    expect(tier("vernon", "parks in Vernon")).toBe(3);
  });
  it("the description floor keeps everything the old matcher found", () => {
    const old = (e: Experience, q: string) =>
      [e.title, e.shortDescription, e.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q.trim().toLowerCase());
    for (const q of ["beaches", "lake", "downtown", "Kalamalka", "Park"]) {
      const before = corpus.filter((e) => old(e, q)).map((e) => e.id);
      const after = new Set(ranked(q));
      for (const id of before) expect(after.has(id)).toBe(true);
    }
  });
  it("silver mountain reaches Silver Star weakly on two exact tokens; the one-word SilverStar spelling is not a prefix match (only the last query token may be a prefix)", () => {
    expect(tier("silver-star", "silver mountain")).toBe(3);
    expect(tier("silverstar", "silver mountain")).toBeUndefined();
  });
  it("an empty query keeps every experience in its arriving order", () => {
    expect(ranked("   ")).toEqual(corpus.map((e) => e.id));
  });
  it("ties are deterministic: arriving order", () => {
    expect(ranked("mountain park")).toEqual(ranked("mountain park"));
  });
});
