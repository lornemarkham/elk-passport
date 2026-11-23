import { distanceKm } from "@/lib/environment/geo";

/**
 * **Local favourites** — two Okanagan pubs that were among Passport's first
 * local supporters, recommended where they are genuinely useful (owner brief
 * M1007, "Feature two early local supporters", 2026-11-22).
 *
 * ## Editorial, not an ad, not a partnership
 *
 * Each entry is a recommendation Go Have a Day makes because the place fits
 * the experience it appears in: après at SilverStar, a warm stop near the
 * lights, a pub by the lake in Vernon. The card says it is our pick. It never
 * says _partner_, _official_ or _sponsored_ — nobody has agreed to any of
 * those — and it states no specials, events or endorsements (see
 * `locals.test.ts`).
 *
 * ## Atlas still owns knowledge
 *
 * Both pubs are Atlas entities already (`atlasId`), so nothing here is a
 * second business record. Atlas holds each one with no location, website,
 * contact or photo, so the facts a visitor needs to get there are kept here
 * the way `snow/resorts.ts` keeps a resort's published facts: every value is
 * quoted from a page Passport read, with the page and the day. The same facts
 * are requested from Atlas in `docs/product/local-favourites/README.md`; when
 * Atlas holds them, this list should read them from Atlas instead.
 *
 * ## What is never said
 *
 * Hours are said only when two sources agree. Long John's own site and
 * OpenStreetMap disagree, so the card says hours are not confirmed and offers
 * the phone. Alexander's publishes no hours anywhere Passport could read.
 */

export interface Sourced<T> {
  readonly value: T;
  /** The source's words, verbatim. */
  readonly quote: string;
  readonly source: string;
  /** `YYYY-MM-DD` — the day Passport read the source. */
  readonly checked: string;
}

export interface FavouritePhoto {
  readonly url: string;
  /** What the picture shows, from looking at it. */
  readonly alt: string;
  /** Said under the picture. */
  readonly credit: string;
}

/** An experience a favourite is recommended in. */
export type FavouriteExperience =
  "go-have-a-day" | "christmas" | "snow" | "sesh-wars";

export interface LocalFavourite {
  /** The path segment: `/favourites/<slug>`. */
  readonly slug: string;
  readonly name: string;
  /** The Atlas Organization this is. Never a second record. */
  readonly atlasId: string;
  readonly kind: "Pub";
  /** Where, in a person's words. */
  readonly place: string;
  /** One editorial line: why it is worth the stop. No claims beyond the sources. */
  readonly line: string;
  /** What it is good for, as short tags. */
  readonly goodFor: readonly string[];
  /** In its own words, where it has any; otherwise a named source's. */
  readonly said: Sourced<string>;
  readonly address: Sourced<string>;
  /** A point for distance and directions, with where it came from. */
  readonly at: Sourced<{ latitude: number; longitude: number }>;
  readonly phone?: Sourced<string>;
  readonly website?: Sourced<string>;
  readonly social: readonly { label: string; url: string }[];
  /** Said as a fact only when confirmed; otherwise why not. */
  readonly hours:
    | { readonly confirmed: true; readonly value: Sourced<string> }
    | {
        readonly confirmed: false;
        readonly why: string;
        /** What the business itself published, if anything. */
        readonly published?: Sourced<string>;
      };
  readonly photos: readonly FavouritePhoto[];
  /** Where it is recommended, and the line it carries there. */
  readonly in: Partial<Record<FavouriteExperience, string>>;
  /** Snow mountain id, where it is on a mountain. */
  readonly mountainId?: string;
  /** Other places a visit pairs with, inside Passport. */
  readonly pairsWith: readonly { label: string; href: string; line: string }[];
}

const CHECKED = "2026-11-22";
const LJ = "https://www.longjohnspub.com/";
const LJ_PHOTO = (id: string, w: number, h: number) =>
  `https://static.wixstatic.com/media/${id}/v1/fill/w_${w},h_${h},al_c/${id}`;
const OSM_LJ = "https://www.openstreetmap.org/node/6045601454";
const OSM_ALEX = "https://www.openstreetmap.org/way/314473006";
const TV_PATIOS = "https://tourismvernon.com/blog/vernons-top-patios";
const MAINMENUS =
  "https://mainmenus.com/vernon-bc-restaurants/american-cuisine/alexanders-beach-pub";

