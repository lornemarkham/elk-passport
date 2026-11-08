/**
 * **What a resort itself has published, and when Passport last read it.**
 *
 * Every value here is a quote from the resort's own website, with the page
 * it was read on and the date it was read. Nothing is inferred: a season
 * the resort hasn't published is absent, and the screen says so. Opening
 * dates are the resort's *plan* ("tentative", "snow permitting"), never a
 * promise, and the screen repeats the resort's own caveat beside them.
 *
 * Passport does not read lift or run status live (no licensed feed, and the
 * resorts' pages are their own to serve). Status is therefore a link to the
 * official page, plus whatever the resort's page said on the day it was
 * checked — shown with that date, so it can never pass for today's.
 *
 * Refresh: re-read the source pages and update `checked`. Evidence for every
 * quote is recorded in docs/product/snow/ALIVE.md §2.
 */
export interface Published<T> {
  readonly value: T;
  /** The resort's words, verbatim. */
  readonly quote: string;
  readonly source: string;
  /** `YYYY-MM-DD` — the day Passport read the source. */
  readonly checked: string;
}

export interface ResortFacts {
  readonly mountainId: string;
  readonly official: string;
  readonly links: {
    readonly conditions?: string;
    readonly lifts?: string;
    readonly tickets?: string;
    readonly events?: string;
    readonly dining?: string;
    readonly activities?: string;
    readonly hours?: string;
  };
  readonly season?: {
    readonly label: string;
    /** Alpine opening day, `YYYY-MM-DD`. */
    readonly opens: Published<string>;
    readonly closes?: Published<string>;
    /** Other openings the resort published (Nordic, tubing…). */
    readonly also?: readonly { label: string; date: Published<string> }[];
    /** The resort's own hedge ("Tentative", "snow permitting"). */
    readonly caveat: string;
  };
  /** Lift hours for the opening part of the season, when published. */
  readonly liftHours?: Published<{ from: string; to: string; until?: string }>;
  /** What the resort's own status said on `checked` — not live. */
  readonly statusWhenChecked?: Published<string>;
  /**
   * Places the resort lists on its own site. Shown only to name what Atlas
   * is missing (the acquisition request) and as the resort's own list —
   * never as Atlas places, never with hours or menus.
   */
  readonly listsOnSite?: {
    readonly dining: readonly string[];
    /** The resort's name for it, and the Atlas place it happens at if any. */
    readonly activities: readonly { name: string; atlasPlace?: string }[];
    readonly source: { dining: string; activities: string };
    readonly checked: string;
  };
  /** Within this many km of the resort's point counts as on the mountain. */
  readonly onMountainKm: number;
}

const SS = "https://www.skisilverstar.com";

