import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import type { CandidateKnowledge } from "@/lib/data/types";
import { MAX_INVITATIONS, invitationSection, invitations } from "./directions";

/**
 * **"What could you do?" has been the page's headline since Discovery was
 * composed, and the page answered it with nouns.**
 *
 * *Kalamoir Park*, *Stuart Park Ice Rink*, *Otter Lake Park* — records that
 * satisfy a query. Somebody who does not already know what they want cannot
 * tell from a list of them that **skating** and **finding a playground** are
 * two different afternoons.
 *
 * Measured on the production corpus on 2026-10-10: 224 of 2,683 candidates
 * carry 682 affordances, and the verbs underneath them cluster into genuinely
 * distinct days — `hiking 64 · swimming 33 · fishing 29 · cycling 20`.
 *
 * Every fixture below is a real candidate with its real affordances.
 */

const offering = (title: string, ...names: string[]): Experience =>
  ({
    id: title,
    kind: "Place",
    slug: title,
    title,
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
    ...(names.length
      ? {
          knowledge: {
            affordances: names.map((name) => ({ name, basis: "offers" })),
          } as CandidateKnowledge,
        }
      : {}),
  }) as Experience;

/** The Okanagan pool, as Atlas states it. */
const POOL = [
  offering("Otter Lake Park", "Hiking", "Swimming", "Fishing", "Cycling"),
  offering(
    "Okanagan Mountain Provincial Park",
    "Hiking",
    "Swimming",
    "Fishing",
    "Cycling",
  ),
  offering("Kalamoir Park", "Hiking"),
  offering("Kekuli Bay Provincial Park", "Fishing", "Swimming"),
  offering("Vaseux Lake Park", "Swimming"),
  offering("Okanagan Rail Trail", "Cycling", "snowshoeing"),
  offering("Pincushion", "Hiking"),
  offering("Knox Mountain Park", "Hiking", "mountain biking"),
  offering("Polson Park", "Playground"),
  offering("A place Atlas knows nothing about"),
];

describe("the verbs a page can offer", () => {
  it("answers in things you could do, best-evidenced first", () => {
    expect(invitations(POOL).map((i) => i.doing)).toEqual([
      // hiking 5 · swimming 4, then cycling and fishing tied at 3 and
      // separated alphabetically so the tiles do not reshuffle.
      "Hiking",
      "Swimming",
      "Cycling",
      "Fishing",
    ]);
  });

  it("carries every place that stated it, as evidence rather than a ranking", () => {
    const [hiking] = invitations(POOL);
    expect(hiking!.places.map((p) => p.title)).toEqual([
      "Otter Lake Park",
      "Okanagan Mountain Provincial Park",
      "Kalamoir Park",
      "Pincushion",
      "Knox Mountain Park",
    ]);
  });

  it("offers a few, because past the cut the corpus repeats itself", () => {
    // `walking/hiking` under `hiking`, `biking` beside `cycling`. A page that
    // offered both would read as broken rather than as generous.
    expect(invitations(POOL).length).toBeLessThanOrEqual(MAX_INVITATIONS);
  });

  it("keeps Atlas's own word, unrewritten and ungrouped", () => {
    const said = invitations(
      [
        offering("A trail", "mountain biking"),
        offering("A park", "Playground"),
      ],
      9,
    ).map((i) => i.doing);
    // Not "Mountain Biking", not folded under "Cycling", not translated into
    // "let the kids run around". Every one of those is the taxonomy this is
    // deliberately not.
    expect(said).toContain("mountain biking");
    expect(said).toContain("Playground");
  });

  it("treats one spelling as one verb", () => {
    const said = invitations([
      offering("A park", "Playground"),
      offering("Another park", "playground"),
    ]);
    expect(said).toHaveLength(1);
    expect(said[0]!.places).toHaveLength(2);
  });

  it("invents nothing for a pool Atlas states no verbs about", () => {
    expect(invitations([offering("Somewhere")])).toEqual([]);
    expect(invitations([])).toEqual([]);
  });

  it("is stable where the evidence ties", () => {
    // Measured in Vancouver: cycling 3, fishing 3, hiking 3. Tiles that
    // reshuffle on every render are tiles nobody can tap.
    const tied = [
      offering("One", "Cycling", "Fishing", "Hiking"),
      offering("Two", "Cycling", "Fishing", "Hiking"),
    ];
    expect(invitations(tied).map((i) => i.doing)).toEqual([
      "Cycling",
      "Fishing",
      "Hiking",
    ]);
  });
});