export const LOCAL_FAVOURITES: readonly LocalFavourite[] = [
  {
    slug: "long-johns-pub",
    name: "Long John's Pub",
    atlasId: "a0c4c529-8cf6-4431-afdd-c559f0a63195",
    kind: "Pub",
    place: "Main Street, SilverStar village",
    line: "Warm up with the locals. A cozy pub on SilverStar's Main Street for après food and a drink once the lifts stop.",
    goodFor: ["Après", "Pub food", "Full bar", "Families welcome"],
    said: {
      value:
        "Long John's is a local favourite. This cozy pub is open daily during Silver Star Mountain's winter season. Families are very welcome.",
      quote:
        "Long John’s is a local favourite. This cozy pub is open daily during Silver Star Mountain's winter season. Families are very welcome.",
      source: LJ,
      checked: CHECKED,
    },
    address: {
      value: "139 Main St, Silver Star Mountain Resort, BC",
      quote:
        "139 Main St, Silver Star Mountain Resort, British Columbia, Canada",
      source: LJ,
      checked: CHECKED,
    },
    at: {
      value: { latitude: 50.35934, longitude: -119.059306 },
      quote: "Long John's Pub · 139 Main Street, Silverstar Mountain",
      source: OSM_LJ,
      checked: CHECKED,
    },
    phone: {
      value: "+12505492992",
      quote: "(250) 549-2992",
      source: LJ,
      checked: CHECKED,
    },
    website: {
      value: LJ,
      quote: "Long John's Pub | Silver Star Mountain Resort",
      source: LJ,
      checked: CHECKED,
    },
    social: [
      { label: "Instagram", url: "https://www.instagram.com/longjohnspub_/" },
      { label: "Facebook", url: "https://www.facebook.com/longjohnspubbc" },
    ],
    hours: {
      confirmed: false,
      why: "Hours aren't confirmed for this season — the pub's site and other listings disagree. Call ahead.",
      published: {
        value: "Winter hours: open 7 days, 11 am – 10 pm",
        quote: "WINTER HOURS Open 7 Days 11 am - 10 pm",
        source: LJ,
        checked: CHECKED,
      },
    },
    photos: [
      {
        url: LJ_PHOTO(
          "8efbc0_9950020830c7415abecb25b5b621be7f~mv2_d_2250_1265_s_2.jpg",
          2250,
          1265,
        ),
        alt: "The Long John's sign and red star above the pub's stone-and-timber entrance in SilverStar village",
        credit: "Photo: Long John's Pub",
      },
      {
        url: LJ_PHOTO(
          "8efbc0_19d01c7c2d964ea79915d00dc2f77522~mv2_d_2500_1875_s_2.jpg",
          2500,
          1875,
        ),
        alt: "Two pints of Okanagan Spring amber on a wooden table",
        credit: "Photo: Long John's Pub",
      },
      {
        url: LJ_PHOTO(
          "8efbc0_202360529a03470dbc8b7f75bec5fddc~mv2_d_2500_1875_s_2.jpg",
          2500,
          1875,
        ),
        alt: "A cheeseburger and fries on a plate",
        credit: "Photo: Long John's Pub",
      },
    ],
    in: {
      snow: "Après in the village: Long John's, on SilverStar's Main Street, open daily in the winter season.",
      "sesh-wars":
        "After the sesh: Long John's, on SilverStar's Main Street, to argue about who won.",
      christmas:
        "A warm stop before or after the lights: Long John's Pub, up in SilverStar village.",
      "go-have-a-day":
        "A cozy village pub at SilverStar, open daily through the winter season.",
    },
    mountainId: "silverstar",
    pairsWith: [
      {
        label: "Plan a Snow Day at SilverStar",
        href: "/snow/new",
        line: "Pick the hill, vote on lunch and après with your crew.",
      },
      {
        label: "Sesh Wars at SilverStar",
        href: "/snow/sesh-wars/m/silverstar",
        line: "Post a clip on a park feature, then settle it at the pub.",
      },
      {
        label: "Christmas near Vernon",
        href: "/christmas/discover?at=vernon",
        line: "Lights, markets and Santa within reach of the mountain.",
      },
    ],
  },
  {
    slug: "alexanders-beach-pub",
    name: "Alexander's Beach Pub",
    atlasId: "f7f3967e-4eaf-4311-982f-572d2f4d1e70",
    kind: "Pub",
    place: "Kal Beach, Kalamalka Lake, Vernon",
    line: "A lakeside local at Kal Beach: a big food and drink menu, and a patio over Kalamalka Lake when the sun's out.",
    goodFor: ["Lakeside", "Pub food", "Lake-view patio"],
    said: {
      value:
        "A local favourite: the lakeside patio next to beautiful Kalamalka Lake, and an extensive food and drink menu.",
      quote:
        "Another local favourite is the lakeside patio at Alexander’s Beach Pub located next to beautiful Kalamalka Lake. Watch the action on the lake and enjoy summer breezes while sampling the pub’s extensive food and drink menu. On weekends they offer brunch to savour on the patio.",
      source: TV_PATIOS,
      checked: CHECKED,
    },
    address: {
      value: "12408 Kalamalka Rd, Vernon (Coldstream), BC",
      quote: "12408 Kalamalka Lake Road, Vernon, BC V1T",
      source: MAINMENUS,
      checked: CHECKED,
    },
    at: {
      value: { latitude: 50.23019, longitude: -119.26374 },
      quote: "Alexander's Pub and Liquor Store, Kalamalka Road, Coldstream",
      source: OSM_ALEX,
      checked: CHECKED,
    },
    phone: {
      value: "+12505453131",
      quote: "+1 2505453131",
      source: MAINMENUS,
      checked: CHECKED,
    },
    social: [
      {
        label: "Facebook",
        url: "https://www.facebook.com/Alexanders-Beach-PUB-Liquor-Store-187354281298797/",
      },
    ],
    hours: {
      confirmed: false,
      why: "Hours aren't published anywhere we could check. Call ahead.",
    },
    photos: [],
    in: {
      christmas:
        "Before or after the lights: Alexander's Beach Pub, by Kalamalka Lake.",
      "go-have-a-day":
        "A lakeside pub at Kal Beach with a big food and drink menu.",
    },
    pairsWith: [
      {
        label: "Discover Vernon",
        href: "/discovery?at=vernon",
        line: "What's on and worth doing around Vernon today.",
      },
      {
        label: "Christmas in Vernon",
        href: "/christmas/discover?at=vernon",
        line: "Lights, markets and Santa, with dates and distance on every card.",
      },
      {
        label: "Build a day around it",
        href: "/go",
        line: "Start from Vernon and let the Day Builder fill the rest.",
      },
    ],
  },
];

