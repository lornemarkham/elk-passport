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
  /**
   * Other names a person uses for it — "the Parq", "Gastown" — read the same
   * way as the name. Lower case.
   */
  readonly aliases?: readonly string[];
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

/**
 * **Vancouver's neighbourhoods, and the conference hotel** (Vancouver launch,
 * 2026-10-24). A visitor downtown is not "in Vancouver" the way somebody in
 * Lumby is in Lumby: the city centre holds 1,500 of Atlas's subjects inside
 * 2 km, and "coffee near the hotel" means a few blocks, not a municipal
 * centre. Each point is Wikidata's P625 for the item named beside it, checked
 * 2026-10-24, not recalled.
 */
const VANCOUVER_NEIGHBOURHOODS: readonly DiscoveryTown[] = [
  // Q111392022 — 39 Smithe St, beside BC Place; Sycle Summit's venue.
  {
    id: "jw-marriott-parq",
    name: "JW Marriott Parq, Vancouver",
    latitude: 49.2752,
    longitude: -123.1134,
    area: "Metro Vancouver",
    aliases: [
      "jw marriott parq",
      "jw marriott",
      "the parq",
      "parq vancouver",
      "parq",
      "bc place",
      "rogers arena",
    ],
  },
  // Q1076204
  {
    id: "downtown-vancouver",
    name: "Downtown Vancouver",
    latitude: 49.2842,
    longitude: -123.121,
    area: "Metro Vancouver",
    aliases: ["downtown vancouver"],
  },
  // Q1495636
  {
    id: "gastown",
    name: "Gastown, Vancouver",
    latitude: 49.2847,
    longitude: -123.111,
    area: "Metro Vancouver",
    aliases: ["gastown"],
  },
  // Q8047455
  {
    id: "yaletown",
    name: "Yaletown, Vancouver",
    latitude: 49.2756,
    longitude: -123.1208,
    area: "Metro Vancouver",
    aliases: ["yaletown"],
  },
  // Q866741
  {
    id: "chinatown-vancouver",
    name: "Chinatown, Vancouver",
    latitude: 49.28,
    longitude: -123.0994,
    area: "Metro Vancouver",
    aliases: ["chinatown"],
  },
  // Q1076122
  {
    id: "west-end-vancouver",
    name: "West End, Vancouver",
    latitude: 49.285,
    longitude: -123.134,
    area: "Metro Vancouver",
    aliases: ["english bay", "davie village"],
  },
  // Q4176992
  {
    id: "coal-harbour",
    name: "Coal Harbour, Vancouver",
    latitude: 49.2931,
    longitude: -123.126,
    area: "Metro Vancouver",
    aliases: ["coal harbour", "coal harbor"],
  },
  // Q1231423
  {
    id: "granville-island",
    name: "Granville Island, Vancouver",
    latitude: 49.2714,
    longitude: -123.135,
    area: "Metro Vancouver",
    aliases: ["granville island"],
  },
  // Q4179275
  {
    id: "kitsilano",
    name: "Kitsilano, Vancouver",
    latitude: 49.2667,
    longitude: -123.1667,
    area: "Metro Vancouver",
    aliases: ["kitsilano"],
  },
  // Q6922863
  {
    id: "mount-pleasant-vancouver",
    name: "Mount Pleasant, Vancouver",
    latitude: 49.26,
    longitude: -123.108,
    area: "Metro Vancouver",
    aliases: ["mount pleasant"],
  },
];

/** Every town, grouped so a picker can show the two regions apart. */
export const TOWN_GROUPS: readonly {
  readonly area: string;
  readonly towns: readonly DiscoveryTown[];
}[] = [
  { area: "Okanagan", towns: OKANAGAN },
  {
    area: "Metro Vancouver",
    towns: [
      METRO_VANCOUVER[0]!,
      ...VANCOUVER_NEIGHBOURHOODS,
      ...METRO_VANCOUVER.slice(1),
    ],
  },
];

export const DISCOVERY_TOWNS: readonly DiscoveryTown[] = [
  ...OKANAGAN,
  ...METRO_VANCOUVER,
  ...VANCOUVER_NEIGHBOURHOODS,
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
