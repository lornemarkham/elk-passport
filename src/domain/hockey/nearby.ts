import { normaliseSubtype } from "@/domain/discovery/defaultFeed";
import { intentByKey } from "@/domain/discovery/intents";
import { distanceKm } from "@/lib/environment/geo";
import type { DiscoveryCandidate } from "@/lib/data/types";
import {
  curatedNear,
  sameName,
  walkLabel,
  walkMinutesFor,
  type CuratedPlace,
} from "@/domain/collections/places";

/**
 * **Somewhere to argue about before the game.**
 *
 * The lab's README named this as the single highest-value Atlas request: "three
 * to five real places near the anchor, with a walking time, one honest
 * sentence, and enough for someone to have an opinion" — and was precise that
 * it is *not* a ranked recommendation. It is a set of options that will start
 * an argument. Passport offers; the group chooses, by the vote the lab already
 * built.
 *
 * The candidates are Discovery's own (`discoveryCandidates()`), "food" means
 * exactly what Discovery's **Eat & drink** intent means (`intents.ts`), and
 * distance comes from Atlas where it measured one and otherwise from the
 * place's own observed coordinates. Where Atlas has nothing — an outage, or a
 * place it has not ingested — the shared downtown Vancouver list
 * (`collections/vancouver.ts`) fills in, and says so (`source: "curated"`).
 * An Atlas record always wins over the curated entry for the same place.
 *
 * ## What the distance is, said every time
 *
 * There is no routing anywhere in Passport — no walking network, no transit,
 * nothing that knows Rogers Arena has a parking structure in the way. So every
 * figure is a **straight line**, and the walking time is a straight line at an
 * ordinary walking pace, which a real walk can only be longer than. The label
 * says both. A place whose position Atlas only *derived* (a town centre, a
 * venue it is "at") is not measured at all: "0.4 km" from a town centroid is
 * a fiction with a decimal point.
 */

export interface NearbyPlace {
  /** The Atlas id, or a `curated:` id for a place from the curated list. */
  readonly atlasId: string;
  /** Atlas's kind, which decides which Passport page opens it. Atlas places only. */
  readonly kind?: DiscoveryCandidate["kind"];
  /** Absent on options nominated before the curated list existed: Atlas. */
  readonly source?: "atlas" | "curated";
  readonly address?: string;
  readonly name: string;
  readonly subtype?: string;
  readonly blurb?: string;
  readonly heroUrl?: string;
  /** A photograph Passport may show as this place, and whose it is. */
  readonly image?: NearbyImage;
  /** What Atlas says about game day, where it said anything. */
  readonly gameDay?: GameDayHours;
  /** One or two things Atlas holds that matter to a group before a game. */
  readonly facts?: readonly string[];
  readonly km: number;
  /** Straight-line kilometres at 5 km/h. A floor, never a promise. */
  readonly walkMinutes: number;
  readonly basis: "straight-line";
}

/**
 * **A picture of the place, or no picture.**
 *
 * Passport's own rule (`PossibilityCard`, Atlas ADR 106): the strict
 * `heroUrl` first; then Atlas's labelled `presentationImage` where it is the
 * place itself, its venue, or the business's own site — each said on the
 * picture. A *category* or *representative* photograph is a stand-in for the
 * kind of thing ("Illustrative restaurant photo … Not a photo of Tokyo In
 * April" is a resort dining room in Laos), and on a ballot where people choose
 * between real places it would read as this place. So it is not offered here:
 * that card gets the designed no-photo treatment instead.
 */
export interface NearbyImage {
  readonly url: string;
  readonly relationship: "exact" | "venue" | "organization";
  /** Printed on the picture when it is not plainly the place itself. */
  readonly label?: string;
  /** Atlas's sentence about where the picture came from. */
  readonly attribution?: string;
}

/**
 * **Game day, in Atlas's words.**
 *
 * `reading` is Atlas's own verdict for the date (`?on=`, `schedule.onDate`):
 * whether stated hours, a season or a held interval cover it. `said` is the
 * stated hours Atlas tagged as covering that weekday, quoted — never parsed
 * into times, never tidied, because "WEDNESSDAY TO SUNDAY : 11am-late" is what
 * the place published and a reformatted version would be Passport's claim.
 */
