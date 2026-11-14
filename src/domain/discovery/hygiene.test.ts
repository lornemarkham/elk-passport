import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { forDiscoveryPool, zoneDay } from "./hygiene";
import { composeDiscovery, hasOwnPicture, pictureFirst } from "./compose";
import { nearSection } from "./proximity";

/**
 * **What Discovery's pool leaves behind** (owner brief M817: expired Halloween
 * activities, unrelated stock photos, hotels among things to do).
 */

let made = 0;

const make = (over: Partial<Experience> = {}): Experience =>
  ({
    id: `x${(made += 1)}`,
    kind: "Place",
    slug: "s",
    title: `A thing ${made}`,
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
    ...over,
  }) as Experience;

const dated = (from: string, to: string, over: Partial<Experience> = {}) =>
  make({
    kind: "Event",
    startTime: `${from}T00:00:00.000Z`,
    endTime: `${to}T00:00:00.000Z`,
    timePrecision: "day",
    ...over,
  });

// 2026-11-14 06:00 UTC is still Friday 2026-11-13 in Vancouver.
const NOVEMBER = new Date("2026-11-14T06:00:00.000Z");
const OCTOBER = new Date("2026-10-20T19:00:00.000Z");

const titles = (items: readonly Experience[]) => items.map((e) => e.title);

describe("forDiscoveryPool", () => {
  it("reads today where the subjects are, not on the server's UTC clock", () => {
    expect(zoneDay(NOVEMBER)).toBe("2026-11-13");
  });

  it("leaves out a dated thing whose last day has passed", () => {
    const pool = [
      dated("2026-10-31", "2026-10-31", { title: "Halloween Night Train" }),
      dated("2023-10-24", "2023-10-24", { title: "Spooky Swamp Swim" }),
      dated("2026-11-13", "2026-11-13", { title: "Tonight's concert" }),
      dated("2026-11-01", "2026-12-24", { title: "Lights all season" }),
    ];
    expect(titles(forDiscoveryPool(pool, NOVEMBER))).toEqual([
      "Tonight's concert",
      "Lights all season",
    ]);
  });

  it("leaves out stated days that are all behind us, unless Atlas cut them short", () => {
    const pool = [
      make({
        kind: "Experience",
        title: "Evening Haunt",
        availability: {
          basis: "stated-days",
          days: ["2026-10-30", "2026-10-31"],
        },
      }),
      make({
        title: "Long list",
        availability: {
          basis: "stated-days",
          days: ["2026-10-30"],
          moreDays: true,
        },
      }),
      make({
        title: "Still to come",
        availability: {
          basis: "stated-days",
          days: ["2026-10-30", "2026-11-20"],
        },
      }),
    ];
    expect(titles(forDiscoveryPool(pool, NOVEMBER))).toEqual([
      "Long list",
      "Still to come",
    ]);
  });

  it("holds Halloween-named subjects with no date out after October", () => {
    const pool = [
      make({ kind: "Organization", title: "Black Mountain Haunted House" }),
      make({ kind: "Organization", title: "Pete Murray's Pumpkin Patch" }),
      // The activity explorer's taxonomy, which says when a thing usually is.
      make({ kind: "Activity", title: "Pumpkin Picking" }),
      // Dated and not over: its own dates decide.
      dated("2026-11-20", "2026-11-20", { title: "Pumpkin Pie Bake-off" }),
      make({ kind: "Place", title: "Polson Park" }),
    ];
    expect(titles(forDiscoveryPool(pool, NOVEMBER))).toEqual([
      "Pumpkin Picking",
      "Pumpkin Pie Bake-off",
      "Polson Park",
    ]);
    // In season they are possibilities.
    expect(forDiscoveryPool(pool, OCTOBER)).toHaveLength(5);
  });

  it("drops stand-in photographs and keeps pictures of the thing", () => {
    const stock = make({
      title: "Pine Park",
      presentationImage: {
        url: "https://upload.wikimedia.org/pier.jpg",
        relationship: "category",
        confidence: "low",
        attribution: "Illustrative park photo. Not a photo of Pine Park.",
      },
    } as Partial<Experience>);
    const own = make({
      title: "Powerhouse Theatre",
      presentationImage: {
        url: "https://example.org/powerhouse.jpg",
        relationship: "exact",
        confidence: "high",
        attribution: "Powerhouse Theatre",
      },
    } as Partial<Experience>);
    const [a, b] = forDiscoveryPool([stock, own], NOVEMBER);
    expect(a!.presentationImage).toBeUndefined();
    expect(b!.presentationImage?.url).toBe(
      "https://example.org/powerhouse.jpg",
    );
    expect(hasOwnPicture(a!)).toBe(false);
    expect(hasOwnPicture(b!)).toBe(true);
  });
});

describe("pictures lead and beds are asked for", () => {
  it("puts a card with its own presented picture ahead of one with none", () => {
    const none = make({ title: "No picture" });
    const presented = make({
      title: "Venue photo",
      presentationImage: {
        url: "https://example.org/v.jpg",
        relationship: "venue",
        confidence: "medium",
        attribution: "The venue",
      },
    } as Partial<Experience>);
    expect(titles(pictureFirst([none, presented]))).toEqual([
      "Venue photo",
      "No picture",
    ]);
  });

  it("never offers a motel under Near you or More to explore", () => {
    const at = { latitude: 50.267, longitude: -119.272 };
    const motel = make({
      kind: "Organization",
      title: "Schell Motel Express",
      subtype: "motel",
      geography: {
        state: "observed",
        coordinates: [-119.272, 50.267],
      },
    } as Partial<Experience>);
    const museum = make({
      kind: "Organization",
      title: "Museum and Archives of Vernon",
      subtype: "unclassified thing",
      geography: {
        state: "observed",
        coordinates: [-119.271, 50.268],
      },
    } as Partial<Experience>);
    const near = nearSection([motel, museum], at);
    expect(titles(near?.items ?? [])).toEqual([
      "Museum and Archives of Vernon",
    ]);
    const rest = composeDiscovery([motel, museum], { now: NOVEMBER }).find(
      (s) => s.id === "rest",
    );
    expect(titles(rest?.items ?? [])).toEqual([
      "Museum and Archives of Vernon",
    ]);
  });
});
