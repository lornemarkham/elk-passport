import { describe, expect, it } from "vitest";
import {
  OCTOBER_AREAS,
  areaById,
  hasPassed,
  hrefForArea,
  throughLens,
} from "./areas";
import type { Experience } from "@/domain/experience/types";

const thing = (title: string, extra: Partial<Experience> = {}): Experience =>
  ({
    id: title,
    kind: "Organization",
    slug: title,
    title,
    shortDescription: "",
    detailReady: false,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 3,
    priceLevel: 1,
    duration: { min: 60, max: 120 },
    ...extra,
  }) as unknown as Experience;

describe("the areas themselves", () => {
  it("every area resolves to a destination", () => {
    for (const area of OCTOBER_AREAS) {
      expect(hrefForArea(area)).toMatch(/^\/october\//);
      expect(areaById(area.id)).toBe(area);
    }
  });

  it("an area with nothing behind it says so, and offers no lens", () => {
    for (const area of OCTOBER_AREAS.filter((a) => a.status === "later")) {
      expect(area.nothingYet).toBeTruthy();
      expect(area.terms ?? []).toEqual([]);
    }
  });

  it("anything claiming to be live has somewhere real to read from", () => {
    for (const area of OCTOBER_AREAS.filter((a) => a.status === "live")) {
      expect(Boolean(area.href) || Boolean(area.terms?.length)).toBe(true);
    }
  });

  it("ids are unique, so a route can never be ambiguous", () => {
    const ids = OCTOBER_AREAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("throughLens", () => {
  const pumpkin = areaById("pumpkin-day")!;

  it("finds real entities by what Atlas already publishes", () => {
    const out = throughLens(
      [
        thing("McMillan Farms", { shortDescription: "Pumpkin patch." }),
        thing("A Sushi Bar", { shortDescription: "Raw fish." }),
      ],
      pumpkin,
    );
    expect(out.map((e) => e.title)).toEqual(["McMillan Farms"]);
  });

  it("ranks a name above a passing mention", () => {
    const out = throughLens(
      [
        thing("Corner Café", {
          shortDescription: "Farm to table, with a pumpkin latte.",
        }),
        thing("Gambell Farms", { shortDescription: "" }),
      ],
      pumpkin,
    );
    expect(out[0]!.title).toBe("Gambell Farms");
  });

  it("prefers something it can show a picture of when scores tie", () => {
    const bare = thing("Orchard A");
    const shown = thing("Orchard B", {
      heroMedia: { type: "image", src: "x" } as Experience["heroMedia"],
    });
    expect(throughLens([bare, shown], pumpkin)[0]!.title).toBe("Orchard B");
  });

  it("returns nothing for an area that has no lens, rather than everything", () => {
    const costumes = areaById("costumes")!;
    expect(throughLens([thing("Anything at all")], costumes)).toEqual([]);
  });

  it("honours the limit so a surface cannot become a dump", () => {
    const many = Array.from({ length: 30 }, (_, i) => thing(`Farm ${i}`));
    expect(throughLens(many, pumpkin, 6)).toHaveLength(6);
  });
});

describe("expired events", () => {
  const NOW = new Date("2026-09-23T20:00:00Z");
  const haunts = areaById("events-haunts")!;
  const event = (title: string, start?: string, end?: string): Experience =>
    thing(title, {
      kind: "Event",
      startTime: start,
      endTime: end,
    } as Partial<Experience>);

  it("knows what is already over, and what merely has no date", () => {
    // Both real Black Mountain occurrences in the corpus are dated 2025.
    expect(
      hasPassed(
        event("Scary Hours", "2025-10-19T00:00:00Z", "2025-11-02T00:00:00Z"),
        NOW,
      ),
    ).toBe(true);
    expect(hasPassed(event("Fall Fest", "2026-10-03T17:00:00Z"), NOW)).toBe(
      false,
    );
    // Absent is not past. Dropping an undated event would invent a fact.
    expect(hasPassed(event("Someday"), NOW)).toBe(false);
  });

  it("keeps last year's haunted house out of what is on", () => {
    const found = throughLens(
      [
        event(
          "The Black Mountain Haunted House (Scary Hours)",
          "2025-10-19T00:00:00Z",
          "2025-11-02T00:00:00Z",
        ),
        event(
          "Haunted Hayride",
          "2026-10-20T00:00:00Z",
          "2026-10-31T00:00:00Z",
        ),
      ],
      haunts,
      12,
      NOW,
    );
    expect(found.map((e) => e.title)).toEqual(["Haunted Hayride"]);
  });

  it("still surfaces undated things, which are most of the corpus", () => {
    const found = throughLens(
      [thing("Black Mountain Haunted House")],
      haunts,
      12,
      NOW,
    );
    expect(found.map((e) => e.title)).toEqual(["Black Mountain Haunted House"]);
  });

  it("falls back to the real clock when none is supplied", () => {
    const over = event(
      "Ghost Tour",
      "2019-10-01T00:00:00Z",
      "2019-10-02T00:00:00Z",
    );
    expect(throughLens([over], haunts)).toEqual([]);
  });
});