export const RESORTS: readonly ResortFacts[] = [
  {
    mountainId: "silverstar",
    official: SS,
    links: {
      hours: `${SS}/the-mountain/hours-of-operation/`,
      conditions: `${SS}/the-mountain/weather-conditions/snow-report-forecast/`,
      tickets: "https://shop.skisilverstar.com/s/lift-tickets",
      events: `${SS}/events-activities/all-events/`,
      dining: `${SS}/mountain-dining-shopping/restaurants-cafes/`,
      activities: `${SS}/events-activities/winter-activities/`,
    },
    season: {
      label: "Winter 2026/27",
      opens: {
        value: "2026-11-27",
        quote: "Alpine Opening Day: November 27, 2026",
        source: `${SS}/the-mountain/hours-of-operation/`,
        checked: "2026-11-08",
      },
      closes: {
        value: "2027-04-04",
        quote: "Alpine Closing Day: April 4, 2027",
        source: `${SS}/the-mountain/hours-of-operation/`,
        checked: "2026-11-08",
      },
      also: [
        {
          label: "Nordic opening day",
          date: {
            value: "2026-11-20",
            quote: "Nordic Opening Day: November 20, 2026",
            source: `${SS}/the-mountain/hours-of-operation/`,
            checked: "2026-11-08",
          },
        },
      ],
      caveat:
        "SilverStar calls these “Tentative Winter 2026/27 Operation Dates”.",
    },
    liftHours: {
      value: { from: "09:00", to: "16:00", until: "2027-01-31" },
      quote: "Opening Day to January 31: 9:00am - 4:00pm",
      source: `${SS}/the-mountain/hours-of-operation/`,
      checked: "2026-11-08",
    },
    statusWhenChecked: {
      value: "Currently Closed",
      quote:
        "Currently Closed. We are currently preparing for the winter season! See our tentative opening dates below.",
      source: `${SS}/the-mountain/hours-of-operation/`,
      checked: "2026-11-08",
    },
    listsOnSite: {
      dining: [
        "The Red Antler",
        "Paradise Camp",
        "The Den",
        "d'argento",
        "Town Hall",
        "Tube Town Café & Bar",
        "Bear Bites Food Truck",
        "La Plata",
        "Bugaboos Bakery Café",
        "Black Pine",
        "Pizza Gratta",
        "Francuccino's Gelato and Frank's Fries",
        "The Bulldog Grand Cafe",
        "Long John's Pub",
      ],
      activities: [
        {
          name: "Cross Country Skiing",
          atlasPlace: "Sovereign Lake Nordic Centre",
        },
        { name: "Ice Skating", atlasPlace: "Brewer's Pond" },
        { name: "Winter Tubing", atlasPlace: "Tube Town" },
        { name: "Snowshoeing" },
        { name: "Fat Biking" },
        { name: "Night Skiing" },
        { name: "Elevate Spa" },
        { name: "Guided Mountain Tours" },
        { name: "Mini Snowmobiles" },
        { name: "Snowmobile Tours" },
        { name: "Paradise Camp Dinner Tours" },
        { name: "Ravenwood Snowshoe Dinner Tours" },
        { name: "Bear Byway Scavenger Hunt" },
        { name: "Yoga" },
      ],
      source: {
        dining: `${SS}/mountain-dining-shopping/restaurants-cafes/`,
        activities: `${SS}/events-activities/winter-activities/`,
      },
      checked: "2026-11-08",
    },
    onMountainKm: 4,
  },
  {
    mountainId: "big-white",
    official: "https://www.bigwhite.com",
    links: {
      hours:
        "https://www.bigwhite.com/explore/mountain-info/winter-hours-operation",
      conditions:
        "https://www.bigwhite.com/mountain-conditions/daily-snow-report",
      tickets: "https://www.bigwhite.com/tickets-passes/lift-tickets",
      events:
        "https://www.bigwhite.com/events-activities/event/events-calendar",
    },
    season: {
      label: "Winter 2026/27",
      opens: {
        value: "2026-11-26",
        quote: "OPENING DAY THURS, NOVEMBER 26, 2026",
        source:
          "https://www.bigwhite.com/explore/mountain-info/winter-hours-operation",
        checked: "2026-11-08",
      },
      closes: {
        value: "2027-04-04",
        quote: "CLOSING DAY SUN, APRIL 4, 2027",
        source:
          "https://www.bigwhite.com/explore/mountain-info/winter-hours-operation",
        checked: "2026-11-08",
      },
      caveat: "Big White says “Opening is snow permitting”.",
    },
    onMountainKm: 4,
  },
  {
    mountainId: "sun-peaks",
    official: "https://www.sunpeaksresort.com",
    links: {
      hours:
        "https://www.sunpeaksresort.com/ski-ride/the-mountain/winter-hours-of-operation",
      lifts:
        "https://www.sunpeaksresort.com/ski-ride/weather-conditions-cams/lifts-trail-status",
      conditions:
        "https://www.sunpeaksresort.com/ski-ride/weather-conditions-cams/weather-snow-report",
      tickets:
        "https://www.sunpeaksresort.com/ski-ride/tickets-passes/day-tickets",
      events: "https://www.sunpeaksresort.com/events-things-to-do/events",
    },
    season: {
      label: "Winter 2026/27",
      opens: {
        value: "2026-11-21",
        quote:
          "Our 65th operating season is scheduled to begin on Saturday, November 21, 2026.",
        source:
          "https://www.sunpeaksresort.com/events-things-to-do/events/winter-opening-day",
        checked: "2026-11-08",
      },
      closes: {
        value: "2027-04-04",
        quote: "Operating Season / November 21, 2026 to April 4, 2027",
        source:
          "https://www.sunpeaksresort.com/ski-ride/the-mountain/winter-hours-of-operation",
        checked: "2026-11-08",
      },
      caveat:
        "Sun Peaks says the dates may change with weather and conditions.",
    },
    onMountainKm: 4,
  },
];

