import { normaliseSubtype } from "@/domain/discovery/defaultFeed";
import { intentByKey } from "@/domain/discovery/intents";
import { distanceKm } from "@/lib/environment/geo";
import { notForPregame, sameVenue } from "./pregame";
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
  /**
   * [lat, lng] where the place was observed, for walking directions. Absent
   * when Atlas measured a distance but sent no observed point.
   */
  readonly at?: readonly [number, number];
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

/**
 * **Atlas holds some photograph URLs as `http://`.** Chambar's is one. A page
 * served over https will not show them (mixed content), so on production they
 * were blank while every local test — itself plain http — drew them. Asking
 * for the same address over https shows the picture where the host answers
 * there; where it does not, the card's own load-failure path falls back to the
 * designed no-photo treatment. Nothing is substituted.
 */
export function secureUrl(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}

/**
 * **A file name that says it is not a photograph.** Atlas's "exact" evidence
 * class means the picture belongs to the place's own page, and a place's own
 * page is full of its logo, its menu mock-up and its "back to top" arrow:
 * `VenturaLogo.png`, `Pizza-MenuMock-1.png`, `ArrowUp.png`. On a card that
 * sells a restaurant, those read as a broken photograph. Judged by the file's
 * own name only; the size check at load time (`photoUsable`) catches the rest.
 */
export function looksLikeNotAPhoto(url: string): boolean {
  let path = url;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    // Not a parseable URL: judge the text as it is.
  }
  return /logo|favicon|sprite|wordmark|placeholder|arrow|menumock|(^|[^a-z])icons?([^a-z]|$)/i.test(
    path,
  );
}

/**
 * **Is what loaded big and wide enough to be the picture on a card?**
 * Measured from the decoded image, so it is a fact about the file, not a
 * guess about the place: a 56 px arrow, a 300 × 100 banner or a 67 × 139 menu
 * strip is not a photograph of a restaurant, whatever its evidence class says.
 */
export function photoUsable(width: number, height: number): boolean {
  if (width < 400 || height < 240) return false;
  const ratio = width / height;
  return ratio >= 0.7 && ratio <= 2.6;
}

/** The picture a nearby card may carry, by Passport's own precedence. */
export function nearbyImage(
  candidate: DiscoveryCandidate,
): NearbyImage | undefined {
  const image = rawNearbyImage(candidate);
  if (!image || looksLikeNotAPhoto(image.url)) return undefined;
  return { ...image, url: secureUrl(image.url) };
}

function rawNearbyImage(
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

/** [lat, lng] where Atlas observed the place; never a derived point. */
function observedAt(
  candidate: DiscoveryCandidate,
): readonly [number, number] | undefined {
  const geo = candidate.geography;
  if (!geo?.coordinates || geo.coordinatesBasis !== "observed")
    return undefined;
  const [lng, lat] = geo.coordinates;
  return [lat, lng];
}

/**
 * **The venue itself, as Atlas holds it** — the same name, observed within
 * 300 m of where Passport places it. Its Atlas id is what lets Atlas route a
 * walk to it (Atlas routes between places it holds, by id). Not found means
 * no routed walk, not a guessed one.
 */
export function venueInAtlas(
  candidates: readonly DiscoveryCandidate[],
  name: string,
  venue: readonly [number, number],
): { atlasId: string; at: [number, number] } | undefined {
  for (const c of candidates) {
    if (!sameName(c.name, name)) continue;
    const at = observedAt(c);
    if (!at) continue;
    const km = distanceKm(
      { latitude: venue[0], longitude: venue[1] },
      { latitude: at[0], longitude: at[1] },
    );
    if (km <= 0.3) return { atlasId: c.id, at: [at[0], at[1]] };
  }
  return undefined;
}

export interface NearbyOptions {
  readonly withinKm?: number;
  readonly limit?: number;
  /** Game day's weekday in the venue's time zone, e.g. `"sunday"`. */
  readonly weekday?: string;
  /**
   * Fill the list with places that have a picture before places that do not,
   * nearest first within each. A card with a real photograph sells itself and
   * the others are a line of text, so the window is cut after that choice, not
   * before it. Places with no picture still follow if the window is not full.
   */
  readonly photographedFirst?: boolean;
}

export function nearbyFood(
  candidates: readonly DiscoveryCandidate[],
  venue: readonly [number, number],
  {
    withinKm = 1.6,
    limit = 12,
    weekday,
    photographedFirst = false,
  }: NearbyOptions = {},
): NearbyPlace[] {
  const seen = new Set<string>();
  const near = candidates
    .filter((c) => EAT.has(normaliseSubtype(c.subtype)))
    .flatMap((c) => {
      const km = measured(c, venue);
      if (km === undefined || km > withinKm || seen.has(c.id)) return [];
      seen.add(c.id);
      // Somewhere an ordinary group could eat before the game, or not at all.
      if (notForPregame(c)) return [];
      const image = nearbyImage(c);
      const at = observedAt(c);
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
          ...(at ? { at } : {}),
          km,
          walkMinutes: walkMinutesFor(km),
          basis: "straight-line" as const,
          source: "atlas" as const,
        },
      ];
    })
    .sort((a, b) => a.km - b.km);
  // One venue held under two names is one card — the one that has the picture.
  const venues = near.filter(
    (p, i) =>
      !near.some(
        (q, j) =>
          j !== i &&
          sameVenue(p, q) &&
          (q.image && !p.image ? true : !!q.image === !!p.image && j < i),
      ),
  );
  const window = photographedFirst
    ? [...venues.filter((p) => p.image), ...venues.filter((p) => !p.image)]
    : venues;
  return window.slice(0, limit).sort((a, b) => a.km - b.km);
}

