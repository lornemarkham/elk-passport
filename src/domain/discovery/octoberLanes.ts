import type { Experience } from "@/domain/experience/types";
import type { Shelf } from "./inspirationShelves";

/**
 * **The part of the world October cares about, composed from what Atlas states.**
 *
 * ## The rule that makes this honest
 *
 * A Thing joins a lane because of **what Atlas says it is** — its `kind`, its
 * `subtype` in the publisher's own word, and for an Event its dates. Never
 * because of a word in its description. A winery whose blurb mentions a
 * Halloween party is still a winery here; a haunted house is a haunted house
 * because its subtype says so. This is stricter than `inspirationShelves`,
 * which matches prose, and it is stricter on purpose: an October lane that
 * gathers Things by accidental keyword is worse than no lane at all.
 *
 * ## What the corpus supports, measured 2026-09-22
 *
 * Lanes that exist here exist because the corpus could populate them from
 * subtypes alone. Lanes that were proposed and are absent — Kids & Family,
 * Date Night, Parties / Nightlife, Trick-or-Treat, At Home, Make / Carve —
 * are absent because Atlas holds no honest signal for them. Games was
 * composable (escape rooms, bowling) and dropped anyway: seven of its twelve
 * were bowling alleys, which is a list, not a lane. That absence is
 * an Atlas demand signal and is reported, not papered over.
 *
 * ## Region scope
 *
 * This composes from everything Passport holds, not from the region-scoped
 * pool the list uses. Under that scope the October lanes are empty — Scares
 * 0, Games 0, October events 1 — because Atlas has asserted membership for
 * 314 of 2,314 entities. The corpus is Okanagan by construction; the scope is
 * incomplete, not wrong. Each card still says where its Thing is, when Atlas
 * knows.
 */

const OCTOBER_2026 = {
  start: new Date("2026-10-01T00:00:00Z"),
  end: new Date("2026-11-01T00:00:00Z"),
};

const subtype = (e: Experience): string =>
  (e.subtype ?? "").toLowerCase().trim();

/** Subtypes that describe how an organisation runs, not somewhere to go. */
const NOT_A_THING_TO_DO = /^(hiring event|job fair|recruitment)/;

const LANE_RULES: readonly {
  id: string;
  title: string;
  blurb: string;
  matches: (e: Experience) => boolean;
  minimum: number;
}[] = [
  {
    id: "scares",
    title: "Scares",
    blurb: "The haunted, the guided-after-dark, and the mazes.",
    matches: (e) =>
      e.kind !== "Event" &&
      /haunt|ghost tour|scare|corn maze|maze|fright/.test(subtype(e)),
    minimum: 1,
  },
  {
    id: "farms",
    title: "Farms & markets",
    blurb: "Pumpkins, orchards, U-picks and the markets they feed.",
    matches: (e) =>
      e.kind !== "Event" &&
      /^(farm|orchard|pumpkin|corn maze|u-pick|cider and farm)|farm (market|stand)|farmers'? market|^market$/.test(
        subtype(e),
      ),
    minimum: 3,
  },
  {
    id: "cider",
    title: "Cider & wine",
    blurb: "Harvest is over. This is what it was for.",
    matches: (e) =>
      e.kind !== "Event" && /winery|cidery|distiller|meadery/.test(subtype(e)),
    minimum: 3,
  },
  {
    id: "theatre",
    title: "Theatre & screens",
    blurb: "A dark room and somebody else's story.",
    matches: (e) =>
      e.kind !== "Event" &&
      /theat|cinema|drive-in|playhouse|performing arts/.test(subtype(e)),
    minimum: 3,
  },
  {
    id: "stories",
    title: "Stories & history",
    blurb: "The places that keep what happened here.",
    matches: (e) =>
      e.kind !== "Event" && /museum|heritage|historic/.test(subtype(e)),
    minimum: 3,
  },
  {
    id: "outdoors",
    title: "Trails & lookouts",
    blurb: "The valley in its last good colour.",
    matches: (e) =>
      e.kind !== "Event" &&
      // Not bare "park": that subtype covers every municipal green and a tot
      // lot, and a tot lot is not the valley in its last good colour.
      /^(trail|hiking trail|hiking spot|lookout|viewpoint|mountain|mountain range|forest|nature centre|regional park|provincial park)$/.test(
        subtype(e),
      ),
    minimum: 3,
  },
];

