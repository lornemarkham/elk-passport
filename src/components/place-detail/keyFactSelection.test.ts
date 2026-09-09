import { describe, expect, it } from "vitest";
import type { Place, PlaceKeyFact, PlaceOperator } from "@/lib/data/types";
import { groupKeyFacts } from "./keyFactSelection";

/**
 * **Passport chooses which facts appear, and changes none of them.**
 *
 * Atlas holds keyFacts on 1,202 entities and this page rendered none, because
 * the field was absent from the read type. Now that it is here, the rule that
 * matters is that a publisher's sentence reaches the reader intact.
 */
const place = (over: Partial<Place> = {}): Place => ({
  kind: "Place",
  id: "p1",
  name: "Somewhere",
  aliases: [],
  placeType: "park",
  description: "A park.",
  ...over,
});

const fact = (
  label: string,
  value: string,
  category?: string,
): PlaceKeyFact => ({
  label,
  value,
  category,
});

describe("choosing which key facts to show", () => {
  it("keeps the publisher's words exactly", () => {
    const stated =
      "Ranges from cyan to indigo, earning it the moniker 'lake of a thousand colours'.";
    const [group] = groupKeyFacts(
      place({ keyFacts: [fact("Color Variations", stated)] }),
    );

    expect(group.facts[0].value).toBe(stated);
    expect(group.facts[0].label).toBe("Color Variations");
  });

  it("groups by Atlas's own category, and leaves the rest ungrouped", () => {
    const groups = groupKeyFacts(
      place({
        keyFacts: [
          fact("Location", "South of Vernon."),
          fact("Kinloch", "A launch spot.", "Locals' favourite launch spots"),
          fact("WestKal", "Another one.", "Locals' favourite launch spots"),
        ],
      }),
    );

    // Ungrouped first and unlabelled — a heading like "Other" would be a
    // category Passport invented.
    expect(groups[0].category).toBeUndefined();
    expect(groups[0].facts).toHaveLength(1);
    expect(groups[1].category).toBe("Locals' favourite launch spots");
    expect(groups[1].facts).toHaveLength(2);
  });

  it("drops a fact the page already renders from its own field", () => {
    const groups = groupKeyFacts(
      place({ hours: "9–5", keyFacts: [fact("Hours", "9am to 5pm daily")] }),
    );
    expect(groups).toHaveLength(0);
  });

  it("keeps that same fact when the page has no such field to render", () => {
    // Suppression is "already shown", never "looked unimportant".
    const groups = groupKeyFacts(
      place({ keyFacts: [fact("Hours", "9am to 5pm daily")] }),
    );
    expect(groups[0].facts[0].value).toBe("9am to 5pm daily");
  });

  it("ignores a fact with nothing in it", () => {
    expect(
      groupKeyFacts(place({ keyFacts: [fact("  ", ""), fact("Phone", " ")] })),
    ).toHaveLength(0);
  });

  it("shows nothing at all when Atlas holds nothing", () => {
    expect(groupKeyFacts(place())).toHaveLength(0);
    expect(groupKeyFacts(place({ keyFacts: [] }))).toHaveLength(0);
  });
});

describe("composing across a proven operates edge", () => {
  const operator = (over: Partial<PlaceOperator> = {}): PlaceOperator => ({
    id: "org-1",
    name: "Big White Ski Resort",
    organizationType: "resort",
    keyFacts: [],
    offers: [],
    ...over,
  });

  it("shows the operator's facts under the operator's name", () => {
    const groups = groupKeyFacts(place(), [
      operator({ keyFacts: [fact("Smoking Policy", "No smoking anywhere.")] }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].operator?.name).toBe("Big White Ski Resort");
    expect(groups[0].facts[0].value).toBe("No smoking anywhere.");
  });

  it("puts the Place's own facts first, unattributed", () => {
    const groups = groupKeyFacts(
      place({ keyFacts: [fact("Elevation", "2319m")] }),
      [operator({ keyFacts: [fact("Telephone", "250-491-6111")] })],
    );

    expect(groups[0].operator).toBeUndefined();
    expect(groups[0].facts[0].label).toBe("Elevation");
    expect(groups[1].operator?.id).toBe("org-1");
  });

  it("does not repeat a fact the Place already states", () => {
    const groups = groupKeyFacts(
      place({ keyFacts: [fact("Elevation", "2319m")] }),
      [operator({ keyFacts: [fact("Elevation", " 2319M ")] })],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].operator).toBeUndefined();
  });

  it("does not repeat a fact the operator states twice", () => {
    // Big White's own record carries "Telephone" five times.
    const groups = groupKeyFacts(place(), [
      operator({
        keyFacts: [
          fact("Telephone", "250-491-6111"),
          fact("Telephone", "250-491-6111"),
        ],
      }),
    ]);

    expect(groups[0].facts).toHaveLength(1);
  });

  it("composes nothing when there is no operator", () => {
    // A same-named Organization with no `operates` edge never reaches here —
    // Atlas does not put it in `operatedBy`, and this is the other half of
    // that: given none, compose none.
    expect(groupKeyFacts(place(), [])).toHaveLength(0);
  });
});
