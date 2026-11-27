/**
 * **Featured Christmas events — the ones that cannot wait for a listing**
 * (M1152, "Christmas in Vernon: feature today's events").
 *
 * A short, hand-checked list: each entry was read against the organiser's own
 * page or the local press the week it was written, and says where. Dates and
 * times are Pacific (UTC−8 in winter) and are the *only* thing that decides
 * what shows: `featuredAt` is a pure function of the clock, so an event that
 * has ended is gone from Tonight without anybody removing it. Nothing here is
 * invented — where a source did not say (a price, an end time), the entry
 * says so or says nothing.
 *
 * This is not a second event database. Atlas stays the home of events; this
 * list exists because Atlas had not yet placed or dated these ones on the day
 * they mattered. `matchesFeatured` lets the ordinary feed drop its own copy
 * of the same event, so nobody sees a card twice.
 */

export interface FeaturedEvent {
  readonly id: string;
  readonly title: string;
  /** One honest sentence — what it is. */
  readonly blurb: string;
  /** ISO instants with the Pacific offset. */
  readonly startsAt: string;
  readonly endsAt: string;
  /** What the visitor reads for the time ("4–8 PM"). */
  readonly timeLabel: string;
  /** What the visitor reads for the day(s). */
  readonly dayLabel: string;
  readonly place: string;
  /** What a map search should be given. */
  readonly directionsQuery: string;
  readonly cost: string;
  readonly details: readonly string[];
  /** The organiser's or press page the facts were checked against. */
  readonly source: { readonly label: string; readonly href: string };
  /** Words that identify the same event in the Atlas feed. */
  readonly match: readonly string[];
  readonly image?: {
    readonly src: string;
    readonly alt: string;
    readonly credit: string;
  };
}

const PACIFIC = "-08:00";
const at = (day: string, time: string) => `${day}T${time}:00${PACIFIC}`;

export const FROSTIVAL: FeaturedEvent = {
  id: "frostival-2026",
  title: "Frostival",
  blurb:
    "Downtown Vernon turns 30th Avenue into a free winter street festival: live music, food trucks, vendors, holiday lights, Santa and family activities.",
  startsAt: at("2026-11-27", "16:00"),
  endsAt: at("2026-11-27", "20:00"),
  timeLabel: "4–8 PM",
  dayLabel: "Friday, November 27",
  place: "Downtown Vernon — 30th Avenue, 29th to 34th Street",
  directionsQuery: "30th Avenue and 31st Street, Vernon, BC",
  cost: "Free",
  details: [
    "Main stage from 4 PM; Santa arrives at 6 PM (and is up for sELFies).",
    "Kinshira Fire Show at 6:30 PM, about 20 minutes.",
    "Five blocks of vendors, food trucks, activities and entertainers.",
    "30th Avenue closes early for set-up; parking is free at all meters.",
  ],
  source: {
    label: "Downtown Vernon Association",
    href: "https://www.downtownvernon.com/",
  },
  match: ["frostival"],
  image: {
    src: "https://www.tourismvernon.com/sites/default/files/styles/scale_1920/public/2026-10/Frostival%202025%20Image%202.jpg",
    alt: "Frostival on 30th Avenue in Downtown Vernon",
    credit: "Tourism Vernon",
  },
};

export const HOSPICE_LIGHT_UP: FeaturedEvent = {
  id: "nohs-light-up-2026",
  title: "NOHS Holiday Light-Up and Lanterns of Legacy",
  blurb:
    "A quiet evening in the Hospice gardens to remember someone: glowing lanterns along the paths and a tree where you hang a butterfly with a loved one's name.",
  startsAt: at("2026-11-27", "16:30"),
  endsAt: at("2026-11-27", "18:00"),
  timeLabel: "4:30–6 PM",
  dayLabel: "Friday, November 27",
  place: "Hospice House, 3506 27th Avenue, Vernon",
  directionsQuery: "Hospice House, 3506 27th Avenue, Vernon, BC",
  cost: "Free community event",
  details: [
    "Write a name on a butterfly ornament — hang it on the tree or take it home.",
    "Lanterns carry the names of those who spent time at Hospice House this past year; families may add names or take a lantern home.",
    "Hot chocolate, cookies and live music. No formal program — stay as long as feels right.",
  ],
  source: {
    label: "Vernon Morning Star, Nov 23",
    href: "https://vernonmorningstar.com/2026/11/23/lights-reflect-those-lost-at-north-okanagan-hospice/",
  },
  match: ["lanterns of legacy", "nohs holiday light"],
};

export const BETHLEHEM_STAR: FeaturedEvent = {
  id: "bethlehem-star-2026",
  title: "Bethlehem Star",
  blurb:
    "Emmanuel Baptist Church becomes first-century Bethlehem: a live market where you barter with shekels, shepherds, wise men, a live nativity, and hot chocolate and home-baked cookies in a peaceful sanctuary.",
  startsAt: at("2026-12-04", "17:30"),
  endsAt: at("2026-12-06", "19:00"),
  timeLabel: "Fri 5:30–7:30 · Sat 2–7 · Sun 3–7 PM",
  dayLabel: "December 4–6",
  place: "Emmanuel Baptist Church, 3412 15th Avenue, Vernon",
  directionsQuery: "Emmanuel Baptist Church, 3412 15th Avenue, Vernon, BC",
  cost: "Free",
  details: [
    "Friday December 4: 5:30–7:30 PM. Saturday December 5: 2–7 PM. Sunday December 6: 3–7 PM (hours from the church's own 2026 poster; its calendar lists 5:30–7 PM).",
    "A live Bethlehem market, a live nativity, hot chocolate and cookies, and the Christmas story told.",
    "Questions: 250-545-5941 (Mon–Fri, 9 AM–4 PM) or emmanuelvernon@gmail.com.",
  ],
  source: {
    label: "Emmanuel Baptist Church",
    href: "https://www.emmanuelvernon.ca/ministries/bethlehem-star",
  },
  match: ["bethlehem star"],
  image: {
    src: "https://dq5pwpg1q8ru0.cloudfront.net/2026/11/18/19/35/39/8ee331b6-bf17-4abb-a1d4-159316023c75/Bethlehem-Star-website-graphic.png",
    alt: "Bethlehem Star 2026 poster: camels crossing a desert under a bright star above the town of Bethlehem",
    credit: "Emmanuel Baptist Church",
  },
};