/** How a favourite card says why it is there. Never "partner" or "sponsored". */
export const FAVOURITE_LABEL = "Local favourite · our pick";

export const favouriteBySlug = (slug: string) =>
  LOCAL_FAVOURITES.find((f) => f.slug === slug);

export const favouriteByAtlasId = (id: string) =>
  LOCAL_FAVOURITES.find((f) => f.atlasId === id);

/**
 * Favourites recommended in `experience` within `km` (straight line) of
 * `from`, nearest first. No point, no answer: a favourite is never shown as
 * nearby to somebody we cannot place (doctrine §7).
 */
export function favouritesNear(
  experience: FavouriteExperience,
  from: { latitude: number; longitude: number } | undefined,
  km: number,
  list: readonly LocalFavourite[] = LOCAL_FAVOURITES,
): { favourite: LocalFavourite; km: number }[] {
  if (!from) return [];
  return list
    .filter((f) => f.in[experience])
    .map((favourite) => ({
      favourite,
      km: distanceKm(from, favourite.at.value),
    }))
    .filter((x) => x.km <= km)
    .sort((a, b) => a.km - b.km);
}

/** Favourites on a snow mountain, for Snow Day and Sesh Wars. */
export const favouritesOnMountain = (
  mountainId: string | undefined,
  experience: "snow" | "sesh-wars",
  list: readonly LocalFavourite[] = LOCAL_FAVOURITES,
) =>
  mountainId
    ? list.filter((f) => f.mountainId === mountainId && f.in[experience])
    : [];

/** The phone's map app, to the stated point. */
export const directionsHref = (f: LocalFavourite) =>
  `https://www.google.com/maps/dir/?api=1&destination=${f.at.value.latitude},${f.at.value.longitude}`;

/** `+12505492992` → `(250) 549-2992`. */
export const phoneText = (e164: string) => {
  const d = e164.replace(/\D/g, "").replace(/^1/, "");
  return d.length === 10
    ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    : e164;
};
