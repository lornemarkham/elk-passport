import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SubjectComposition } from "@/lib/data/types";
import { subjectPageView } from "@/lib/passport/subjectPage";
import { favouriteBySlug } from "@/domain/featured/locals";
import { placeOfFact } from "./classify";
import { placeDetailsFromComposed } from "./fromComposed";
import { withFavourite } from "./withFavourite";
import {
  addToDayHref,
  callHref,
  directionsHref,
  phoneDisplay,
  summarise,
} from "./model";

/**
 * The shared place page's model (owner brief M1041), on the three acceptance
 * examples: Long John's and Alexander's as production Atlas held them on
 * 2026-11-23 plus their local-favourite facts, and The Roster from a
 * text-heavy fixture (`e2e/fixtures/place-details/README.md`).
 */
const fixture = (name: string): SubjectComposition =>
  JSON.parse(
    readFileSync(`e2e/fixtures/place-details/${name}.json`, "utf8"),
  ) as SubjectComposition;

const roster = placeDetailsFromComposed(subjectPageView(fixture("roster")));

describe("a text-heavy Atlas record becomes visitor sections", () => {
  it("sorts the publisher's facts under the headings a visitor looks for", () => {
    const ids = roster.sections.map((s) => s.id);
    expect(ids).toEqual(["food-drink", "activities", "amenities"]);
    // "Big screens for every game" is already in the description, so it is
    // counted as withheld rather than said twice.
    expect(roster.withheld).toBe(1);
    const food = roster.sections.find((s) => s.id === "food-drink")!;
    expect(food.lines.map((l) => l.text)).toContain("Local craft beer on tap");
    const things = roster.sections.find((s) => s.id === "activities")!;
    expect(things.lines.map((l) => l.text)).toEqual(
      expect.arrayContaining(["Uneekor simulators", "Monthly comedy nights"]),
    );
  });

  it("never leads with raw website text: passages are opening sentences, kept in full under sources", () => {
    const passages = roster.sections.flatMap((s) => s.passages);
    expect(passages.length).toBeGreaterThan(0);
    for (const p of passages) expect(p.length).toBeLessThanOrEqual(260);
    expect(roster.readFromSources.map((r) => r.label)).toEqual(
      expect.arrayContaining(["Menu", "Squash and racquetball"]),
    );
    expect(roster.description!.length).toBeLessThanOrEqual(420);
    expect(roster.readFromSources[0]!.label).toBe("Description");
  });

  it("pulls phone and website out to Contact, and keeps them off the sections", () => {
    expect(roster.phone).toBe("+1 250-549-0444");
    expect(roster.website).toBe("https://rostersvernon.com/");
    const all = roster.sections.flatMap((s) => s.lines.map((l) => l.text));
    expect(all.join(" ")).not.toMatch(/549-0444|rostersvernon/);
  });

  it("offers the four actions from what Atlas stated", () => {
    expect(addToDayHref(roster.id)).toBe("/go?with=e2e-roster-sports-club");
    expect(directionsHref(roster)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=50.2794,-119.2766",
    );
    expect(callHref(roster.phone)).toBe("tel:+12505490444");
    expect(roster.kindLabel).toBe("Sports bar");
    expect(roster.sources[0]).toMatchObject({
      site: "rostersvernon.com",
      checked: "2026-11-23",
      label: "The business's own website",
    });
  });
});

describe("a local favourite is the same page with an editor's note", () => {
  const lj = withFavourite(
    placeDetailsFromComposed(subjectPageView(fixture("long-johns"))),
    favouriteBySlug("long-johns-pub")!,
  );
  const alex = withFavourite(
    placeDetailsFromComposed(subjectPageView(fixture("alexanders"))),
    favouriteBySlug("alexanders-beach-pub")!,
  );

  it("keeps Long John's photographs, credited, and fills what Atlas lacks", () => {
    expect(lj.name).toBe("Long John's Pub");
    expect(lj.badge).toBe("Local favourite · our pick");
    expect(lj.photos).toHaveLength(3);
    expect(lj.photos[0]!.credit).toBe("Photo: Long John's Pub");
    expect(lj.point).toEqual({ latitude: 50.35934, longitude: -119.059306 });
    expect(callHref(lj.phone)).toBe("tel:+12505492992");
    expect(lj.website).toBe("https://www.longjohnspub.com/");
    // Atlas's own line is kept, under the heading it belongs to.
    expect(lj.sections.find((s) => s.id === "food-drink")?.lines[0]?.text).toBe(
      "A pub at Silver Star offering a great happy hour menu.",
    );
  });

  it("says hours are not confirmed, and quotes what the pub published", () => {
    expect(lj.hours).toMatchObject({
      confirmed: false,
      lines: ["Winter hours: open 7 days, 11 am – 10 pm"],
    });
    expect(lj.hours!.note).toMatch(/aren't confirmed/);
    expect(alex.hours).toMatchObject({ confirmed: false, lines: [] });
  });

  it("borrows no photo for Alexander's and offers no unverified website", () => {
    expect(alex.photos).toHaveLength(0);
    expect(alex.website).toBeUndefined();
    expect(alex.locality).toBe("Kal Beach, Kalamalka Lake, Vernon");
  });

  it("lists every sourced fact, then Atlas's own sources", () => {
    expect(lj.sources.map((s) => s.label)).toEqual(
      expect.arrayContaining(["In their words", "Address", "Phone"]),
    );
    expect(lj.sources.some((s) => s.site === "tourismvernon.com")).toBe(true);
  });

  it("still makes a page when Atlas cannot be read", () => {
    const offline = withFavourite(
      undefined,
      favouriteBySlug("long-johns-pub")!,
    );
    expect(offline.id).toBe("a0c4c529-8cf6-4431-afdd-c559f0a63195");
    expect(offline.photos).toHaveLength(3);
    expect(offline.pairsWith.length).toBeGreaterThan(0);
  });

  it("never says partner, sponsored or official", () => {
    for (const m of [lj, alex])
      expect(JSON.stringify({ ...m, sources: [] })).not.toMatch(
        /partner|sponsored|official/i,
      );
  });
});

describe("helpers", () => {
  it("sorts facts by their words, and leaves unknown ones under More about it", () => {
    expect(placeOfFact({ label: "Patio", value: "Yes" })).toBe("amenities");
    expect(placeOfFact({ label: "Hours", value: "11–10" })).toBe("hours");
    expect(placeOfFact({ label: "Founded", value: "1987" })).toBe("about");
    expect(placeOfFact({ value: "Open daily" })).toBe("about");
  });

  it("quotes the opening of a passage, never rewrites it", () => {
    const long = `${"First sentence here. ".repeat(20)}`;
    expect(summarise(long, 62)).toBe(
      "First sentence here. First sentence here. First sentence here.",
    );
    expect(summarise("one two three four five six", 12)).toBe("one two…");
    expect(summarise("short")).toBe("short");
  });

  it("formats phones a person can read", () => {
    expect(phoneDisplay("+12505492992")).toBe("(250) 549-2992");
    expect(phoneDisplay("+1 250-549-0444")).toBe("(250) 549-0444");
    expect(callHref("12")).toBeUndefined();
  });
});
