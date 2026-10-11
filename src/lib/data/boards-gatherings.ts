import type { Experience } from "@/domain/experience/types";
import { ZONE } from "@/domain/experience/eventTime";

/**
 * **A gathering: a shared board with a reason to exist.**
 *
 * Sycle staff are meeting in Vancouver for a conference, and there is a staff
 * hockey game that goes with the trip. This is the declaration of that — and
 * deliberately nothing more than a declaration.
 *
 * ## Not a second activities system
 *
 * A gathering is a **Board** (Atlas holds it, Passport shares it through the
 * same invite links every board uses) plus the handful of things an organiser
 * knows that Atlas does not, like a private staff game. Its colleagues are the
 * board's members. Its informal adventures are the board's items, saved from
 * Discovery like any other. "I'm interested" is a mark on a board item, which
 * any board could carry. Nothing here holds people, places or attendance.
 *
 * ## Absent means awaiting confirmation
 *
 * A staff activity is a slice of `Experience`, with the same rule `Experience`
 * already states: **absent means nobody knows.** No date, no clock time, no
 * venue and no participation detail has been confirmed for the hockey game,
 * so none is written here, and the board says *Awaiting confirmation* rather
 * than a plausible-looking guess. When an organiser confirms one, it goes
 * here, with `confirmedBy` saying who — and only then.
 *
 * ## Which board
 *
 * Board ids belong to whichever Atlas the deployment talks to, so the id is
 * read from the environment (`boardEnv`) rather than written here. Unset means
 * the organiser has not opened a staff board yet, and the gathering says that.
 */

/** What an organiser has confirmed about how to take part. */
export interface Participation {
  /** In the organiser's words: who can play, what to bring, spectators… */
  readonly details: string;
}

/**
 * One thing staff can do together that Atlas does not hold — a private game,
 * a team dinner. Same field names and meanings as `Experience`, so the day it
 * becomes an Atlas subject nothing has to be translated.
 */
export type StaffActivity = Pick<
  Experience,
  "id" | "title" | "shortDescription"
> &
  Partial<
    Pick<Experience, "startTime" | "endTime" | "timePrecision" | "venue">
  > & {
    readonly participation?: Participation;
    /** Who confirmed what is stated here. Required before any fact is shown as confirmed. */
    readonly confirmedBy?: string;
  };

export interface Gathering {
  readonly slug: string;
  readonly title: string;
  /** Who it is for, as the group calls itself. */
  readonly forWhom: string;
  readonly what: string;
  /** A `DiscoveryTown` id, so Discovery and Go Have A Day start from here. */
  readonly townId: string;
  readonly cityName: string;
  /** Conference days, `YYYY-MM-DD`. Absent until confirmed. */
  readonly days?: { readonly from: string; readonly to: string };
  readonly featured: StaffActivity;
  /** Further organiser-confirmed activities. Empty is a true answer. */
  readonly activities: readonly StaffActivity[];
  /** The environment variable holding this gathering's board id. */
  readonly boardEnv: string;
}

export const GATHERINGS: readonly Gathering[] = [
  {
    slug: "sycle-vancouver-2026",
    title: "Sycle in Vancouver",
    forWhom: "Sycle staff",
    what: "Conference activities, the staff hockey game, and whatever else we get up to.",
    townId: "vancouver",
    cityName: "Vancouver",
    featured: {
      id: "sycle-vancouver-2026:staff-hockey",
      title: "Staff hockey game",
      shortDescription:
        "The Sycle staff hockey game that goes with the Vancouver trip.",
      // Date, time, venue and how to take part: none confirmed. Do not fill
      // these in from a guess — see the module comment.
    },
    activities: [],
    boardEnv: "PASSPORT_BOARD_SYCLE_VANCOUVER_2026",
  },
];

export function gatheringBySlug(slug: string): Gathering | undefined {
  return GATHERINGS.find((g) => g.slug === slug);
}

type Env = Readonly<Record<string, string | undefined>>;

export function gatheringBoardId(
  gathering: Gathering,
  env: Env = process.env,
): string | undefined {
  const id = env[gathering.boardEnv]?.trim();
  return id ? id : undefined;
}

