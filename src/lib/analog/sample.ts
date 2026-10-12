import type { DiscoveryCandidate } from "@/lib/data/types";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { readBrief } from "@/domain/day/brief";
import { buildDay } from "@/domain/day/build";
import { printableFromDay, type PrintableAdventure } from "./printable";

/**
 * **A sample adventure, made the same way a real one is.**
 *
 * The places are real places around Vernon. The rest is deliberately thin,
 * because this file is not Atlas and should not pretend to be:
 *
 * - **No coordinates.** A position typed in from memory would print as a
 *   measured distance. So the sample shows what the page does when a
 *   distance is unknown, which is the common case anyway.
 * - **No hours and no prices.** Not one is published here, so the page shows
 *   its *check first* path for every stop. Prices and hours that really are
 *   published are covered by the tests, with fixtures that say they are
 *   fixtures.
 * - **Verbs and features are ordinary, uncontroversial descriptions** of each
 *   place: a lake park you can swim at, a town park with a playground. The
 *   one rule, pets on leash in a BC provincial park, is BC Parks' own
 *   standing rule.
 *
 * It goes through `readBrief` and `buildDay`, the same reader and builder
 * `/go` uses. So the sample cannot drift from what the product actually
 * produces. Only the pool is different.
 */

const SAID =
  "Five hours near Vernon with my 7-year-old, about $80, outside if we can";

const place = (
  id: string,
  name: string,
  locality: string,
  subtype: string,
  description: string,
  knowledge: DiscoveryCandidate["knowledge"],
): DiscoveryCandidate => ({
  id: `sample-${id}`,
  kind: "Place",
  name,
  subtype,
  description,
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  geography: {
    state: "observed",
    locality,
    area: { id: "okanagan", name: "Okanagan" },
  },
  knowledge,
});

const verbs = (...names: string[]) =>
  names.map((name) => ({ name, basis: "stated-activity" }));

export const SAMPLE_POOL: readonly DiscoveryCandidate[] = [
  place(
    "polson-park",
    "Polson Park",
    "Vernon",
    "park",
    "A big town park in the middle of Vernon, with a creek running through it.",
    {
      affordances: verbs("walking", "picnic", "playground"),
      features: ["Playground", "Picnic areas"],
    },
  ),
  place(
    "kalamalka-lake-park",
    "Kalamalka Lake Provincial Park",
    "Coldstream",
    "provincial park",
    "Grassland trails above Kalamalka Lake, with beaches on the bays below.",
    {
      affordances: verbs("hiking", "swimming", "beach"),
      conditions: ["Pets on leash"],
    },
  ),
  place(
    "allan-brooks",
    "Allan Brooks Nature Centre",
    "Vernon",
    "nature centre",
    "A nature centre on the grasslands above Vernon, about the plants and animals of the North Okanagan.",
    { affordances: verbs("nature trails", "exhibits") },
  ),
  place(
    "davison-orchards",
    "Davison Orchards",
    "Vernon",
    "farm",
    "A family farm and orchard on the hill above Vernon, with a farm market.",
    { affordances: verbs("farm market", "orchard") },
  ),
];

/** The sample, as a printable adventure. Deterministic, no network. */
export function sampleAdventure(): PrintableAdventure {
  const pool = SAMPLE_POOL.map(candidateToExperience);
  const day = buildDay({ pool, brief: readBrief(SAID) });
  return printableFromDay(day, { sample: true });
}
