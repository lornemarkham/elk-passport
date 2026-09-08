import { describe, expect, it } from "vitest";
import { inspirationShelves } from "./inspirationShelves";
import type { Experience } from "@/domain/experience/types";

const base = (
  over: Partial<Experience> & { id: string; title: string },
): Experience =>
  ({
    kind: "Place",
    slug: over.title.toLowerCase().replaceAll(" ", "-"),
    shortDescription: "",
    detailReady: true,
    regionIds: [],
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    ...over,
  }) as Experience;

const NOW = new Date("2026-09-07T12:00:00Z");

describe("inspirationShelves", () => {
  it("groups on fields Atlas actually states, never on invented ones", () => {
    // `moods`, `seasons` and `companions` are empty for every Atlas candidate
    // by design — the mapper refuses to fabricate them. A shelf that needed
    // them would be permanently empty in production.
    const shelves = inspirationShelves(
      [
        base({ id: "1", title: "Kalamalka Lake", subtype: "lake" }),
        base({ id: "2", title: "Kal Beach", subtype: "beach" }),
        base({
          id: "3",
          title: "Paddlewheel Boat Launch",
          subtype: "boat launch",
        }),
      ],
      NOW,
    );
    const water = shelves.find((s) => s.id === "water");
    expect(water?.experiences.map((e) => e.id)).toEqual(["1", "2", "3"]);
  });

  it("puts dated things first, soonest first — they are the only cards that expire", () => {
    const shelves = inspirationShelves(
      [
        base({ id: "p", title: "Ellison Park", subtype: "park" }),
        base({
          id: "late",
          title: "Later Show",
          kind: "Event",
          startTime: "2026-09-20T02:00:00Z",
        }),
        base({
          id: "soon",
          title: "Sooner Show",
          kind: "Event",
          startTime: "2026-09-09T02:00:00Z",
        }),
      ],
      NOW,
    );
    expect(shelves[0]!.id).toBe("soon");
    expect(shelves[0]!.experiences.map((e) => e.id)).toEqual(["soon", "late"]);
  });

  it("leaves out an event that has already happened", () => {
    const shelves = inspirationShelves(
      [
        base({
          id: "old",
          title: "Last Month",
          kind: "Event",
          startTime: "2026-08-01T02:00:00Z",
        }),
      ],
      NOW,
    );
    expect(shelves.find((s) => s.id === "soon")).toBeUndefined();
  });

  it("never repeats one experience across shelves", () => {
    // A card in four shelves makes twelve shelves feel like three.
    const shelves = inspirationShelves(
      [
        base({ id: "1", title: "Knox Mountain Park", subtype: "park" }),
        base({ id: "2", title: "Lakeside Trail", subtype: "trail" }),
        base({ id: "3", title: "Beach Park Cafe", subtype: "cafe" }),
        base({ id: "4", title: "Big White Gallery", subtype: "gallery" }),
        base({ id: "5", title: "Something Else", subtype: "misc" }),
        base({ id: "6", title: "Another Thing", subtype: "misc" }),
        base({ id: "7", title: "Third Thing", subtype: "misc" }),
      ],
      NOW,
    );
    const ids = shelves.flatMap((s) => s.experiences.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sweeps the remainder into a last shelf so nothing Atlas knows is unreachable", () => {
    const odd = [1, 2, 3, 4].map((n) =>
      base({ id: `o${n}`, title: `Curiosity ${n}`, subtype: "unknown" }),
    );
    const shelves = inspirationShelves(odd, NOW);
    expect(shelves.at(-1)!.id).toBe("unexpected");
    expect(shelves.at(-1)!.experiences).toHaveLength(4);
  });

  it("leads each shelf with cards that have a picture, without hiding the rest", () => {
    const shelves = inspirationShelves(
      [
        base({ id: "noPic", title: "Quiet Park", subtype: "park" }),
        base({
          id: "pic",
          title: "Photogenic Park",
          subtype: "park",
          heroMedia: { type: "image", src: "https://x/y.jpg" },
        }),
        base({ id: "noPic2", title: "Another Park", subtype: "park" }),
      ],
      NOW,
    );
    const kids = shelves.find((s) => s.id === "kids")!;
    expect(kids.experiences[0]!.id).toBe("pic");
    expect(kids.experiences).toHaveLength(3);
  });

  it("drops a shelf too thin to look like a selection", () => {
    const shelves = inspirationShelves(
      [base({ id: "1", title: "Lonely Winery", subtype: "winery" })],
      NOW,
    );
    expect(shelves.find((s) => s.id === "eat")).toBeUndefined();
  });

  it("returns nothing at all rather than empty shelves when there is nothing", () => {
    expect(inspirationShelves([], NOW)).toEqual([]);
  });
});
