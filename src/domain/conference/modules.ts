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
    id: "discover",
    label: "Free time",
    promise:
      "Something great to do between sessions, from right where you are.",
    workstream: "passport-discovery",
    status: "built",
  },
  {
    id: "arrivals",
    label: "Arrivals",
    promise: "Who's on the way, when they land, and your own countdown.",
    workstream: "passport-flights",
    status: "proposed",
    prototype: "/sycle arrival board (untracked in the main checkout)",
  },
  {
    id: "schedule",
    label: "Schedule",
    promise: "What's on, and the thing everyone's talking about.",
    workstream: "passport-events",
    status: "proposed",
    prototype: "lane/boards gathering: the hockey game, awaiting confirmation",
  },
  {
    id: "community",
    label: "Community",
    promise: "Ask the group. Where's good for dinner? Who's going tonight?",
    workstream: "passport-social",
    status: "proposed",
  },
  {
    id: "plans",
    label: "Plans",
    promise: "“I'm going there at 7. Anyone coming?”",
    workstream: "passport-groups",
    status: "proposed",
    prototype: "lane/boards interest marks",
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
