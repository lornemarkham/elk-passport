import { OCTOBER_PLACES, type OctoberPlace } from "@/domain/environment/places";

/**
 * **Where a person can say they are setting out from, and which area that is
 * in.**
 *
 * ## Why this exists rather than reusing October's list alone
 *
 * `OCTOBER_PLACES` is twenty-two Okanagan town centres, built to answer *will
 * the sky be clear on Thursday* for one valley. Discovery is being launched in
 * two regions, and measured on production the consequence was stark: a reader
 * in Vancouver could not tell Passport where they were at all — every town in
 * the picker was four hours' drive away — and the page then suppressed the
 * thirty-four Metro Vancouver subjects as "elsewhere" and told them they were
 * looking at **2,189 ideas in Okanagan**.
 *
 * So the list is Discovery's own, October's entries are carried through
 * unchanged by id, and each entry says which **Atlas area** it sits in. That
 * last field is the whole point: it is what lets the page be about where the
 * reader is rather than about where most of the corpus happens to be.
 *
 * ## The coordinates
 *
 * October's are verified against Wikidata (P625). The Metro Vancouver entries
 * are municipal centres at four decimal places — a town centre, good to a few
 * hundred metres, which is the honest precision for *"measure from roughly
 * here"* and the same standard the existing entries hold themselves to. Where
 * Atlas has placed subjects in these localities its own coordinates agree:
 * BC Place at `-123.1104, 49.2762` and the Commodore at `-123.1209, 49.2806`
 * both sit inside downtown Vancouver as given below.
 *
 * Nothing here is geocoded at request time, and an unrecognised id produces no
 * origin rather than a plausible wrong one.
 */
export interface DiscoveryTown extends OctoberPlace {
  /**
   * The area Atlas names for this town — `Okanagan`, `Metro Vancouver`.
   *
   * Must match `candidate-geography/2`'s `area.name` exactly, because that is
   * what it is compared against. Passport never decides area membership for a
   * subject; this says only which area the **reader** is standing in.
   */
  readonly area: string;
}

const OKANAGAN: readonly DiscoveryTown[] = OCTOBER_PLACES.map((place) => ({
  ...place,
  area: "Okanagan",
}));

/**
 * Metro Vancouver's municipalities, as a person would name them.
 *
 * Ordered by how likely somebody is to be standing in one. Burnaby, Surrey,
 * Coquitlam and the rest are here even though Atlas currently holds **no**
 * subjects placed in them — a reader must be able to say where they are
 * before the corpus can be criticised for being thin there, and the page says
 * plainly how little it knows rather than offering a shorter list that hides
 * the gap.
 */
const METRO_VANCOUVER: readonly DiscoveryTown[] = [
  {
    id: "vancouver",
    name: "Vancouver, BC",
    latitude: 49.2827,
    longitude: -123.1207,
    area: "Metro Vancouver",
  },
  {
    id: "north-vancouver",
    name: "North Vancouver, BC",
    latitude: 49.3163,
    longitude: -123.0693,
    area: "Metro Vancouver",
  },
  {
    id: "west-vancouver",
    name: "West Vancouver, BC",
    latitude: 49.3286,
    longitude: -123.1601,
    area: "Metro Vancouver",
  },
  {
    id: "burnaby",
    name: "Burnaby, BC",
    latitude: 49.2488,
    longitude: -122.9805,
    area: "Metro Vancouver",
  },
  {
    id: "richmond",
    name: "Richmond, BC",
    latitude: 49.1666,
    longitude: -123.1336,
    area: "Metro Vancouver",
  },
  {
    id: "surrey",
    name: "Surrey, BC",
    latitude: 49.1913,
    longitude: -122.849,
    area: "Metro Vancouver",
  },
  {
    id: "coquitlam",
    name: "Coquitlam, BC",
    latitude: 49.2838,
    longitude: -122.7932,
    area: "Metro Vancouver",
  },
  {
    id: "new-westminster",
    name: "New Westminster, BC",
    latitude: 49.2057,
    longitude: -122.911,
    area: "Metro Vancouver",
  },
  {
    id: "delta",
    name: "Delta, BC",
    latitude: 49.0847,
    longitude: -123.0586,
    area: "Metro Vancouver",
  },
  {
    id: "langley",
    name: "Langley, BC",
    latitude: 49.1044,
    longitude: -122.6603,
    area: "Metro Vancouver",
  },
];

/** Every town, grouped so a picker can show the two regions apart. */
export const TOWN_GROUPS: readonly {
  readonly area: string;
  readonly towns: readonly DiscoveryTown[];
}[] = [
  { area: "Okanagan", towns: OKANAGAN },
  { area: "Metro Vancouver", towns: METRO_VANCOUVER },
];

export const DISCOVERY_TOWNS: readonly DiscoveryTown[] = [
  ...OKANAGAN,
  ...METRO_VANCOUVER,
];

const BY_ID = new Map(DISCOVERY_TOWNS.map((t) => [t.id, t] as const));

/** A town by id, or `undefined`. An unknown id is never guessed at. */
export const townById = (id: string | undefined): DiscoveryTown | undefined =>
  id ? BY_ID.get(id) : undefined;

/**
 * **Which area the page should be about.**
 *
 * The reader's own, whenever they have said where they are. Only when they
 * have not does it fall back to whatever the corpus is mostly about — which
 * is a fact about Atlas, not about them, and was being used as though it were
 * both.
 */
export const homeArea = (
  townId: string | undefined,
  corpusArea: string | undefined,
): string | undefined => townById(townId)?.area ?? corpusArea;
