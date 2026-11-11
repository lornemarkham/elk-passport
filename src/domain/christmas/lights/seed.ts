import type { FeatureId, Kind, Pin, TownId } from "./model";

/**
 * **Researched public pins** — the map's first lights, so a family opening it
 * on day one finds something real. Every one is a public place (a street, a
 * park, a market, a farm theatre), never a home, with the page it came from
 * and the day it was read (2026-11-10). Points are the public venue's, from
 * OpenStreetMap/Nominatim or Wikipedia.
 *
 * Seasons are what the sources say: a 2026 date confirms 2026; a page that
 * only shows 2025 leaves the pin _Not yet confirmed this year_ until a family
 * or a reviewer says otherwise. Lumby is absent on purpose: its newest
 * sourced light-up is from 2019. A Coldstream light-up (2025) is absent
 * because its venue could not be placed reliably.
 */

const READ = "2026-11-10";
const TV_MARKETS =
  "https://www.tourismvernon.com/blog/holiday-cheer-in-vernon-your-guide-to-local-markets";
const TK_LIGHTS =
  "https://www.tourismkelowna.com/blog/stories/post/where-to-find-holiday-lights-in-kelowna/";
const TK_MARKETS =
  "https://www.tourismkelowna.com/blog/stories/post/must-see-holiday-markets-in-kelowna/";

interface Researched {
  id: string;
  kind: Kind;
  name: string;
  town: TownId;
  lat: number;
  lng: number;
  address: string;
  description: string;
  hours: string;
  season: number;
  dates?: Pin["dates"];
  features?: FeatureId[];
  url: string;
  says: string;
}

const pin = (r: Researched): Pin => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  description: r.description,
  town: r.town,
  at: { lat: r.lat, lng: r.lng },
  address: r.address,
  hours: r.hours,
  ...(r.dates ? { dates: r.dates } : {}),
  features: r.features ?? [],
  residential: false,
  status: "approved",
  confirmed: [r.season],
  dark: [],
  source: { url: r.url, read: READ, says: r.says },
  submittedBy: "research",
  submittedAt: `${READ}T00:00:00.000Z`,
  reactions: [],
  trail: [
    {
      at: `${READ}T00:00:00.000Z`,
      by: "research",
      kind: "approved",
      season: r.season,
      text: `Researched public listing: ${r.url}`,
    },
  ],
  updatedAt: `${READ}T00:00:00.000Z`,
});

