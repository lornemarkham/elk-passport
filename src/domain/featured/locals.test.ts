import { describe, expect, it } from "vitest";
import {
  FAVOURITE_LABEL,
  LOCAL_FAVOURITES,
  directionsHref,
  favouriteByAtlasId,
  favouriteBySlug,
  favouritesNear,
  favouritesOnMountain,
  phoneText,
} from "./locals";

const VERNON = { latitude: 50.267, longitude: -119.272 };
const KELOWNA = { latitude: 49.888, longitude: -119.496 };
const VANCOUVER = { latitude: 49.2827, longitude: -123.1207 };

/** Everything a card or page can say about a favourite, in one string. */
const everythingSaid = (f: (typeof LOCAL_FAVOURITES)[number]) =>
  [
    f.name,
    f.place,
    f.line,
    ...f.goodFor,
    f.said.value,
    ...Object.values(f.in),
    ...f.pairsWith.flatMap((p) => [p.label, p.line]),
    f.hours.confirmed ? f.hours.value.value : f.hours.why,
    FAVOURITE_LABEL,
  ].join(" ");

describe("local favourites", () => {
  it("are the two Atlas entities, never a second record", () => {
    expect(LOCAL_FAVOURITES.map((f) => f.slug)).toEqual([
      "long-johns-pub",
      "alexanders-beach-pub",
    ]);
    const ids = LOCAL_FAVOURITES.map((f) => f.atlasId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(favouriteByAtlasId(ids[0]!)?.slug).toBe("long-johns-pub");
    expect(favouriteBySlug("alexanders-beach-pub")?.name).toBe(
      "Alexander's Beach Pub",
    );
  });

  it("never call either pub a partner, official or sponsored, and invent no specials or events", () => {
    for (const f of LOCAL_FAVOURITES) {
      const said = everythingSaid(f);
      expect(said).not.toMatch(
        /partner|official|sponsor|endorse|special|deal|discount|% off|happy hour|live music|trivia|tonight|\$\d/i,
      );
    }
  });

  it("says why it is there, as our pick", () => {
    expect(FAVOURITE_LABEL).toMatch(/our pick/i);
  });

  it("quotes every fact from a page, with the day it was read", () => {
    for (const f of LOCAL_FAVOURITES) {
      const facts = [f.said, f.address, f.at, f.phone, f.website].filter(
        (x) => x !== undefined,
      );
      if (!f.hours.confirmed && f.hours.published)
        facts.push(f.hours.published);
      for (const fact of facts) {
        expect(fact.quote.length).toBeGreaterThan(3);
        expect(fact.source).toMatch(/^https:\/\//);
        expect(fact.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("states no hours as fact unless confirmed, and offers a way to check", () => {
    for (const f of LOCAL_FAVOURITES) {
      if (f.hours.confirmed) continue;
      expect(f.hours.why).toMatch(/call ahead/i);
      expect(f.phone).toBeDefined();
    }
  });

  it("shows a photo only with a credit and a description of what it shows", () => {
    for (const f of LOCAL_FAVOURITES)
      for (const p of f.photos) {
        expect(p.url).toMatch(/^https:\/\//);
        expect(p.alt.length).toBeGreaterThan(10);
        expect(p.credit).toMatch(/^Photo: /);
      }
  });

  it("is nearby only inside the radius, and never to somebody unplaced", () => {
    const near = favouritesNear("christmas", VERNON, 30).map(
      (x) => x.favourite.slug,
    );
    // Kal Beach is ~4 km from Vernon's centre, SilverStar village ~18 km.
    expect(near).toEqual(["alexanders-beach-pub", "long-johns-pub"]);
    expect(
      favouritesNear("christmas", VERNON, 10).map((x) => x.favourite.slug),
    ).toEqual(["alexanders-beach-pub"]);
    expect(favouritesNear("christmas", KELOWNA, 30)).toEqual([]);
    expect(favouritesNear("go-have-a-day", VANCOUVER, 100)).toEqual([]);
    expect(favouritesNear("christmas", undefined, 1000)).toEqual([]);
  });

  it("is recommended only in the experiences it fits", () => {
    expect(
      favouritesOnMountain("silverstar", "snow").map((f) => f.slug),
    ).toEqual(["long-johns-pub"]);
    expect(
      favouritesOnMountain("silverstar", "sesh-wars").map((f) => f.slug),
    ).toEqual(["long-johns-pub"]);
    expect(favouritesOnMountain("big-white", "snow")).toEqual([]);
    expect(favouritesOnMountain(undefined, "snow")).toEqual([]);
    // Alexander's is not a ski-hill stop.
    expect(favouriteBySlug("alexanders-beach-pub")?.in.snow).toBeUndefined();
  });

  it("gives directions to the stated point and a readable phone number", () => {
    const lj = favouriteBySlug("long-johns-pub")!;
    expect(directionsHref(lj)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=50.35934,-119.059306",
    );
    expect(phoneText(lj.phone!.value)).toBe("(250) 549-2992");
    expect(phoneText("+12505453131")).toBe("(250) 545-3131");
  });

  it("links only to routes that exist", () => {
    for (const f of LOCAL_FAVOURITES)
      for (const p of f.pairsWith)
        expect(p.href).toMatch(
          /^\/(snow\/new|snow\/sesh-wars\/m\/silverstar|christmas\/discover\?at=vernon|discovery\?at=vernon|go)$/,
        );
  });
});