/**
 * Atlas's food and drink near the venue, and the curated restaurants and bars
 * Atlas does not already hold, nearest first. Offered, not ranked.
 */
export function nearbyWithCurated(
  candidates: readonly DiscoveryCandidate[],
  curated: readonly CuratedPlace[],
  venue: readonly [number, number],
  {
    withinKm = 1.6,
    limit = 16,
    weekday,
    photographedFirst,
  }: NearbyOptions = {},
): NearbyPlace[] {
  const atlas = nearbyFood(candidates, venue, {
    withinKm,
    limit,
    weekday,
    photographedFirst,
  });
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
      at: place.at,
    }));
  return [...atlas, ...extra].sort(byPhotoThenWalk).slice(0, limit);
}

/**
 * **Places Passport can show lead; the rest follow, nearest first.** A card
 * with a real picture sells itself on a phone and a card without one is a
 * line of text, so a group choosing where to eat meets the places that look
 * like somewhere first. A JPEG is a photograph far more often than a PNG is
 * (a PNG is usually a logo or a graphic), so the two are tiered — a tiebreak
 * on a file extension, not a verdict, and nothing is dropped. Within a tier,
 * nearest first.
 */
function photoTier(place: NearbyPlace): number {
  if (!place.image) return 2;
  return /\.jpe?g(?=$|[?/#])/i.test(place.image.url) ? 0 : 1;
}

function byPhotoThenWalk(a: NearbyPlace, b: NearbyPlace): number {
  return photoTier(a) - photoTier(b) || a.km - b.km;
}

/**
 * **Somewhere to meet before the game, with a photograph where Atlas has one.**
 *
 * The meeting places are the shared curated list's (`kind: "meeting"`,
 * the same places the "Where are we meeting?" vote offers). Where Atlas holds
 * the same place by name, its photograph, hours and facts come with it — under
 * the same picture rule as the restaurants (`nearbyImage`). Where it does not,
 * the place is stated as the curated list states it, with no picture:
 * nothing is borrowed from a place that merely looks similar.
 */
export function nearbyMeetingSpots(
  candidates: readonly DiscoveryCandidate[],
  curated: readonly CuratedPlace[],
  venue: readonly [number, number],
  { withinKm = 1, weekday }: NearbyOptions = {},
): NearbyPlace[] {
  return curatedNear(curated, venue, { kinds: ["meeting"], withinKm })
    .map(({ place, km, walkMinutes }): NearbyPlace => {
      const held = candidates.find((c) => sameName(c.name, place.name));
      const image = held ? nearbyImage(held) : undefined;
      const gameDay = held ? gameDayOf(held, weekday) : undefined;
      return {
        atlasId: place.id,
        name: place.name,
        subtype: "Meeting place",
        blurb: place.blurb,
        address: `${place.address}, ${place.neighbourhood}`,
        ...(image ? { image } : {}),
        ...(gameDay ? { gameDay } : {}),
        km,
        walkMinutes,
        basis: "straight-line",
        source: "curated",
        at: place.at,
      };
    })
    .sort(byPhotoThenWalk);
}