export const SILVERSTAR_LIGHT_UP: FeaturedEvent = {
  id: "silverstar-light-up-2026",
  title: "SilverStar Annual Light Up",
  blurb:
    "The mountain village lights up for Christmas: a market, entertainment, Santa, a torchlight parade and fireworks.",
  startsAt: at("2026-12-05", "15:00"),
  endsAt: at("2026-12-05", "21:00"),
  timeLabel: "Market from 3 PM · light-up at 4 PM",
  dayLabel: "Saturday, December 5",
  place: "SilverStar Mountain Resort village, Vernon",
  directionsQuery: "SilverStar Mountain Resort, Vernon, BC",
  cost: "Check the resort for costs, parking and gondola",
  details: [
    "Entertainment, Santa, the torchlight parade and fireworks after dark.",
    "Dress warm — it is a mountain village in December.",
  ],
  source: {
    label: "SilverStar Stays events",
    href: "https://silverstarstays.com/event/silverstar-annual-light-up-2",
  },
  match: ["silverstar annual light up", "silver star annual light up"],
  image: {
    src: "https://silverstarstays.com/wp-content/uploads/2026/09/light-up-2025-2.webp",
    alt: "Fire spinners in the snow before a crowd at SilverStar's 2025 Light Up",
    credit: "SilverStar Stays",
  },
};

export const NONA_LIGHTS: FeaturedEvent = {
  id: "nona-lights-2026",
  title: "John Christmas Light Tour — NONA Lights for Kids",
  blurb:
    "A self-guided drive past Christmas lights across Vernon, Coldstream and Armstrong, supporting NONA.",
  startsAt: at("2026-12-01", "00:00"),
  endsAt: at("2026-12-31", "23:59"),
  timeLabel: "Self-guided, all month",
  dayLabel: "December 1–31",
  place: "Vernon, Coldstream and Armstrong",
  directionsQuery: "NONA Child Development Centre, Vernon, BC",
  cost: "Self-guided; supports NONA Child Development Centre",
  details: [
    "The tour map is posted at johnchristmaseveryday.com (the City of Vernon listing says late November).",
    "Related: NONA's Lights for Kids BBQ and Santa photos, Friday December 4, about 4–6:30 PM at the NONA Child Development Centre (by-donation BBQ).",
  ],
  source: {
    label: "City of Vernon events",
    href: "https://www.vernon.ca/node/875921",
  },
  match: ["nona lights", "john christmas light tour"],
};

export const FEATURED: readonly FeaturedEvent[] = [
  FROSTIVAL,
  HOSPICE_LIGHT_UP,
  BETHLEHEM_STAR,
  SILVERSTAR_LIGHT_UP,
  NONA_LIGHTS,
];

const NORTH_OKANAGAN: ReadonlySet<string> = new Set([
  "vernon",
  "coldstream",
  "lumby",
  "silverstar",
  "armstrong",
  "enderby",
  "spallumcheen",
]);

/** Is this town close enough to Vernon for these events to be "near you"? */
export const inNorthOkanagan = (town: string | undefined): boolean =>
  town !== undefined && NORTH_OKANAGAN.has(town);

/** The Pacific calendar day of an instant — the day a Vernon visitor is in. */
export const pacificDay = (now: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Vancouver",
  }).format(now);

const dayOf = (iso: string) => iso.slice(0, 10);

export interface FeaturedNow {
  /** On today and not yet over, soonest first. */
  readonly tonight: readonly FeaturedEvent[];
  /** Starts another day, or is a long run already under way; not over. */
  readonly soon: readonly FeaturedEvent[];
  /** The Bethlehem Star showcase, until its last evening ends. */
  readonly star: FeaturedEvent | undefined;
}

/**
 * **What is featured at this moment.** An event whose end has passed appears
 * nowhere; one on today's date and still to end is Tonight; the rest are
 * Coming soon (or "on now" for a long run like the light tour). The
 * Bethlehem Star has its own showcase and is kept out of the soon list.
 */
export function featuredAt(now: Date): FeaturedNow {
  const today = pacificDay(now);
  const live = FEATURED.filter((e) => Date.parse(e.endsAt) > now.getTime());
  const sameDay = (e: FeaturedEvent) =>
    dayOf(e.startsAt) === today && dayOf(e.endsAt) === today;
  const tonight = live
    .filter(sameDay)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const soon = live
    .filter((e) => !sameDay(e) && e.id !== BETHLEHEM_STAR.id)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return {
    tonight,
    soon,
    star: live.find((e) => e.id === BETHLEHEM_STAR.id),
  };
}

/** Is `title` the same event as one of the featured ones? */
export const matchesFeatured = (title: string): boolean => {
  const t = title.toLowerCase();
  return FEATURED.some((e) => e.match.some((m) => t.includes(m)));
};

/** Is the event under way right now (a long run rather than an evening)? */
export const isOnNow = (e: FeaturedEvent, now: Date): boolean =>
  Date.parse(e.startsAt) <= now.getTime() &&
  Date.parse(e.endsAt) > now.getTime();
