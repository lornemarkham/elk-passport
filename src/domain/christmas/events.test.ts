import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { Experience } from "@/domain/experience/types";
import {
  answer,
  directionsOf,
  findsIn,
  readAsk,
  statedPlace,
} from "./discover";
import { readChristmas } from "./themes";

/**
 * **The Vernon and Silver Star events Atlas published in mission 1042**
 * (owner brief M1046), read the way the Christmas pages read them.
 *
 * `m1042-as-published.json` is the 17 records as production Atlas served
 * them on 2026-11-23, taken from gohaveaday.com's own Discovery payload:
 * every one is `geography: unknown`, because venue linking has not run yet
 * (Atlas mission 1044). `m1042-placed.json` is the same records with the
 * town each one is held in stood in for that link — Vernon's centre and
 * Silver Star's village point, the points Passport already measures from —
 * so the tests say what the page does the moment Atlas places them.
 */
const read = (file: string): Experience[] =>
  (
    JSON.parse(
      readFileSync(`e2e/fixtures/christmas-events/${file}`, "utf8"),
    ) as { candidates: DiscoveryCandidate[] }
  ).candidates.map(candidateToExperience);

const TODAY = "2026-11-23";
const published = read("m1042-as-published.json");
const placed = read("m1042-placed.json");
const nearIds = (at: string, km: number, extra: Record<string, string> = {}) =>
  answer(findsIn(placed, TODAY), readAsk({ at, km: String(km), ...extra }), {
    today: TODAY,
  })
    .shelves.filter((s) => s.id === "near")
    .flatMap((s) => s.finds.map((f) => f.experience.title));

describe("Atlas's M1042 Christmas events in GoHaveADay Christmas", () => {
  it("reads 16 of the 17 as Christmas — the holidays count, said by an event held in them", () => {
    const out = published.filter((e) => !readChristmas(e)).map((e) => e.title);
    // Nothing in the record says holiday, Christmas or festive: a paint class.
    expect(out).toEqual(["Vaz Art Paint & Sip"]);
    for (const title of [
      "Stars on Ice - 2026 Holiday Tour",
      "12 Days of Holidays",
      "Salomon Rail Jam",
      "Comedy Hypnosis Show",
      "Silver Star New Years Eve Celebration",
    ])
      expect(
        readChristmas(published.find((e) => e.title === title)!)?.christmas,
      ).toBe(true);
  });

  it("does not read a holiday word outside the season, or a Holiday Inn", () => {
    const base = published.find((e) => e.title === "12 Days of Holidays")!;
    expect(
      readChristmas({ ...base, startTime: "2026-07-01T18:00:00.000Z" }),
    ).toBeNull();
    expect(
      readChristmas({
        ...base,
        kind: "Place",
        title: "Holiday Inn Express",
        subtype: "Hotel",
        description: "Rooms near the lake.",
        startTime: undefined,
      }),
    ).toBeNull();
  });

  it("today, unplaced, they are held apart — counted, offered behind one link, never called near", () => {
    const result = answer(
      findsIn(published, TODAY),
      readAsk({ at: "vernon" }),
      { today: TODAY },
    );
    expect(result.total).toBe(0);
    expect(result.unplaced).toBeGreaterThanOrEqual(14);
    const shown = answer(
      findsIn(published, TODAY),
      readAsk({ at: "vernon", place: "all" }),
      { today: TODAY },
    );
    expect(
      shown.shelves.find((s) => s.id === "unplaced")?.finds.length,
    ).toBeGreaterThanOrEqual(14);
  });

  it("once Atlas places them, a Vernon family sees every one of them, nearest first", () => {
    const near = nearIds("vernon", 30);
    for (const title of [
      "Frostival 2026 Downtown Vernon",
      "Downtown Vernon Christmas Saturdays",
      "Artsolutely 21st Annual Holiday Artisan Market & Fundraiser",
      "Stars on Ice - 2026 Holiday Tour",
      "Festive Saturday Science",
      "Silver Star Annual Light Up",
      "Santa Ski Day",
      "Christmas Eve Carol Service",
      "Silver Star New Years Eve Celebration",
    ])
      expect(near).toContain(title);
    // Three Saturdays of one event are one card.
    expect(near.filter((t) => t === "Festive Saturday Science")).toHaveLength(
      1,
    );
  });

  it("somebody staying at Silver Star sees the village's events, not Vernon's", () => {
    const near = nearIds("silverstar", 5);
    expect(near).toContain("Silver Star Annual Light Up");
    expect(near).toContain("Salomon Rail Jam");
    expect(near).not.toContain("Frostival 2026 Downtown Vernon");
  });

  it("browsing a date finds what is on that day", () => {
    const eve = nearIds("vernon", 30, { from: "2026-12-24", to: "2026-12-24" });
    expect(eve).toEqual(
      expect.arrayContaining(["Santa Ski Day", "Christmas Eve Carol Service"]),
    );
    expect(eve).not.toContain("Frostival 2026 Downtown Vernon");
    expect(
      nearIds("vernon", 30, { from: "2026-11-27", to: "2026-11-27" }),
    ).toContain("Frostival 2026 Downtown Vernon");
  });

  it("says where the organiser says it is, and gives directions only where there is somewhere to go", () => {
    const frostival = published.find((e) => e.title.startsWith("Frostival"))!;
    expect(directionsOf(frostival)).toBeUndefined();
    // As Atlas's detail read states it for Frostival.
    const stated = {
      ...frostival,
      knowledge: {
        ...frostival.knowledge,
        practical: [
          {
            label: "Location",
            value:
              "Downtown Vernon, 30th Avenue between 30th Street and 34th Street, Vernon, BC V1T 2C3",
          },
        ],
      },
    } as Experience;
    expect(statedPlace(stated)).toMatch(/^Downtown Vernon, 30th Avenue/);
    expect(directionsOf(stated)).toContain(
      encodeURIComponent("Downtown Vernon, 30th Avenue"),
    );
    const there = placed.find((e) => e.title.startsWith("Frostival"))!;
    expect(directionsOf(there)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=50.267,-119.272",
    );
  });
});
