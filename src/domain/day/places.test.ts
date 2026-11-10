import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { groupChosen, placesPhrase, shareAcrossDays } from "./places";

const at = (name: string, lng?: number, lat?: number) =>
  candidateToExperience({
    id: name.toLowerCase().replace(/\W+/g, "-"),
    kind: "Place",
    name,
    description: "A description long enough to be real.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    ...(lng !== undefined && lat !== undefined
      ? {
          geography: {
            state: "observed" as const,
            coordinates: [lng, lat],
            coordinatesBasis: "observed",
          },
        }
      : {}),
  } as DiscoveryCandidate);

const kal = at("Kal Beach", -119.2937, 50.2316); // Vernon
const bna = at("BNA Brewing", -119.27, 50.267); // Vernon
const kelowna = at("Knox Mountain", -119.4837, 49.9); // Kelowna, ~45 km
const penticton = at("Skaha Beach", -119.5937, 49.4766); // ~100 km
const cenotaph = at("Cenotaph", -123.109894, 49.282475); // Vancouver
const nowhere = at("Mystery Hall");

describe("where the chosen places are", () => {
  it("keeps four Vernon places as one group, named for the town", () => {
    const g = groupChosen([kal, bna]);
    expect(g.groups).toHaveLength(1);
    expect(g.groups[0]!.ids).toEqual([kal.id, bna.id]);
    expect(g.groups[0]!.town?.name).toMatch(/^Vernon/);
  });

  it("joins a chain of places each within a day's reach", () => {
    expect(groupChosen([kal, kelowna]).groups).toHaveLength(1);
  });

  it("splits Vernon from Penticton and from Vancouver", () => {
    const g = groupChosen([kal, penticton, cenotaph, bna]);
    expect(g.groups.map((x) => x.ids)).toEqual([
      [kal.id, bna.id],
      [penticton.id],
      [cenotaph.id],
    ]);
    expect(g.groups[2]!.town?.name).toMatch(/Vancouver/);
  });

  it("leads with the group of whatever was chosen first", () => {
    const g = groupChosen([cenotaph, kal]);
    expect(g.groups[0]!.ids).toEqual([cenotaph.id]);
  });

  it("never guesses a position for a place Atlas does not place", () => {
    const g = groupChosen([kal, nowhere]);
    expect(g.unplaced).toEqual([nowhere.id]);
    expect(g.groups[0]!.ids).toEqual([kal.id]);
  });

  it("says the places in plain words", () => {
    expect(placesPhrase(groupChosen([bna, penticton]).groups)).toBe(
      "Vernon and Penticton",
    );
  });
});

describe("sharing chosen places across a trip", () => {
  const places = groupChosen([kal, bna, cenotaph]);

  it("gives each region its own days, never a mix", () => {
    const { perDay, merged } = shareAcrossDays(places, 2);
    expect(merged).toBe(false);
    expect(perDay.map((d) => d.ids)).toEqual([[kal.id, bna.id], [cenotaph.id]]);
    expect(perDay[0]!.town?.name).toMatch(/^Vernon/);
    expect(perDay[1]!.town?.name).toMatch(/Vancouver/);
  });

  it("gives the region with more places the spare days", () => {
    const { perDay } = shareAcrossDays(places, 3);
    expect(perDay.map((d) => d.ids)).toEqual([
      [kal.id],
      [bna.id],
      [cenotaph.id],
    ]);
  });

  it("folds regions together only when there are fewer days, and says so", () => {
    const { perDay, merged } = shareAcrossDays(places, 1);
    expect(merged).toBe(true);
    expect(perDay).toHaveLength(1);
    expect(perDay[0]!.ids.sort()).toEqual([kal.id, bna.id, cenotaph.id].sort());
  });

  it("keeps an unplaced pick on the biggest region's first day", () => {
    const { perDay } = shareAcrossDays(groupChosen([kal, bna, nowhere]), 1);
    expect(perDay[0]!.ids).toContain(nowhere.id);
  });

  it("with nothing placed, the first day takes what there is", () => {
    const { perDay } = shareAcrossDays(groupChosen([nowhere]), 2);
    expect(perDay.map((d) => d.ids)).toEqual([[nowhere.id], []]);
  });
});
