import { describe, expect, it } from "vitest";
import { partitionFacts, restates } from "./factVisibility";
import {
  OCTOBER_2026,
  curationFor,
  curatedAssets,
  isCurated,
  placedFactLabels,
} from "@/lib/passport/curation/october2026";

/**
 * The cases here are the ones the live corpus produced. After the identity
 * mission merged two records for one coffee festival, its page printed the
 * interval four times and the venue twice — every one of them a true fact
 * Atlas was right to hold.
 */
describe("a fact the page already says better is not printed again", () => {
  const when = "Sat, Oct 3, 2026 – Sun, Oct 4, 2026";
  const where = "The Laurel Packinghouse, 1304 Ellis St, Kelowna";

  it("drops a date fact that restates the rendered interval, in either spelling", () => {
    const { visible, hidden } = partitionFacts(
      [
        { label: "Start Date", value: "2026-10-03" },
        { label: "End Date", value: "2026-10-04" },
        { label: "Event Dates", value: "October 3rd and 4th, 2026" },
        {
          label: "Sessions",
          value: "Six 2-hour sessions: 9:00am-11:00am, 11:30am-1:30pm",
        },
      ],
      { when, where },
    );
    expect(visible.map((f) => f.label)).toEqual(["Sessions"]);
    expect(hidden.map((f) => f.label)).toEqual([
      "Start Date",
      "End Date",
      "Event Dates",
    ]);
    expect(hidden.every((f) => f.rule === "already-rendered")).toBe(true);
  });

  it("drops a location fact the WHERE line already names", () => {
    const { visible } = partitionFacts(
      [
        { label: "Location", value: "The Laurel Packinghouse" },
        { label: "Parking", value: "Street parking on Ellis, free after 6pm" },
      ],
      { where },
    );
    expect(visible.map((f) => f.label)).toEqual(["Parking"]);
  });

  it("drops a fact whose value is a sentence already inside the description", () => {
    const description =
      "Field of Screams 13: The Unlucky returns to Historic O'Keefe Ranch in Vernon on Friday, September 25 and runs through Sunday, November 1, 2026.";
    const { visible, hidden } = partitionFacts(
      [
        {
          label: "Venue",
          value:
            "returns to Historic O'Keefe Ranch in Vernon on Friday, September 25",
        },
        {
          label: "Final night",
          value: "Sunday, November 1 is the final night of the 2026 season.",
        },
      ],
      { description },
    );
    expect(visible.map((f) => f.label)).toEqual(["Final night"]);
    expect(hidden[0]!.rule).toBe("in-description");
  });

  it("drops a label with nothing behind it", () => {
    const { visible, hidden } = partitionFacts(
      [{ label: "Food on site", value: "  " }],
      {},
    );
    expect(visible).toEqual([]);
    expect(hidden[0]!.rule).toBe("empty");
  });

  it("drops the second copy of a fact a merge unioned twice", () => {
    const { visible } = partitionFacts(
      [
        { label: "Artifacts housed", value: "approximately 10,000 artifacts" },
        { label: "Artifacts housed", value: "Approximately 10,000 artifacts" },
      ],
      {},
    );
    expect(visible).toHaveLength(1);
  });

  it("keeps a fact that adds a detail the page does not already carry", () => {
    // A time inside a day, a room inside a building: more than the page said.
    const { visible } = partitionFacts(
      [
        {
          label: "Arrival and opening",
          value: "Parking opens at 6:00 PM. The mazes open at 6:30 PM.",
        },
        { label: "Weather", value: "Operates rain, shine, or snow." },
      ],
      {
        when: "Fri, Sep 25, 2026 – Sun, Nov 1, 2026",
        where: "O'Keefe Ranch Historic Site",
      },
    );
    expect(visible).toHaveLength(2);
  });

  it("never treats a long sentence as a restatement just because it carries a year", () => {
    expect(
      restates(
        "Field of Screams includes dark areas, loud sounds and strobe lights, and is not recommended for children under 12 in 2026.",
        "Fri, Sep 25, 2026 – Sun, Nov 1, 2026",
      ),
    ).toBe(false);
  });

  it("returns every hidden fact with the rule that hid it, so nothing disappears silently", () => {
    const { hidden } = partitionFacts(
      [
        { label: "Season", value: "Sep 25 - Nov 01, 2026" },
        { label: "Edition", value: "Field of Screams 13" },
      ],
      {
        when: "Fri, Sep 25, 2026 – Sun, Nov 1, 2026",
        placed: new Set(["Edition"]),
      },
    );
    expect(hidden.map((f) => f.rule).sort()).toEqual([
      "already-rendered",
      "placed",
    ]);
  });
});

/**
 * Curation is a presentation decision and must stay one. These hold the line
 * between "which of five true statements to print" and "what is true".
 */
describe("the October 2026 curated launch collection", () => {
  const fos = curationFor("exp-field-of-screams-okeefe-ranch");

  it("marks exactly the entities a human listed, and nothing else", () => {
    expect(isCurated("exp-field-of-screams-okeefe-ranch")).toBe(true);
    expect(isCurated("exp-black-mountain-haunted-house")).toBe(false);
    expect(curationFor("some-other-entity")).toBeUndefined();
    expect(fos?.collection).toBe(OCTOBER_2026);
  });

  it("carries the page every curated asset was taken from", () => {
    const assets = curatedAssets(fos!);
    expect(assets.length).toBeGreaterThan(0);
    for (const a of assets) {
      expect(a.provenance).toMatch(/^https:\/\/fosokanagan\.com\//);
      expect(a.caption.trim().length).toBeGreaterThan(0);
    }
  });

  it("builds every card, price and grouped line from an Atlas fact label rather than from prose", () => {
    // The register may say where a fact goes. It may not say what it says.
    for (const card of fos!.cards!.items)
      expect(card.factLabel.trim()).not.toBe("");
    for (const tier of fos!.pricing!.tiers)
      expect(tier.factLabel.trim()).not.toBe("");
    for (const group of fos!.groups!)
      expect(group.factLabels.length).toBeGreaterThan(0);
    expect(fos!.featuredCta!.factLabel).toBe("Tickets");
  });

  it("gives a reason for every fact it suppresses", () => {
    for (const s of fos!.suppressFacts ?? []) {
      expect(s.because.trim().length).toBeGreaterThan(10);
    }
  });

  it("counts a placed fact as placed, so it is not printed twice", () => {
    const placed = placedFactLabels(fos!);
    expect(placed.has("The Village")).toBe(true);
    expect(placed.has("Single Maze Price")).toBe(true);
    expect(placed.has("Parking")).toBe(true);
    expect(placed.has("Season")).toBe(true);
    // A fact nobody placed stays visible — a missing group should be obvious.
    expect(placed.has("Something Atlas Learns Tomorrow")).toBe(false);
  });
});