export interface GameDayHours {
  readonly reading?: "on" | "not-on";
  readonly said?: string;
}

/** The statement shape Atlas sends under `schedule` (not yet in Passport's wire type). */
interface ScheduleStatement {
  readonly text: string;
  readonly scope?: string;
  readonly of?: string;
  readonly weekdays?: readonly string[];
}

const WEEKDAY_ABBR: Readonly<Record<string, string>> = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
};

/**
 * The stated hours covering `weekday` (`"sunday"`), quoted, or nothing.
 *
 * Only statements about the place itself — or the restaurant, kitchen or bar
 * part of it — and only those Atlas says cover that weekday. Brunch hours and
 * karaoke schedules are true and not what a group means by "is it open". A
 * list of days ("Monday: 11am - 11pm · … · Sunday: 9:30am - 11pm") is cut to
 * the segment that starts with the day; anything else is quoted whole after
 * its label, or not at all if it is too long to be a line on a card.
 */
export function statedHoursOn(
  statements: readonly ScheduleStatement[] | undefined,
  weekday: string,
): string | undefined {
  const day = weekday.toLowerCase();
  const abbr = WEEKDAY_ABBR[day];
  if (!abbr) return undefined;
  const covering = (statements ?? []).filter(
    (s) =>
      typeof s.text === "string" &&
      s.weekdays?.includes(day) &&
      (s.scope === "subject" ||
        (s.scope === "part" &&
          /restaurant|kitchen|dining|bar/i.test(s.of ?? ""))),
  );
  for (const statement of covering) {
    const body = statement.text.replace(/^[^:]*hours?[^:]*:\s*/i, "").trim();
    const segment = body
      .split(/\s*[·;,]\s*/)
      .find((part) => new RegExp(`^${abbr}[a-z]*\\b`, "i").test(part));
    if (segment && /\d|closed/i.test(segment)) return segment;
    if (body.length > 0 && body.length <= 70) return body;
  }
  return undefined;
}

/**
 * Things a group deciding where to eat before a game would want to know, if
 * Atlas holds them: happy hour, screens, trivia, a patio. Quoted as Atlas has
 * them, at most two, and nothing long enough to need a paragraph.
 */
const USEFUL_FACT =
  /happy hour|trivia|special|patio|live music|screens?|karaoke|game day|reservations?/i;

export function usefulFacts(
  practical: readonly { label: string; value: string }[] | undefined,
): string[] {
  return (practical ?? [])
    .filter(
      (p) =>
        USEFUL_FACT.test(p.label) &&
        // Opening hours are game-day's job, and quoted there; happy hour is not.
        !(/hours?$/i.test(p.label.trim()) && !/happy/i.test(p.label)) &&
        p.value.trim().length > 0 &&
        p.value.length <= 80,
    )
    .map((p) =>
      /^(available|yes)$/i.test(p.value.trim())
        ? p.label.trim()
        : `${p.label.trim()}: ${p.value.trim()}`,
    )
    .filter((fact, i, all) => all.indexOf(fact) === i)
    .slice(0, 2);
}

/** The picture a nearby card may carry, by Passport's own precedence. */
export function nearbyImage(
  candidate: DiscoveryCandidate,
): NearbyImage | undefined {
  if (candidate.heroUrl)
    return { url: candidate.heroUrl, relationship: "exact" };
  const offered = candidate.presentationImage;
  if (!offered) return undefined;
  switch (offered.relationship) {
    case "exact":
      return {
        url: offered.url,
        relationship: "exact",
        attribution: offered.attribution,
      };
    case "venue":
      return {
        url: offered.url,
        relationship: "venue",
        label: `Venue photo${offered.source?.heldBy ? ` · ${offered.source.heldBy.name}` : ""}`,
        attribution: offered.attribution,
      };
    case "organization":
      return {
        url: offered.url,
        relationship: "organization",
        label: `From ${offered.source?.heldBy?.name ?? offered.source?.host ?? "their own site"}`,
        attribution: offered.attribution,
      };
    default:
      return undefined;
  }
}

