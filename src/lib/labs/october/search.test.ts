import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/movies/catalogue";
import { MAKING } from "@/lib/making/catalogue";
import type { Experience } from "@/domain/experience/types";
import {
  possibilityFromAtlas,
  possibilityFromDoing,
  possibilityFromFilm,
  type Possibility,
} from "./possibility";
import { search, termsOf } from "./search";

/**
 * **Two searches decide whether one box over everything is worth having.**
 *
 * `pumpkin` has to reach a farm whose *name* does not say pumpkin, because
 * that is the shape of the best answers in this corpus. `scary` has to reach a
 * haunted house that never uses the word, because almost nothing describes
 * itself as scary. If either only matched titles, the box would be a worse
 * version of knowing where things are.
 */

const atlas = (
  title: string,
  description: string,
  setting: Possibility["setting"] = "unknown",
): Possibility =>
  possibilityFromAtlas(
    {
      id: title,
      kind: "Place",
      slug: title,
      title,
      description,
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
    } as Experience,
    { days: [], setting, today: "2026-10-01" },
  );

const POOL: readonly Possibility[] = [
  atlas(
    "The Apple Bin",
    "A family farm with a pumpkin patch and a corn maze every autumn.",
    "outdoor-day",
  ),
  atlas(
    "Black Mountain Haunted House",
    "Three storeys of it, and a queue down the drive.",
    "outdoor-night",
  ),
  atlas("Vernon Public Library", "Books, and a quiet room.", "indoor"),
  atlas("Web of Rooms", "A gallery in a corner of the old post office."),
  ...CATALOGUE.map(possibilityFromFilm),
  ...MAKING.map(possibilityFromDoing),
];

const titles = (query: string) =>
  search(POOL, query).map((h) => h.possibility.title);

describe("one box over everything", () => {
  it("finds a farm whose name never says pumpkin", () => {
    expect(titles("pumpkin")).toContain("The Apple Bin");
  });

  it("crosses the three bodies of evidence in one answer", () => {
    const sources = new Set(
      search(POOL, "pumpkin").map((h) => h.possibility.source),
    );
    expect(sources.size).toBeGreaterThan(1);
    expect(sources.has("doing")).toBe(true);
  });

  it("finds the haunted house when somebody types scary", () => {
    const found = titles("scary");
    expect(found).toContain("Black Mountain Haunted House");
    // And does not agree with everything: a library is not scary.
    expect(found).not.toContain("Vernon Public Library");
  });

  it("does not match a word inside another word", () => {
    // "corn" used to find "Web of Rooms" through "corner", which is the kind
    // of result that makes somebody stop trusting a search box.
    expect(titles("corn maze")).not.toContain("Web of Rooms");
    expect(titles("corn maze")).toContain("The Apple Bin");
  });

  it("still reaches an inflection in a title", () => {
    // Prefix matching is kept where it is safe: titles and tags.
    expect(termsOf("haunt")).toContain("haunt");
    expect(titles("haunt")).toContain("Black Mountain Haunted House");
  });

  it("ranks the thing a person actually named first", () => {
    expect(titles("black mountain")[0]).toBe("Black Mountain Haunted House");
  });

  it("drops the words nobody searches on", () => {
    expect(termsOf("I want to do something with the kids")).not.toContain(
      "want",
    );
    expect(termsOf("I want to do something with the kids")).toContain(
      "with-kids",
    );
  });

  it("returns nothing rather than everything for an empty query", () => {
    expect(search(POOL, "")).toEqual([]);
    expect(search(POOL, "   ")).toEqual([]);
  });

  it("returns nothing for a word October does not hold", () => {
    expect(search(POOL, "snowmobiling")).toEqual([]);
  });
});

describe("the words people actually type", () => {
  it("reaches a singular record from a typed plural", () => {
    // Atlas calls it "Draconid meteor shower 2026". Nobody types that.
    expect(termsOf("draconids")).toContain("draconid");
    expect(termsOf("pumpkins")).toContain("pumpkin");
  });

  it("keeps the plural too, so a plural record still matches", () => {
    expect(termsOf("costumes")).toContain("costumes");
  });

  it("leaves short words alone, so 'puppets' does not become 'puppet' twice over", () => {
    expect(termsOf("bus")).toEqual(["bus"]);
  });
});