/** The gathering a board belongs to, if it is one. */
export function gatheringForBoard(
  boardId: string,
  env: Env = process.env,
): Gathering | undefined {
  return GATHERINGS.find((g) => gatheringBoardId(g, env) === boardId);
}

/** Every activity an organiser declared, featured first. */
export function staffActivities(
  gathering: Gathering,
): readonly StaffActivity[] {
  return [gathering.featured, ...gathering.activities];
}

/**
 * A fact about an activity, or the honest absence of one.
 *
 * `value` is only ever present when the activity says who confirmed it — a
 * detail with no source is shown as awaiting, not as known.
 */
export interface ActivityFact {
  readonly label: "Date" | "Time" | "Venue" | "Taking part";
  readonly value?: string;
}

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const validDate = (iso: string | undefined): Date | undefined => {
  if (!iso) return undefined;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * A date-only start is stored at UTC midnight (see `Experience.timePrecision`),
 * so it is read as a calendar date, never moved into the previous evening.
 */
function dateOf(activity: StaffActivity): string | undefined {
  const start = validDate(activity.startTime);
  if (!start) return undefined;
  if (activity.timePrecision === "day") {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(start);
  }
  return dayFormat.format(start);
}

function timeOf(activity: StaffActivity): string | undefined {
  // Only a stated clock time is a time. `undefined` precision is "Atlas does
  // not know", which is not permission to print midnight.
  if (activity.timePrecision !== "minute") return undefined;
  const start = validDate(activity.startTime);
  if (!start) return undefined;
  const end = validDate(activity.endTime);
  return end
    ? `${timeFormat.format(start)} – ${timeFormat.format(end)}`
    : timeFormat.format(start);
}

function venueOf(activity: StaffActivity): string | undefined {
  const { venue } = activity;
  if (!venue?.name) return undefined;
  return venue.locality ? `${venue.name}, ${venue.locality}` : venue.name;
}

export function activityFacts(
  activity: StaffActivity,
): readonly ActivityFact[] {
  const sourced = Boolean(activity.confirmedBy?.trim());
  const fact = (
    label: ActivityFact["label"],
    value: string | undefined,
  ): ActivityFact => (sourced && value ? { label, value } : { label });

  return [
    fact("Date", dateOf(activity)),
    fact("Time", timeOf(activity)),
    fact("Venue", venueOf(activity)),
    fact("Taking part", activity.participation?.details.trim() || undefined),
  ];
}

/** The `YYYY-MM-DD` an activity happens on, once confirmed. */
export function confirmedDay(activity: StaffActivity): string | undefined {
  if (!activity.confirmedBy?.trim()) return undefined;
  const start = validDate(activity.startTime);
  if (!start) return undefined;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: activity.timePrecision === "day" ? "UTC" : ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);
}

/**
 * **Doors into Go Have A Day**, starting from the gathering's town.
 *
 * Each is a sentence somebody could have typed — the same seed the Go Offline
 * modes use — read by the same parser. Nothing here names a place: Go Have A
 * Day picks stops from Atlas, as it always does.
 */
export interface DayDoor {
  readonly title: string;
  readonly blurb: string;
  readonly href: string;
}

function goHref(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return `/go?${query.toString()}`;
}

export interface DayDoors {
  /** The game's own day — only once its date is confirmed. */
  readonly gameDay?: DayDoor;
  readonly free: readonly DayDoor[];
}

export function dayDoors(gathering: Gathering): DayDoors {
  const at = gathering.townId;
  const free: DayDoor[] = [
    {
      title: "Two hours between sessions",
      blurb: "Out, back, and nobody noticed you left.",
      href: goHref({ at, say: "two hours, close by" }),
    },
    {
      title: "Meet humans",
      blurb: "Somewhere with coffee, food and colleagues talking.",
      href: goHref({ at, mode: "meet-humans" }),
    },
    {
      title: "A whole free day",
      blurb: "Leave in the morning. Come back with a story.",
      href: goHref({ at, mode: "whole-day" }),
    },
  ];

  const on = confirmedDay(gathering.featured);
  return on
    ? {
        gameDay: {
          title: "Build game day",
          blurb: `The rest of the day around the ${gathering.featured.title.toLowerCase()}.`,
          href: goHref({ at, on, say: "four hours, food, close by" }),
        },
        free,
      }
    : { free };
}
