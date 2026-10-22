import { describe, expect, it } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";
import {
  looksLikeNotAPhoto,
  nearbyFood,
  nearbyWithCurated,
  photoUsable,
  secureUrl,
  statedHoursOn,
  walkLabel,
} from "./nearby";

/**
 * Synthetic candidates — shapes, not places. No real Vancouver venue is
 * named here, because nothing here has been checked against Atlas.
 */
const ARENA: [number, number] = [49.2778, -123.1088];

function candidate(
  id: string,
  subtype: string,
  lngLat: [number, number] | undefined,
  basis: "observed" | "derived" = "observed",
  extra: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate {
  return {
    id,
    kind: "Place",
    name: `Synthetic ${id}`,
    subtype,
    geography: lngLat
      ? { state: basis, coordinates: lngLat, coordinatesBasis: basis }
      : { state: "unknown" },
    ...extra,
  } as unknown as DiscoveryCandidate;
}

describe("food near the arena", () => {
  const places = nearbyFood(
    [
      candidate("pub", "Pub", [-123.1065, 49.2785]), // ~0.2 km
      candidate("bistro", "bistro", [-123.115, 49.28]), // ~0.5 km
      candidate("museum", "museum", [-123.108, 49.278]), // close, not food
      candidate("far-cafe", "cafe", [-123.03, 49.26]), // ~6 km
      candidate("derived", "restaurant", [-123.109, 49.2779], "derived"),
      candidate("nowhere", "restaurant", undefined),
      candidate("atlas-measured", "brewery", undefined, "observed", {
        distance: { state: "measured", km: 0.9, basis: "coordinates" },
      } as Partial<DiscoveryCandidate>),
      candidate("town-centre", "restaurant", undefined, "observed", {
        distance: {
          state: "measured",
          km: 0.1,
          basis: "town",
          town: "Vancouver",
        },
      } as Partial<DiscoveryCandidate>),
    ],
    ARENA,
  );
  const ids = places.map((p) => p.atlasId);

  it("uses Discovery's own Eat & drink meaning, case and all", () => {
    expect(ids).toContain("pub");
    expect(ids).toContain("bistro");
    expect(ids).not.toContain("museum");
  });

  it("measures only what Atlas actually located, never a derived or town-centre point", () => {
    expect(ids).not.toContain("derived");
    expect(ids).not.toContain("nowhere");
    expect(ids).not.toContain("town-centre");
    expect(ids).toContain("atlas-measured");
  });

  it("stays within a walk, nearest first", () => {
    expect(ids).not.toContain("far-cafe");
    expect(ids).toEqual(["pub", "bistro", "atlas-measured"]);
  });

  it("calls every distance a straight-line estimate", () => {
    expect(places.every((p) => p.basis === "straight-line")).toBe(true);
    expect(walkLabel({ km: 0.21, walkMinutes: 3 })).toBe(
      "200 m straight line · 3+ min walk (estimate)",
    );
    expect(walkLabel({ km: 1.24, walkMinutes: 15 })).toBe(
      "1.2 km straight line · 15+ min walk (estimate)",
    );
  });
});

describe("curated places beside Atlas", () => {
  const curated = [
    {
      id: "curated:test:pub",
      name: "Synthetic pub",
      kind: "bar" as const,
      address: "1 Test St",
      neighbourhood: "Test",
      at: [49.2785, -123.1088] as const,
      blurb: "A synthetic pub.",
      source: {
        osm: "https://www.openstreetmap.org/node/1",
        checked: "2026-10-19",
      },
    },
    {
      id: "curated:test:station",
      name: "Synthetic station",
      kind: "meeting" as const,
      address: "2 Test St",
      neighbourhood: "Test",
      at: [49.278, -123.1088] as const,
      blurb: "Not food.",
      source: {
        osm: "https://www.openstreetmap.org/node/2",
        checked: "2026-10-19",
      },
    },
  ];

  it("fills in when Atlas has nothing, and says the place is curated", () => {
    const places = nearbyWithCurated([], curated, ARENA);
    expect(places.map((p) => [p.atlasId, p.source])).toEqual([
      ["curated:test:pub", "curated"],
    ]);
    expect(places[0].address).toBe("1 Test St, Test");
  });

  it("lets the Atlas record win over the curated entry for the same place", () => {
    const atlas = candidate("a1", "Pub", [-123.1088, 49.2785], "observed", {
      name: "The Synthetic Pub",
    });
    const places = nearbyWithCurated([atlas], curated, ARENA);
    expect(places.map((p) => [p.atlasId, p.source])).toEqual([["a1", "atlas"]]);
  });
});

describe("game-day hours, quoted from what Atlas tagged", () => {
  const all = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  it("cuts a list of days to the one that is game day", () => {
    const listed = {
      text: "Hours: Monday: 11am - 11pm · Tuesday: 11am - 11pm · Sunday: 9:30am - 11pm",
      scope: "subject",
      weekdays: all,
    };
    expect(statedHoursOn([listed], "sunday")).toBe("Sunday: 9:30am - 11pm");
    expect(
      statedHoursOn(
        [
          {
            text: "Hours of Operation: SUN 7:00am — 12:00am, MON 7:00am — 12:00am, THURS 7:00am — 12:00am",
            scope: "subject",
            weekdays: all,
          },
        ],
        "thursday",
      ),
    ).toBe("THURS 7:00am — 12:00am");
  });

  it("says closed when that is what was published", () => {
    expect(
      statedHoursOn(
        [
          {
            text: "Hours: Monday: 3 PM to 10 PM; Tuesday: Closed; Wednesday: 3 PM to 10 PM",
            scope: "subject",
            weekdays: ["monday", "wednesday"],
          },
        ],
        "tuesday",
      ),
    ).toBeUndefined();
    expect(
      statedHoursOn(
        [
          {
            text: "Hours: Monday: 3 PM to 10 PM; Tuesday: Closed",
            scope: "subject",
            weekdays: all,
          },
        ],
        "tuesday",
      ),
    ).toBe("Tuesday: Closed");
  });

  it("quotes a range whole rather than reading it", () => {
    expect(
      statedHoursOn(
        [
          {
            text: "Operating Hours: Saturday & Sunday, 9AM-8PM",
            scope: "subject",
            weekdays: ["saturday", "sunday"],
          },
        ],
        "sunday",
      ),
    ).toBe("Saturday & Sunday, 9AM-8PM");
  });

  it("ignores brunch, karaoke and days Atlas did not tag", () => {
    expect(
      statedHoursOn(
        [
          {
            text: "Brunch Hours: SUN 7:00am — 2:00pm",
            scope: "part",
            of: "Brunch",
            weekdays: all,
          },
          {
            text: "Karaoke schedule: Sunday to Thursday - 9:30pm to 2am",
            scope: "part",
            of: "Karaoke",
            weekdays: all,
          },
          {
            text: "Opening hours: Tuesday - Sunday 4pm - Late",
            scope: "subject",
            weekdays: ["tuesday", "sunday"],
          },
        ],
        "monday",
      ),
    ).toBeUndefined();
  });
});

describe("what a venue card may show", () => {
  const near = (extra: Partial<DiscoveryCandidate>) =>
    nearbyFood(
      [candidate("x", "restaurant", [-123.1065, 49.2785], "observed", extra)],
      ARENA,
      { weekday: "sunday" },
    )[0];

  it("shows the place's own picture plainly", () => {
    expect(near({ heroUrl: "https://example.test/own.jpg" }).image).toEqual({
      url: "https://example.test/own.jpg",
      relationship: "exact",
    });
  });

  it("labels a picture from the business's own site", () => {
    const place = near({
      presentationImage: {
        url: "https://example.test/org.jpg",
        relationship: "organization",
        depictsEntity: false,
        confidence: "medium",
        source: { host: "example.test", evidence: "unverified" },
        attribution: "Image published on its own page; not verified.",
      },
    });
    expect(place.image?.label).toBe("From example.test");
  });

  it("never offers a stock photo of the kind of thing as this place", () => {
    const place = near({
      presentationImage: {
        url: "https://example.test/stock.jpg",
        relationship: "category",
        depictsEntity: false,
        confidence: "low",
        attribution: "Illustrative restaurant photo. Not a photo of it.",
      },
    });
    expect(place.image).toBeUndefined();
  });

  it("carries Atlas's game-day verdict and at most two useful facts", () => {
    const place = near({
      schedule: {
        stated: "stated",
        onDate: { date: "2026-10-25", reading: "not-on", basis: "hours" },
      },
      knowledge: {
        practical: [
          { label: "Happy Hour", value: "Available" },
          { label: "Trivia Night", value: "7.00PM EVERY WEDNESDAY" },
          { label: "Patio", value: "Heated" },
          { label: "Coordinates", value: "latitude: 49" },
        ],
      },
    } as Partial<DiscoveryCandidate>);
    expect(place.gameDay).toEqual({ reading: "not-on" });
    expect(place.facts).toEqual([
      "Happy Hour",
      "Trivia Night: 7.00PM EVERY WEDNESDAY",
    ]);
  });

  it("drops Atlas's own sentence when Atlas says it adds nothing", () => {
    const place = near({
      description: "A restaurant. It serves food.",
      knowledge: { descriptionAddsKnowledge: false },
    } as Partial<DiscoveryCandidate>);
    expect(place.blurb).toBeUndefined();
  });
});

/**
 * Every address here is one production Atlas held on 2026-10-20 for a place
 * within 1.6 km of Rogers Arena (`docs/product/hockey/PRESENTATION-POLISH.md`).
 */
describe("which pictures reach a card", () => {
  it("asks for an http photograph over https, so an https page can show it", () => {
    expect(
      secureUrl("http://www.chambar.com/media/2023%20Fall_Homepage%204.png"),
    ).toBe("https://www.chambar.com/media/2023%20Fall_Homepage%204.png");
    expect(secureUrl("https://moxies.ca/a.jpg")).toBe(
      "https://moxies.ca/a.jpg",
    );
  });

  it("does not take a logo, a menu mock-up or an arrow for a photograph", () => {
    for (const url of [
      "https://www.patrontc.com/images/ArrowUp.png",
      "https://images.squarespace-cdn.com/content/v1/5ca3/1554-NJMVNHJR/VenturaLogo.png?format=1500w",
      "https://bostonpizza.com/content/dam/bostonpizza/Pizza-MenuMock-1.png",
      "https://example.com/assets/site-icon.png",
    ]) {
      expect(looksLikeNotAPhoto(url), url).toBe(true);
    }
    for (const url of [
      "https://www.sharkclub.com/wp-content/uploads/2018/08/Van1-1.jpg",
      "https://www.fannybayoysters.com/uploads/images/20181015-fannybay-6035-leilakwok.jpg",
      "https://example.com/iconic-dining-room.jpg",
    ]) {
      expect(looksLikeNotAPhoto(url), url).toBe(false);
    }
  });

  it("offers the https address, and nothing at all for a logo", () => {
    const photo = nearbyFood(
      [
        candidate("chambar", "Restaurant", [-123.1065, 49.2785], "observed", {
          heroUrl: "http://www.chambar.com/media/2023%20Fall_Homepage%204.png",
        } as Partial<DiscoveryCandidate>),
        candidate("ventura", "Restaurant", [-123.1066, 49.2785], "observed", {
          heroUrl: "https://example.com/VenturaLogo.png",
        } as Partial<DiscoveryCandidate>),
      ],
      ARENA,
    );
    expect(photo.find((p) => p.atlasId === "chambar")?.image?.url).toBe(
      "https://www.chambar.com/media/2023%20Fall_Homepage%204.png",
    );
    expect(photo.find((p) => p.atlasId === "ventura")?.image).toBeUndefined();
  });

  it("keeps a decoded image only if it is big and wide enough to be a photograph", () => {
    expect(photoUsable(1366, 768)).toBe(true); // Chambar
    expect(photoUsable(480, 483)).toBe(true); // Hoxton
    expect(photoUsable(56, 56)).toBe(false); // Patrón's arrow
    expect(photoUsable(300, 100)).toBe(false); // Shawarma Time's banner
    expect(photoUsable(67, 139)).toBe(false); // Boston Pizza's menu strip
    expect(photoUsable(1024, 1519)).toBe(false); // Meat & Bread's tall logo
  });

  it("leads with places that have a photograph, JPEGs first, nearest within each", () => {
    const places = nearbyWithCurated(
      [
        candidate("bare-near", "Restaurant", [-123.1088, 49.2779]),
        candidate("png", "Restaurant", [-123.1086, 49.2779], "observed", {
          heroUrl: "https://example.com/room.png",
        } as Partial<DiscoveryCandidate>),
        candidate("jpg-far", "Restaurant", [-123.115, 49.28], "observed", {
          heroUrl: "https://example.com/room.jpg",
        } as Partial<DiscoveryCandidate>),
        candidate("jpg-near", "Restaurant", [-123.1075, 49.2785], "observed", {
          heroUrl: "https://example.com/wix/a.jpg/v1/fit/w_480",
        } as Partial<DiscoveryCandidate>),
      ],
      [],
      ARENA,
    );
    expect(places.map((p) => p.atlasId)).toEqual([
      "jpg-near",
      "jpg-far",
      "png",
      "bare-near",
    ]);
  });
});
