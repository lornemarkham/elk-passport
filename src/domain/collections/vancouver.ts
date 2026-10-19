import type { CuratedPlace } from "./places";

/**
 * **Downtown Vancouver, for the people who are about to be there.**
 *
 * Shared by Hockey Night (Rogers Arena) and Go Have A Conference (the
 * Vancouver Convention Centre). Addresses and coordinates were checked
 * against OpenStreetMap on 2026-10-19; the `web` link on a restaurant or bar
 * is the page that showed it still trading that day. See `places.ts` for what
 * that does and does not promise.
 *
 * Small on purpose. Add a place by checking it the same way and saying where
 * from; remove one the day it closes.
 */

const CHECKED = "2026-10-19";
const osm = (element: string) => `https://www.openstreetmap.org/${element}`;

export const VANCOUVER_PLACES: readonly CuratedPlace[] = [
  // ---------------------------------------------------------------- venues
  {
    id: "curated:vancouver:rogers-arena",
    name: "Rogers Arena",
    kind: "venue",
    address: "800 Griffiths Way",
    neighbourhood: "Stadium District",
    at: [49.27791, -123.10894],
    blurb: "Where the Canucks play.",
    source: { osm: osm("way/24705911"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:convention-centre-west",
    name: "Vancouver Convention Centre West",
    kind: "venue",
    address: "1055 Canada Place",
    neighbourhood: "Coal Harbour",
    at: [49.28891, -123.11608],
    blurb: "The building with the grass roof, on the water.",
    source: { osm: osm("way/85240507"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:convention-centre-east",
    name: "Vancouver Convention Centre East",
    kind: "venue",
    address: "999 Canada Place",
    neighbourhood: "Canada Place",
    at: [49.28833, -123.11257],
    blurb: "Under the white sails of Canada Place.",
    source: { osm: osm("node/4368953793"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:bc-place",
    name: "BC Place",
    kind: "venue",
    address: "777 Pacific Boulevard",
    neighbourhood: "Stadium District",
    at: [49.27669, -123.112],
    blurb: "The stadium next door to the arena.",
    source: { osm: osm("way/24705904"), checked: CHECKED },
  },

  // ----------------------------------------------------------- restaurants
  {
    id: "curated:vancouver:chambar",
    name: "Chambar",
    kind: "restaurant",
    address: "568 Beatty Street",
    neighbourhood: "Downtown",
    at: [49.28015, -123.10987],
    blurb: "Belgian cooking and mussels in an exposed-brick room.",
    source: {
      osm: osm("node/3235438890"),
      checked: CHECKED,
      web: "https://www.opentable.com/chambar",
    },
  },
  {
    id: "curated:vancouver:bao-bei",
    name: "Bao Bei",
    kind: "restaurant",
    address: "163 Keefer Street",
    neighbourhood: "Chinatown",
    at: [49.27962, -123.10057],
    blurb: "Chinese small plates and cocktails. No reservations.",
    source: {
      osm: osm("node/3933401480"),
      checked: CHECKED,
      web: "https://guide.michelin.com/ae-az/en/british-columbia/ca-vancouver/restaurant/bao-bei",
    },
  },
  {
    id: "curated:vancouver:rogue-gastown",
    name: "Rogue Kitchen & Wetbar",
    kind: "restaurant",
    address: "601 West Cordova Street",
    neighbourhood: "Waterfront Station",
    at: [49.28539, -123.1114],
    blurb: "Inside Waterfront Station, with thirty-odd beers on tap.",
    source: {
      osm: osm("node/2188770960"),
      checked: CHECKED,
      web: "https://venues.tripleseat.com/venues/vancouver/rogue-gastown",
    },
  },
  {
    id: "curated:vancouver:miku",
    name: "Miku",
    kind: "restaurant",
    address: "200 Granville Street",
    neighbourhood: "Waterfront",
    at: [49.28706, -123.11283],
    blurb: "Flame-seared sushi, across the street from Canada Place.",
    source: { osm: osm("node/4898455721"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:cactus-club-coal-harbour",
    name: "Cactus Club Cafe Coal Harbour",
    kind: "restaurant",
    address: "1085 Canada Place",
    neighbourhood: "Coal Harbour",
    at: [49.28966, -123.11809],
    blurb: "A big, easy room beside the Olympic Cauldron.",
    source: { osm: osm("way/89118744"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:joe-fortes",
    name: "Joe Fortes",
    kind: "restaurant",
    address: "777 Thurlow Street",
    neighbourhood: "Downtown",
    at: [49.28493, -123.12461],
    blurb: "Seafood and an oyster bar, a few blocks up from the water.",
    source: { osm: osm("node/3690929433"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:carderos",
    name: "Cardero's",
    kind: "restaurant",
    address: "1583 Coal Harbour Quay",
    neighbourhood: "Coal Harbour",
    at: [49.29157, -123.12752],
    blurb: "On a dock in Coal Harbour, on the walk to Stanley Park.",
    source: { osm: osm("node/4433485092"), checked: CHECKED },
  },

  // ------------------------------------------------------------------ bars
  {
    id: "curated:vancouver:steamworks",
    name: "Steamworks Brewpub",
    kind: "bar",
    address: "375 Water Street",
    neighbourhood: "Gastown",
    at: [49.28487, -123.11099],
    blurb:
      "A steam-powered brewery with harbour views. Big enough for a group.",
    source: {
      osm: osm("node/505751513"),
      checked: CHECKED,
      web: "https://www.destinationvancouver.com/listings/steamworks-brewing-company/18267/",
    },
  },
  {
    id: "curated:vancouver:blarney-stone",
    name: "The Blarney Stone",
    kind: "bar",
    address: "216 Carrall Street",
    neighbourhood: "Gastown",
    at: [49.28279, -123.10415],
    blurb: "Irish pub since 1972. Live music Friday to Sunday.",
    source: {
      osm: osm("node/6222249986"),
      checked: CHECKED,
      web: "https://gastown.org/listing/the-blarney-stone/",
    },
  },
  {
    id: "curated:vancouver:pourhouse",
    name: "Pourhouse",
    kind: "bar",
    address: "162 Water Street",
    neighbourhood: "Gastown",
    at: [49.28413, -123.10838],
    blurb: "Classic cocktails in a 1910 boot factory, by the Steam Clock.",
    source: {
      osm: osm("node/4390232892"),
      checked: CHECKED,
      web: "https://www.tourismvancouver.com/listings/pourhouse/11750/",
    },
  },
  {
    id: "curated:vancouver:lamplighter",
    name: "The Lamplighter Public House",
    kind: "bar",
    address: "92 Water Street",
    neighbourhood: "Gastown",
    at: [49.28374, -123.10625],
    blurb: "A Gastown pub at the quiet end of Water Street.",
    source: { osm: osm("node/5120582599"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:tap-and-barrel-convention-centre",
    name: "Tap & Barrel Convention Centre",
    kind: "bar",
    address: "76 – 1055 Canada Place",
    neighbourhood: "Coal Harbour",
    at: [49.2898, -123.11689],
    blurb: "Under the Convention Centre's whale, with a waterfront patio.",
    source: {
      osm: osm("node/5040239321"),
      checked: CHECKED,
      web: "https://www.destinationvancouver.com/places-to-eat/tap-and-barrel-convention-centre",
    },
  },
  {
    id: "curated:vancouver:yaletown-brewing",
    name: "Yaletown Brewing Company",
    kind: "bar",
    address: "1111 Mainland Street",
    neighbourhood: "Yaletown",
    at: [49.27556, -123.12086],
    blurb: "Vancouver's original brewpub, since 1994.",
    source: {
      osm: osm("node/7083218786"),
      checked: CHECKED,
      web: "https://www.opentable.co.uk/yaletown-brewing-company",
    },
  },
  {
    id: "curated:vancouver:craft-beer-market",
    name: "CRAFT Beer Market False Creek",
    kind: "bar",
    address: "85 West 1st Avenue",
    neighbourhood: "Olympic Village",
    at: [49.27057, -123.10638],
    blurb: "A huge beer hall across False Creek, in Olympic Village.",
    source: { osm: osm("node/3128863797"), checked: CHECKED },
  },

  // ------------------------------------------------------ meeting places
  {
    id: "curated:vancouver:stadium-chinatown-station",
    name: "Stadium–Chinatown Station",
    kind: "meeting",
    address: "Beatty Street at Dunsmuir Viaduct",
    neighbourhood: "Stadium District",
    at: [49.2794, -123.10931],
    blurb: "The SkyTrain stop across the street from the arena.",
    source: { osm: osm("node/5324635405"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:waterfront-station",
    name: "Waterfront Station",
    kind: "meeting",
    address: "601 West Cordova Street",
    neighbourhood: "Waterfront",
    at: [49.28618, -123.11222],
    blurb: "SkyTrain, SeaBus and the West Coast Express under one roof.",
    source: { osm: osm("node/3831781786"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:olympic-cauldron",
    name: "The Olympic Cauldron, Jack Poole Plaza",
    kind: "meeting",
    address: "Jack Poole Plaza, 1055 Canada Place",
    neighbourhood: "Coal Harbour",
    at: [49.28936, -123.11766],
    blurb: "Outside the Convention Centre West. Impossible to miss.",
    source: { osm: osm("node/648735254"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:steam-clock",
    name: "Gastown Steam Clock",
    kind: "meeting",
    address: "305 Water Street",
    neighbourhood: "Gastown",
    at: [49.28438, -123.10889],
    blurb: "It whistles every fifteen minutes. Everyone knows it.",
    source: { osm: osm("node/703754423"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:terry-fox-plaza",
    name: "Terry Fox Plaza",
    kind: "meeting",
    address: "Robson Street at Beatty Street",
    neighbourhood: "Stadium District",
    at: [49.27736, -123.11379],
    blurb: "The plaza outside BC Place, a short walk to the arena.",
    source: { osm: osm("way/402580006"), checked: CHECKED },
  },

  // ------------------------------------------------------------ activities
  {
    id: "curated:vancouver:lookout",
    name: "Vancouver Lookout",
    kind: "activity",
    address: "555 West Hastings Street",
    neighbourhood: "Downtown",
    at: [49.28461, -123.11232],
    blurb: "A glass elevator up Harbour Centre to a 360° view of the city.",
    source: { osm: osm("node/889550078"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:flyover-canada",
    name: "FlyOver Canada",
    kind: "activity",
    address: "999 Canada Place",
    neighbourhood: "Canada Place",
    at: [49.2892, -123.11035],
    blurb: "A flight-ride film across the country, at the end of Canada Place.",
    source: { osm: osm("node/4087855383"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:science-world",
    name: "Science World",
    kind: "activity",
    address: "1455 Quebec Street",
    neighbourhood: "False Creek",
    at: [49.27345, -123.10367],
    blurb: "The geodesic dome at the end of False Creek.",
    source: { osm: osm("way/37084312"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:sun-yat-sen-garden",
    name: "Dr. Sun Yat-Sen Classical Chinese Garden",
    kind: "activity",
    address: "578 Carrall Street",
    neighbourhood: "Chinatown",
    at: [49.27956, -123.10394],
    blurb: "A walled Ming-style garden, ten quiet minutes from the arena.",
    source: { osm: osm("way/456158488"), checked: CHECKED },
  },
  {
    id: "curated:vancouver:stanley-park-pavilion",
    name: "Stanley Park, from the Pavilion",
    kind: "activity",
    address: "610 Pipeline Road",
    neighbourhood: "Stanley Park",
    at: [49.29972, -123.13382],
    blurb: "The park side of the seawall, a good place to start walking.",
    source: { osm: osm("way/88279376"), checked: CHECKED },
  },
];

const byId = (id: string): CuratedPlace => {
  const place = VANCOUVER_PLACES.find((p) => p.id === id);
  if (!place) throw new Error(`No curated place ${id}`);
  return place;
};

/** The two venues the Experiences start from. */
export const ROGERS_ARENA = byId("curated:vancouver:rogers-arena");
export const CONVENTION_CENTRE_WEST = byId(
  "curated:vancouver:convention-centre-west",
);