const RESEARCHED: readonly Researched[] = [
  {
    id: "seed-frostival-vernon",
    kind: "festive-attraction",
    name: "Frostival — Downtown Vernon's Winter Street Festival",
    town: "vernon",
    lat: 50.26379,
    lng: -119.27816,
    address: "30th Avenue (Main Street), Downtown Vernon",
    description:
      "The Downtown Vernon Association's winter street festival: artisan vendors, holiday characters, festive activities and free music.",
    hours: "Friday, November 27, 4–8 pm",
    season: 2026,
    dates: { from: "2026-11-27", to: "2026-11-27" },
    features: ["walk", "music"],
    url: "https://www.downtownvernon.com",
    says: "Frostival, November 27, 4 PM–8 PM",
  },
  {
    id: "seed-artsolutely-vernon",
    kind: "market",
    name: "Artsolutely Holiday Market",
    town: "vernon",
    lat: 50.26048,
    lng: -119.271,
    address: "Vernon Community Arts Centre, Polson Park",
    description:
      "The holiday market at the Vernon Community Arts Centre, billed as tax-free shopping.",
    hours: "Daily, November 28 – December 24",
    season: 2026,
    dates: { from: "2026-11-28", to: "2026-12-24" },
    features: ["walk"],
    url: TV_MARKETS,
    says: "Artsolutely Holiday Market, Nov 28–Dec 24, open daily",
  },
  {
    id: "seed-sleigh-all-day-vernon",
    kind: "market",
    name: "Sleigh All Day Christmas Market",
    town: "vernon",
    lat: 50.26828,
    lng: -119.27683,
    address: "Vernon Recreation Centre",
    description: "A Christmas market at the Vernon Recreation Centre.",
    hours: "November 28–29 (check the hours with the organiser)",
    season: 2026,
    dates: { from: "2026-11-28", to: "2026-11-29" },
    url: TV_MARKETS,
    says: "Sleigh All Day Christmas Market, Nov 28–29, Vernon Recreation Centre",
  },
  {
    id: "seed-yuletide-abnc",
    kind: "festive-attraction",
    name: "Discover Yuletide at Allan Brooks Nature Centre",
    town: "vernon",
    lat: 50.23992,
    lng: -119.28964,
    address: "Allan Brooks Nature Centre, 250 Allan Brooks Way, Vernon",
    description:
      "A Yuletide day at the nature centre, from Tourism Vernon's holiday guide. Check the details with the centre before you go.",
    hours: "Saturday, November 21 (hours not published yet)",
    season: 2026,
    dates: { from: "2026-11-21", to: "2026-11-21" },
    url: TV_MARKETS,
    says: "Discover Yuletide at Allan Brooks Nature Centre, Nov 21",
  },
  {
    id: "seed-silverstar-light-up",
    kind: "community-tree",
    name: "SilverStar Annual Light Up",
    town: "vernon",
    lat: 50.35839,
    lng: -119.06441,
    address: "SilverStar Mountain Resort village",
    description:
      "The mountain village's annual light-up. Last year it came with a Christmas market, a DJ, roaming performers and gondola rides by donation.",
    hours:
      "Saturday, December 5 (last year: market from 3 pm, light-up at 4 pm)",
    season: 2026,
    dates: { from: "2026-12-05", to: "2026-12-05" },
    features: ["walk", "music"],
    url: TV_MARKETS,
    says: "SilverStar Annual Light Up, Saturday Dec 5",
  },
  {
    id: "seed-armstrong-light-up",
    kind: "community-tree",
    name: "Downtown Light Up — A Little Christmas Magic",
    town: "armstrong",
    lat: 50.44455,
    lng: -119.19416,
    address: "Downtown Armstrong",
    description:
      "The Armstrong Spallumcheen Chamber of Commerce's kickoff to the season: activities and shopping all day, then the community light-up. No parade this year because of downtown construction.",
    hours: "Saturday, November 28: 10 am–4 pm, light-up about 4:30 pm",
    season: 2026,
    dates: { from: "2026-11-28", to: "2026-11-28" },
    features: ["walk"],
    url: "https://chamber-website-1gg.pages.dev/festivals/downtown-light-up",
    says: "Downtown Light Up – A Little Christmas Magic 2026, Saturday November 28",
  },
  {
    id: "seed-farmstrong-markets",
    kind: "market",
    name: "Farmstrong Cider Company's Christmas Markets",
    town: "armstrong",
    lat: 50.46096,
    lng: -119.24178,
    address:
      "Farmstrong Cider Company, 4300 Maw Road, Armstrong (park at the IPE grounds and take the shuttle)",
    description:
      "A Christmas market at the cidery with free wagon rides. Bring cash; there's no parking on site.",
    hours: "Saturdays, November 21 and 28",
    season: 2026,
    dates: {
      from: "2026-11-21",
      to: "2026-11-28",
      only: ["2026-11-21", "2026-11-28"],
    },
    url: TV_MARKETS,
    says: "Farmstrong Cider Company's Christmas Markets, Saturdays Nov 21 & 28",
  },
  {
    id: "seed-caravan-hockey-sweater",
    kind: "festive-attraction",
    name: "The Hockey Sweater — Caravan Farm Theatre's Winter Sleigh Ride Show",
    town: "armstrong",
    lat: 50.4946,
    lng: -119.2597,
    address: "Caravan Farm Theatre, 4886 Salmon River Road, Armstrong",
    description:
      "An outdoor winter show from Roch Carrier's story, with horse-drawn sleigh rides between the scenes, fires, music and hot cider. A local tradition, in its 38th year. Ticketed.",
    hours:
      "December 1 – January 17; shows at 5 and 7 pm, some at 3 pm (about an hour)",
    season: 2026,
    dates: { from: "2026-12-01", to: "2027-01-17" },
    features: ["music"],
    url: "https://caravanfarmtheatre.com/show/the-hockey-sweater/",
    says: "The Hockey Sweater, Dec 1–Jan 17, 5:00 and 7:00 PM",
  },
  {
    id: "seed-kelowna-stuart-park",
    kind: "community-tree",
    name: "Downtown Kelowna Light Up! & Winter Street Market",
    town: "kelowna",
    lat: 49.88881,
    lng: -119.49713,
    address: "Stuart Park, Downtown Kelowna",
    description:
      "A holiday market with local vendors, food trucks and live performances, ending with the lighting of the downtown Christmas tree. Tourism Kelowna says the Stuart Park tree and the Bernard Avenue displays stay up for the season.",
    hours:
      "Light Up: Saturday, November 28. The tree stays lit through the season.",
    season: 2026,
    dates: { from: "2026-11-28", to: "2027-01-04" },
    features: ["walk", "free", "music", "stroller"],
    url: "https://www.tourismkelowna.com/events/annual-events-festivals/winter/light-up-winter-street-market/",
    says: "Light Up & Winter Street Market, November 28, 2026",
  },
  {
    id: "seed-kelowna-tree-of-hope",
    kind: "community-tree",
    name: "Tree of Hope at the Landmark District",
    town: "kelowna",
    lat: 49.88094,
    lng: -119.4624,
    address: "Landmark District, Dickson Avenue, Kelowna",
    description:
      "The 120-foot Tree of Hope, lit with a holiday festival. Free to see; it stays lit until the first week of January.",
    hours:
      "Light-up festival: Saturday, November 21. Lit through early January.",
    season: 2026,
    dates: { from: "2026-11-21", to: "2027-01-04" },
    features: ["free", "drive-by"],
    url: TK_LIGHTS,
    says: "Tree of Hope Festival, November 21, 2026; lit until the first week of January",
  },
  // Last confirmed in 2025: shown as not yet confirmed this year.
  {
    id: "seed-sparkling-hill-market",
    kind: "market",
    name: "Sparkling Hill Outdoor Christmas Market",
    town: "vernon",
    lat: 50.19808,
    lng: -119.39288,
    address: "Sparkling Hill Resort, 888 Sparkling Place, Vernon",
    description:
      "An outdoor Christmas market at Sparkling Hill Resort. Last year: free entry, ages 16+.",
    hours: "Last year: December 6–7, 11 am–5 pm",
    season: 2025,
    features: ["free"],
    url: "https://www.sparklinghill.com/blog/a-sparkling-holiday/",
    says: "Outdoor Christmas market, Dec 6 and 7, 2025, 11 AM–5 PM",
  },
  {
    id: "seed-rutland-centennial-tree",
    kind: "community-tree",
    name: "Rutland Centennial Park Christmas Tree",
    town: "kelowna",
    lat: 49.89126,
    lng: -119.38836,
    address: "Rutland Centennial Park, Kelowna",
    description:
      "The Rutland Winter Light Up ends with lighting the park's tree, which stays lit for the season.",
    hours: "Lit through the season (last confirmed 2025)",
    season: 2025,
    features: ["free", "drive-by"],
    url: TK_LIGHTS,
    says: "Rutland's Centennial Park tree stays lit for the season (2025 article)",
  },
  {
    id: "seed-christkindl-kelowna",
    kind: "market",
    name: "Christkindl Market",
    town: "kelowna",
    lat: 49.8916,
    lng: -119.49375,
    address: "The Laurel Packinghouse, 1304 Ellis Street, Kelowna",
    description: "A Christkindl market at the historic Laurel Packinghouse.",
    hours: "Last year: December 5–7",
    season: 2025,
    features: ["walk"],
    url: TK_MARKETS,
    says: "Christkindl Market, Dec 5–7, 2025",
  },
  {
    id: "seed-craft-culture-kelowna",
    kind: "market",
    name: "Craft Culture Holiday Market",
    town: "kelowna",
    lat: 49.89224,
    lng: -119.49542,
    address: "Prospera Place, Kelowna",
    description: "A big holiday market of local makers at Prospera Place.",
    hours: "Last year: December 5–7",
    season: 2025,
    url: TK_MARKETS,
    says: "Craft Culture Holiday Market, Dec 5–7, 2025",
  },
  {
    id: "seed-festival-of-trees-kelowna",
    kind: "public-display",
    name: "Festival of Trees",
    town: "kelowna",
    lat: 49.89161,
    lng: -119.4977,
    address: "Delta Hotels Grand Okanagan Resort, 1310 Water Street, Kelowna",
    description:
      "Decorated Christmas trees on display through the season, raising money for BC Children's Hospital Foundation. Its events are ticketed.",
    hours: "Last year: November 23 – January 4",
    season: 2025,
    features: ["walk"],
    url: TK_LIGHTS,
    says: "Festival of Trees, Nov 23, 2025–Jan 4, 2026",
  },
];

export const SEED: readonly Pin[] = RESEARCHED.map(pin);