describe("the two places a tile names", () => {
  it("prefers a place no other tile has already named", () => {
    // Dogfooded in Vernon: three tiles in a row read "Otter Lake Park ·
    // Okanagan Mountain Provincial Park", because one large provincial park
    // genuinely offers all of it. True, and four distinct afternoons all
    // looked like the same two places.
    const [hiking, swimming] = invitations(POOL);
    expect(hiking!.examples.map((p) => p.title)).toEqual([
      "Otter Lake Park",
      "Okanagan Mountain Provincial Park",
    ]);
    // Both of those also offer swimming. Kekuli Bay and Vaseux Lake do too,
    // and have not been named yet, so they are what this tile says.
    expect(swimming!.examples.map((p) => p.title)).toEqual([
      "Kekuli Bay Provincial Park",
      "Vaseux Lake Park",
    ]);
  });

  it("falls back to a name already used rather than showing none", () => {
    // Everything that offers fishing here has already been named by an
    // earlier tile. Repeating is the lesser failure, and on the real corpus —
    // 63 hiking, 33 swimming, 29 fishing — it rarely happens at all.
    const fishing = invitations(POOL).find((i) => i.doing === "Fishing")!;
    expect(fishing.examples).toHaveLength(2);
  });

  it("only ever names a place that stated the verb", () => {
    for (const invitation of invitations(POOL)) {
      for (const example of invitation.examples) {
        expect(invitation.places).toContain(example);
      }
    }
  });

  it("repeats rather than going silent where there is nothing else", () => {
    // Vancouver has six affordance-bearing candidates in total. A tile with
    // one example beats a tile with none.
    const thin = [offering("Stanley Park", "Cycling", "Fishing")];
    for (const invitation of invitations(thin)) {
      expect(invitation.examples.length).toBeGreaterThan(0);
    }
  });

  it("never names the same place twice on one tile", () => {
    // A verb backed by a single place had that place in both the fresh list
    // and the fallback, and read "Stanley Park · Stanley Park".
    const [only] = invitations([offering("Stanley Park", "Cycling")]);
    expect(only!.examples).toHaveLength(1);
  });
});

describe("where an invitation leads", () => {
  const hiking = invitations(POOL)[0]!;

  it("to exactly the places whose evidence produced it", () => {
    const section = invitationSection(hiking, false);
    expect(section.title).toBe("Hiking");
    expect(section.total).toBe(5);
    expect(section.items).toEqual(hiking.places);
  });

  it("says near you only where the pool genuinely is", () => {
    expect(invitationSection(hiking, true).note).toContain(
      "within reach of where you are",
    );
    expect(invitationSection(hiking, false).note).not.toContain("near");
  });

  it("names Atlas as the one making the claim", () => {
    expect(invitationSection(hiking, true).note).toContain("Atlas states it");
  });

  it("promises nothing Atlas did not say", () => {
    const note = invitationSection(hiking, true).note;
    // No hours, no duration, no price, no age guidance, no weather. Atlas
    // states opening hours for 6% of the corpus and duration for 1%, and an
    // invitation that implied otherwise would be inventing the useful part.
    for (const invented of [
      "open",
      "hour",
      "minute",
      "free",
      "$",
      "kid",
      "sunny",
      "perfect",
    ]) {
      expect(note.toLowerCase()).not.toContain(invented);
    }
  });

  it("gives a stable, url-safe id even for an awkward verb", () => {
    const awkward = invitations([
      offering("A park", "Volleyball – beach courts"),
    ])[0]!;
    expect(invitationSection(awkward, false).id).toBe(
      "doing-volleyball-beach-courts",
    );
  });
});
