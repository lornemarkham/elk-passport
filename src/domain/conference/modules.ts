import { townIn } from "@/domain/day/intent";
import { townById } from "@/domain/discovery/towns";
import type { ConferenceDetails, ModuleId } from "./types";

/**
 * **The parts of a conference, and which of them exist.**
 *
 * A module is a workstream's page under `/conferences/{id}/{module}`. The
 * foundation renders a placeholder route for every id, and a module goes
 * live by adding its own static route folder, which Next prefers to the
 * placeholder — then flipping `status` here to `built`.
 *
 * `status` is not decoration: an organiser can switch a proposed module on to
 * preview it, and its page then says plainly that it is not built. Nothing
 * pretends to work.
 */
export interface ConferenceModule {
  readonly id: ModuleId;
  readonly label: string;
  /** One line, as a participant would read it. */
  readonly promise: string;
  /** The workstream that owns it. */
  readonly workstream: string;
  readonly status: "built" | "proposed";
  /** What exists elsewhere that this module should start from. */
  readonly prototype?: string;
}

export const MODULES: readonly ConferenceModule[] = [
  {
    id: "plans",
    label: "Plans",
    promise: "Morning walks, lunch, dinner, drinks. Make one or join one.",
    workstream: "passport-groups",
    status: "built",
  },
  {
    id: "arrivals",
    label: "Arrivals",
    promise: "Who's in the air, on a live map, until they land.",
    workstream: "passport-flights",
    status: "built",
    prototype: "/sycle arrival board (branch sycle-prototype)",
  },
  {
    id: "community",
    label: "Chat",
    promise: "The group's conversation, and a thread for every plan.",
    workstream: "passport-social",
    status: "built",
  },
  {
    id: "people",
    label: "Find my people",
    promise: "Share where you are for a while. Stop whenever you like.",
    workstream: "passport-social",
    status: "built",
  },
  {
    id: "discover",
    label: "Explore",
    promise: "Real places near the venue, ready to turn into a plan.",
    workstream: "passport-discovery",
    status: "built",
  },
  {
    id: "memories",
    label: "Memories",
    promise: "The group's photos, kept together.",
    workstream: "passport-social",
    status: "built",
  },
  {
    id: "schedule",
    label: "Agenda",
    promise: "What's on today, what's next, and where to be.",
    workstream: "passport-events",
    status: "built",
  },
];

export const moduleById = (id: string): ConferenceModule | undefined =>
  MODULES.find((m) => m.id === id);

/** The modules a conference shows, in its own order. */
export const enabledModules = (
  details: Pick<ConferenceDetails, "modules">,
): readonly ConferenceModule[] =>
  details.modules
    .map((id) => moduleById(id))
    .filter((m): m is ConferenceModule => m !== undefined);

export interface Door {
  readonly title: string;
  readonly blurb: string;
  readonly href: string;
}

/**
 * **Doors into Go Have A Day from the conference's town** — the `discover`
 * module's whole first version, and the baseline vision principle 4 asks
 * for: it works with Discovery as it is today and gets better as `/go` does.
 *
 * Each is a sentence somebody could have typed, read by `/go`'s own parser.
 * Nothing here names a place. A conference whose place Passport cannot
 * locate gets no doors rather than doors that start somewhere else.
 */
export function doorsFor(details: Pick<ConferenceDetails, "place">): Door[] {
  const town = townById(details.place.townId);
  if (!town) return [];
  const go = (params: Record<string, string>) =>
    `/go?${new URLSearchParams({ at: town.id, ...params })}`;
  return [
    {
      title: "Two hours between sessions",
      blurb: "Out, back, and nobody noticed you left.",
      href: go({ say: "two hours, close by" }),
    },
    {
      title: "Meet humans",
      blurb: "Somewhere with coffee, food and people talking.",
      href: go({ mode: "meet-humans" }),
    },
    {
      title: "A whole free day",
      blurb: "Leave in the morning. Come back with a story.",
      href: go({ mode: "whole-day" }),
    },
  ];
}

/**
 * **Where Discovery should measure from for this conference** — the venue,
 * where Passport knows it by name ("JW Marriott Parq"), else the
 * conference's town. Never geocoded from the organiser's words: a venue
 * Passport doesn't know falls back to the town, and a town it doesn't know
 * gives nothing.
 */
export function discoveryOriginFor(
  details: Pick<ConferenceDetails, "place"> &
    Partial<Pick<ConferenceDetails, "venue">>,
): string | undefined {
  const town = townById(details.place.townId);
  if (!town) return undefined;
  const venue = details.venue?.name ? townIn(details.venue.name) : undefined;
  return venue && venue.area === town.area ? venue.id : town.id;
}

/**
 * **Questions to ask Go Have A Day from the venue** (Vancouver launch,
 * 2026-10-24): the moments a conference actually has free — a break, the
 * evening, the group. Each is a sentence handed to Discovery's own reader,
 * measured from the venue; nothing here names a place.
 */
export function askDoorsFor(
  details: Pick<ConferenceDetails, "place"> &
    Partial<Pick<ConferenceDetails, "venue">>,
): Door[] {
  const at = discoveryOriginFor(details);
  if (!at) return [];
  const ask = (say: string) =>
    `/discovery?${new URLSearchParams({ at, ask: say })}`;
  return [
    {
      title: "Explore near the venue",
      blurb: "What's good a few blocks away.",
      href: ask("What's good near the venue?"),
    },
    {
      title: "Coffee on your break",
      blurb: "Within a ten-minute walk, there and back in time.",
      href: ask("Coffee within a 10-minute walk"),
    },
    {
      title: "After the sessions",
      blurb: "Something fun for the evening, close by.",
      href: ask("Something fun after the sessions, within walking distance"),
    },
    {
      title: "Where should our group go tonight?",
      blurb: "Somewhere a table of colleagues can go together.",
      href: ask("Where can our group go tonight?"),
    },
  ];
}