function gameDayOf(
  candidate: DiscoveryCandidate,
  weekday: string | undefined,
): GameDayHours | undefined {
  const reading = candidate.schedule?.onDate?.reading;
  const said = weekday
    ? statedHoursOn(
        (candidate.schedule as { statements?: ScheduleStatement[] } | undefined)
          ?.statements,
        weekday,
      )
    : undefined;
  const verdict =
    reading === "on" || reading === "not-on" ? reading : undefined;
  return verdict || said ? { reading: verdict, said } : undefined;
}

const EAT = new Set([...intentByKey("eat").subtypes].map(normaliseSubtype));

/** The words an option carries onto the vote, so the estimate travels with it. */
export { walkLabel };

function measured(
  candidate: DiscoveryCandidate,
  venue: readonly [number, number],
): number | undefined {
  const d = candidate.distance;
  if (d?.state === "measured" && d.basis === "coordinates") return d.km;
  const geo = candidate.geography;
  if (geo?.coordinates && geo.coordinatesBasis === "observed") {
    const [lng, lat] = geo.coordinates;
    return distanceKm(
      { latitude: venue[0], longitude: venue[1] },
      { latitude: lat, longitude: lng },
    );
  }
  return undefined;
}

export interface NearbyOptions {
  readonly withinKm?: number;
  readonly limit?: number;
  /** Game day's weekday in the venue's time zone, e.g. `"sunday"`. */
  readonly weekday?: string;
}

export function nearbyFood(
  candidates: readonly DiscoveryCandidate[],
  venue: readonly [number, number],
  { withinKm = 1.6, limit = 12, weekday }: NearbyOptions = {},
): NearbyPlace[] {
  const seen = new Set<string>();
  return candidates
    .filter((c) => EAT.has(normaliseSubtype(c.subtype)))
    .flatMap((c) => {
      const km = measured(c, venue);
      if (km === undefined || km > withinKm || seen.has(c.id)) return [];
      seen.add(c.id);
      const image = nearbyImage(c);
      const gameDay = gameDayOf(c, weekday);
      const facts = usefulFacts(c.knowledge?.practical);
      return [
        {
          atlasId: c.id,
          kind: c.kind,
          name: c.name,
          subtype: c.subtype,
          // Atlas says when its own sentence adds nothing; then say nothing.
          blurb:
            c.knowledge?.descriptionAddsKnowledge === false
              ? undefined
              : c.description?.split(/(?<=\.)\s/)[0]?.slice(0, 140),
          heroUrl: c.heroUrl,
          ...(image ? { image } : {}),
          ...(gameDay ? { gameDay } : {}),
          ...(facts.length ? { facts } : {}),
          km,
          walkMinutes: walkMinutesFor(km),
          basis: "straight-line" as const,
          source: "atlas" as const,
        },
      ];
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

/**
 * Atlas's food and drink near the venue, and the curated restaurants and bars
 * Atlas does not already hold, nearest first. Offered, not ranked.
 */
export function nearbyWithCurated(
  candidates: readonly DiscoveryCandidate[],
  curated: readonly CuratedPlace[],
  venue: readonly [number, number],
  { withinKm = 1.6, limit = 16, weekday }: NearbyOptions = {},
): NearbyPlace[] {
  const atlas = nearbyFood(candidates, venue, { withinKm, limit, weekday });
  const extra = curatedNear(curated, venue, {
    kinds: ["restaurant", "bar"],
    withinKm,
  })
    .filter(
      ({ place }) =>
        !atlas.some(
          (a) => a.atlasId === place.atlasId || sameName(a.name, place.name),
        ),
    )
    .map(({ place, km, walkMinutes }): NearbyPlace => ({
      atlasId: place.id,
      name: place.name,
      subtype: place.kind === "bar" ? "Bar" : "Restaurant",
      blurb: place.blurb,
      address: `${place.address}, ${place.neighbourhood}`,
      km,
      walkMinutes,
      basis: "straight-line",
      source: "curated",
    }));
  return [...atlas, ...extra].sort((a, b) => a.km - b.km).slice(0, limit);
}