export function resortFacts(mountainId: string | undefined) {
  return RESORTS.find((r) => r.mountainId === mountainId);
}

const DAY = 86_400_000;
const utc = (ymd: string) => Date.parse(`${ymd}T12:00:00Z`);
export const addDays = (ymd: string, n: number) =>
  new Date(utc(ymd) + n * DAY).toISOString().slice(0, 10);
/** 0 = Sunday … 6 = Saturday, for a calendar date (no time zone). */
export const weekday = (ymd: string) => new Date(utc(ymd)).getUTCDay();

/** "checked today" / "checked 3 days ago" — how old a published fact is. */
export function checkedWords(checked: string, today: string): string {
  const n = Math.round((utc(today) - utc(checked)) / DAY);
  if (n <= 0) return "checked today";
  if (n === 1) return "checked yesterday";
  return `checked ${n} days ago`;
}

/** A published fact older than this should be read again before trusting. */
export const STALE_AFTER_DAYS = 14;
export const isStaleFact = (checked: string, today: string) =>
  (utc(today) - utc(checked)) / DAY > STALE_AFTER_DAYS;

export interface DateChoice {
  readonly key: "opening" | "this-weekend" | "next-weekend";
  readonly label: string;
  readonly date: string;
  /** Why this date — a published fact for opening weekend. */
  readonly because?: string;
  readonly source?: string;
}

/**
 * **The dates a crew usually means.** This weekend and next weekend from
 * the calendar; opening weekend only when the resort has published an
 * opening day that is still ahead (or is today). Opening weekend is the
 * first Saturday on or after opening day — or opening day itself when the
 * resort opens on a Saturday or Sunday.
 */
export function dateChoices(
  today: string,
  facts: ResortFacts | undefined,
): DateChoice[] {
  const out: DateChoice[] = [];
  const opens = facts?.season?.opens;
  if (opens && opens.value >= today) {
    const wd = weekday(opens.value);
    const date =
      wd === 6 || wd === 0 ? opens.value : addDays(opens.value, 6 - wd);
    out.push({
      key: "opening",
      label: "Opening weekend",
      date,
      because: `${opens.quote} (${facts!.season!.caveat.replace(/\.$/, "")})`,
      source: opens.source,
    });
  }
  const wd = weekday(today);
  const thisSat = wd === 0 ? today : addDays(today, 6 - wd);
  out.push({ key: "this-weekend", label: "This weekend", date: thisSat });
  out.push({
    key: "next-weekend",
    label: "Next weekend",
    date: wd === 0 ? addDays(today, 6) : addDays(thisSat, 7),
  });
  return out;
}

/**
 * Whether the resort's published season covers a date: `open` inside it,
 * `before` / `after` outside it, `unknown` when nothing is published.
 * A plan, not a forecast: the resort's caveat always travels with it.
 */
export function seasonOn(
  facts: ResortFacts | undefined,
  date: string,
): "open" | "before" | "after" | "unknown" {
  const s = facts?.season;
  if (!s) return "unknown";
  if (date < s.opens.value) return "before";
  if (s.closes && date > s.closes.value) return "after";
  return "open";
}

/** The lift hours that apply on a date, when the resort published them. */
export function liftHoursOn(facts: ResortFacts | undefined, date?: string) {
  const h = facts?.liftHours;
  if (!h) return undefined;
  // "Opening Day to January 31": nothing before opening day.
  if (date && facts?.season && date < facts.season.opens.value)
    return undefined;
  if (date && h.value.until && date > h.value.until) return undefined;
  return h;
}