const inWindow = (e: Experience, from: Date, to: Date): boolean => {
  if (!e.startTime) return false;
  const start = new Date(e.startTime);
  const end = new Date(e.endTime ?? e.startTime);
  return end >= from && start < to;
};

/**
 * Events on in October 2026 that have not yet ended. `now` decides "ended";
 * an event whose last day has passed is never promoted as something to do,
 * whatever month it was in.
 */
export function happeningInOctober(
  experiences: readonly Experience[],
  now: Date,
): Experience[] {
  return experiences
    .filter(
      (e) =>
        e.kind === "Event" &&
        !NOT_A_THING_TO_DO.test(subtype(e)) &&
        inWindow(e, OCTOBER_2026.start, OCTOBER_2026.end) &&
        new Date(e.endTime ?? e.startTime!) >= now,
    )
    .sort((a, b) => a.startTime!.localeCompare(b.startTime!));
}

/**
 * Halloween events Atlas knows from **last** October, shown as last October.
 *
 * The corpus holds thirteen 2025 haunts and zero for 2026 as of this writing.
 * Hiding them would hide the most October knowledge Atlas has; promoting them
 * as upcoming would be a lie. So they are their own lane, named for what they
 * are, with their dates shown — and the lane itself is the demand signal: this
 * is what Atlas needs this year's dates for.
 *
 * Membership is by subtype and by Halloween-shaped event subtype only.
 */
export function lastOctober(experiences: readonly Experience[]): Experience[] {
  return experiences
    .filter(
      (e) =>
        e.kind === "Event" &&
        inWindow(
          e,
          new Date("2025-09-15T00:00:00Z"),
          new Date("2025-11-03T00:00:00Z"),
        ) &&
        /haunt|scare|pumpkin|corn maze|maze|hallow|fall event|spook|fright/.test(
          subtype(e),
        ),
    )
    .sort((a, b) => a.startTime!.localeCompare(b.startTime!));
}

export interface OctoberLane extends Shelf {
  /** Events from a previous year, presented as such. */
  readonly lastYear?: boolean;
}

const SHELF_SIZE = 12;

const pictureFirst = (list: readonly Experience[]): Experience[] =>
  [...list].sort(
    (a, b) => Number(Boolean(b.heroMedia)) - Number(Boolean(a.heroMedia)),
  );

/**
 * Compose the October lanes. Deterministic for a given `experiences` and
 * `now`. A Thing joins at most one non-event lane, first claim wins, so a
 * cidery that is also a farm market is not in two places. Lanes under their
 * minimum are omitted, not shown thin.
 */
export function octoberLanes(
  experiences: readonly Experience[],
  now: Date = new Date(),
): OctoberLane[] {
  const lanes: OctoberLane[] = [];
  const claimed = new Set<string>();

  const upcoming = happeningInOctober(experiences, now);
  if (upcoming.length > 0) {
    lanes.push({
      id: "happening",
      title: "Happening in October",
      blurb: "Dated and real. Nothing here has already ended.",
      experiences: upcoming.slice(0, SHELF_SIZE),
    });
  }

  for (const rule of LANE_RULES) {
    const members = pictureFirst(
      experiences.filter((e) => !claimed.has(e.id) && rule.matches(e)),
    ).slice(0, SHELF_SIZE);
    if (members.length < rule.minimum) continue;
    for (const m of members) claimed.add(m.id);
    lanes.push({
      id: rule.id,
      title: rule.title,
      blurb: rule.blurb,
      experiences: members,
    });

    // Last October's haunts sit directly under Scares, where they belong.
    if (rule.id === "scares") {
      const last = lastOctober(experiences);
      if (last.length > 0) {
        lanes.push({
          id: "last-october",
          title: "Last October",
          blurb: "What ran last year. Atlas hasn't seen this year's dates yet.",
          experiences: last.slice(0, SHELF_SIZE),
          lastYear: true,
        });
      }
    }
  }

  return lanes;
}
