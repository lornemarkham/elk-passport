import "server-only";
import { discoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";
import { daysOn, happeningWithin, localDay } from "@/domain/october/calendar";
import { octoberNow, octoberWindow } from "@/domain/october/octoberWindow";
import { temporalContext } from "@/domain/october/temporal";
import { classifySubject } from "@/domain/october/subjectKind";
import {
  collectionBySlug,
  EDITORIAL_COLLECTIONS,
  resolveCollection,
} from "@/domain/collections/editorial";
import { CATALOGUE } from "@/lib/movies/catalogue";
import { MAKING } from "@/lib/making/catalogue";
import {
  OCTOBER_PLACES,
  placeById,
  placeFrom,
} from "@/domain/environment/places";
import { environmentsForPoints } from "@/lib/environment/atEvent";
import { scenarioFrom, simulatedEnvironment } from "@/lib/environment/scenario";
import { lightPhaseAt } from "@/domain/environment/daylight";
import { currentUser } from "@/lib/auth/currentUser";
import { profileFor } from "@/lib/profile/profileService";
import {
  keptOnThisPage,
  type KeptOnThisPage,
} from "@/lib/october/keptOnThisPage";
import type { AtlasFailure } from "@/lib/data/atlasAuth";
import {
  possibilityFromAtlas,
  possibilityFromDoing,
  possibilityFromFilm,
  type Possibility,
} from "./possibility";
import { weatherFrom, type Context, type Weather } from "./fit";

/**
 * **Everything a person could do in October, read once, as one list.**
 *
 * Three labs sit on this. That is the point: if each prototype assembled its
 * own inventory we would be comparing content, and the only thing worth
 * comparing is the *discovery model*. So the pool is built here, identically,
 * and A, B and C differ only in what they do with it.
 *
 * ## What goes in, and what is deliberately left out
 *
 * - **Atlas, dated** — everything `happeningWithin` returns for the month.
 *   That is the same evidence the production month browse uses.
 * - **Atlas, stated** — members of the editorial collections, which a human
 *   put there. These carry no dates of their own (their nights live on child
 *   records Atlas does not expose to this endpoint) and they are two of the
 *   best things in October, so they come in as `unstated` rather than being
 *   dropped or given a date nobody published.
 * - **Every film** and **every Doing**, which are authored and always on.
 *
 * What is left out is the 1,585 Organizations and most of the 318 Places —
 * businesses with no October claim and no stated hours. Including them would
 * triple the pool and every one of them would answer *can I do this tonight?*
 * with "nobody said", which is not discovery, it is a directory.
 */

/**
 * Where a signed-out visitor's October is, for the labs only.
 *
 * `OCTOBER_PLACES[0]` is Revelstoke because the list runs north to south, and
 * a lab that opens on Revelstoke is describing weather two hundred kilometres
 * from almost all of this inventory. Signed in, the profile still decides.
 */
const LAB_DEFAULT_AREA = "vernon";

/** Authored October experiences that own a subject better than its page does. */
const AUTHORED_HREF: Readonly<Record<string, string>> = {
  // Atlas holds the Draconids as an Event with six facts. Passport holds a
  // thirty-second experience built from those same facts, and that is the
  // better door. The id is the live Atlas id, verified against the corpus.
  "ddf146c6-7117-4520-a9fe-8326209fd5db": "/quick/draconids",
};

export interface Pool {
  readonly possibilities: readonly Possibility[];
  readonly ctx: Context;
  readonly weather: Weather;
  /** Where this reading is for. Named on screen, never guessed at. */
  readonly areaName?: string;
  readonly page: KeptOnThisPage;
  readonly today: string;
  readonly now: Date;
  /** Set when the pool is a dev simulation. Surfaces must say so. */
  readonly simulated?: string;
  /** Set when Atlas did not answer. Surfaces must say so rather than show 0. */
  readonly outage?: AtlasFailure;
  /** Counts for the lab report, not for a traveller. */
  readonly census: {
    readonly atlas: number;
    readonly movie: number;
    readonly doing: number;
    readonly withImage: number;
    readonly tonight: number;
  };
}

export async function octoberPool(sim?: string): Promise<Pool> {
  // Development only; `scenarioFrom` is inert in any deployed build.
  const scenario = scenarioFrom(sim);
  const nowReal = scenario ? scenario.now : new Date();
  const now = octoberNow(nowReal);
  const today = localDay(now);
  const { from, to } = octoberWindow(now);

  const [atlas, page, user] = await Promise.all([
    discoveryCandidates(),
    keptOnThisPage(),
    currentUser().catch(() => null),
  ]);
  const experiences = atlas.candidates.map(candidateToExperience);
  const subtypeOf = new Map(atlas.candidates.map((c) => [c.id, c.subtype]));

  // ------------------------------------------------------- where, and the sky
  const profile = user ? await profileFor(user).catch(() => null) : null;
  const place = scenario
    ? placeById(scenario.areaId)
    : (placeFrom(profile?.homeArea) ?? placeById(LAB_DEFAULT_AREA));
  const points = new Map(
    atlas.candidates
      .filter((c) => c.coordinates)
      .map((c) => [
        c.id,
        { latitude: c.coordinates![1], longitude: c.coordinates![0] },
      ]),
  );
  const venuePoints = experiences
    .map((e) => (e.venue?.placeId ? points.get(e.venue.placeId) : undefined))
    .filter((p): p is { latitude: number; longitude: number } => Boolean(p));
  const environments = scenario
    ? new Map(
        OCTOBER_PLACES.map((p) => [p.id, simulatedEnvironment(scenario, p)]),
      )
    : await environmentsForPoints(venuePoints, place).catch(
        () => new Map<string, never>(),
      );
  const outside = place ? environments.get(place.id) : undefined;
  const light = place
    ? lightPhaseAt(place.latitude, place.longitude, nowReal)
    : undefined;
  const weather = weatherFrom(outside, today, light);

  // --------------------------------------------------------------- the pool
  const dated = happeningWithin(experiences, from, to);
  const stated = EDITORIAL_COLLECTIONS.flatMap((c) => {
    const collection = collectionBySlug(c.slug);
    return collection ? resolveCollection(collection, experiences).members : [];
  });

  const seen = new Set<string>();
  const fromAtlas: Possibility[] = [];
  for (const experience of [...dated, ...stated]) {
    if (seen.has(experience.id)) continue;
    seen.add(experience.id);
    const p = atlasPossibility(experience, subtypeOf, today);
    fromAtlas.push(p);
  }

  const possibilities: Possibility[] = [
    ...fromAtlas,
    ...CATALOGUE.map(possibilityFromFilm),
    ...MAKING.map(possibilityFromDoing),
  ];

  const temporal = temporalContext(now);
  const ctx: Context = {
    today,
    weather,
    ...(temporal.daysToHalloween !== undefined
      ? { daysToHalloween: temporal.daysToHalloween }
      : {}),
  };

  return {
    possibilities,
    ctx,
    weather,
    ...(place ? { areaName: place.name } : {}),
    page,
    today,
    now,
    ...(scenario ? { simulated: scenario.label } : {}),
    ...(atlas.outage ? { outage: atlas.outage } : {}),
    census: {
      atlas: fromAtlas.length,
      movie: CATALOGUE.length,
      doing: MAKING.length,
      withImage: possibilities.filter((p) => p.image).length,
      tonight: possibilities.filter((p) => p.availability.tonight).length,
    },
  };
}

function atlasPossibility(
  experience: Experience,
  subtypeOf: ReadonlyMap<string, string | undefined>,
  today: string,
): Possibility {
  const venueSubtype = experience.venue?.placeId
    ? subtypeOf.get(experience.venue.placeId)
    : undefined;
  const { kind } = classifySubject(experience, venueSubtype);
  const p = possibilityFromAtlas(experience, {
    days: daysOn(experience),
    setting: kind,
    today,
  });
  const authored = AUTHORED_HREF[experience.id];
  return authored ? { ...p, href: authored } : p;
}

/** Every environment this lab can simulate, for the dev switcher. */
export { SCENARIOS } from "@/lib/environment/scenario";
