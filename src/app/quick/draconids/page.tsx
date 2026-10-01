import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth/currentUser";
import { profileFor } from "@/lib/profile/profileService";
import { octoberThingsFor } from "@/lib/october/octoberThings";
import { getSubjectDetail } from "@/lib/data/atlas-repo";
import { subjectPageView } from "@/lib/passport/subjectPage";
import { placeById, placeFrom } from "@/domain/environment/places";
import { daylightAt, moonIllumination } from "@/domain/environment/daylight";
import { conditionsFor } from "@/domain/october/conditions";
import { beatsFor, type DraconidFact } from "@/domain/october/draconids";
import { environmentFor } from "@/lib/environment/reading";
import {
  scenarioFrom,
  simulatedEnvironment,
  SIMULATED_SOURCE,
} from "@/lib/environment/scenario";
import {
  QuickStage,
  type YourNight,
} from "@/components/october/quick/QuickStage";

export const metadata: Metadata = { title: "The Draconids — October" };

/**
 * **The Draconids, fast.**
 *
 * One subject, deliberately. This is not a framework and there is no registry
 * of quick experiences — proving the shape works on the best candidate in the
 * corpus is the whole job, and generalising before it has been used would be
 * designing for a second consumer that does not exist yet.
 *
 * The sequence is built from Atlas's own facts at request time, so a beat
 * whose fact Atlas stops carrying stops existing rather than becoming
 * something Passport invented. The detail page is untouched and one tap away.
 */
const DRACONIDS_ID = "ddf146c6-7117-4520-a9fe-8326209fd5db";
/** The night Atlas names as the best one, and the night we read the sky for. */
const BEST_NIGHT = "2026-10-08";

export default async function DraconidsQuickPage({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  const scenario = scenarioFrom((await searchParams).sim);
  const now = scenario ? scenario.now : new Date();

  const composition = await getSubjectDetail("events", DRACONIDS_ID).catch(
    () => null,
  );
  // Without Atlas there is no content — every claim in here is its. Better a
  // 404 than a sequence of framing lines with nothing behind them.
  if (!composition) notFound();
  const view = subjectPageView(composition);

  const facts: DraconidFact[] = view.subject.facts.map((f) => ({
    label: f.label,
    value: f.value,
  }));
  const beats = beatsFor(facts, {
    from: view.subject.startTime,
    to: view.subject.endTime,
  });

  const user = await currentUser().catch(() => null);
  const [profile, things] = await Promise.all([
    user ? profileFor(user).catch(() => null) : Promise.resolve(null),
    user ? octoberThingsFor(user).catch(() => []) : Promise.resolve([]),
  ]);

  const place = scenario
    ? placeById(scenario.areaId)
    : placeFrom(profile?.homeArea);

  // What this person's best night looks like. Darkness and the moon need no
  // provider; the sky does, and says nothing without one.
  let night: YourNight = {};
  if (place) {
    const light = daylightAt(
      place.latitude,
      place.longitude,
      new Date(`${BEST_NIGHT}T20:00:00Z`),
    );
    const environment = scenario
      ? simulatedEnvironment(scenario, place)
      : (await environmentFor([place])).get(place.id);
    const sky = conditionsFor("astronomy", BEST_NIGHT, environment, now);

    night = {
      place: place.name.replace(/,\s*BC$/i, ""),
      ...(light
        ? {
            darkAt: light.sunset
              .toLocaleTimeString("en-CA", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/Vancouver",
              })
              .replace(
                /\s?([ap])\.?m\.?/i,
                (_, p: string) => ` ${p.toUpperCase()}M`,
              ),
          }
        : {}),
      moonLit: moonIllumination(new Date(`${BEST_NIGHT}T22:00:00-07:00`)),
      // Only the sentence. The panel already states the darkness and the
      // moon in its own words, and repeating them underneath reads as a
      // page that has lost track of what it just said.
      ...(sky ? { sky: { line: sky.line } } : {}),
      ...(sky
        ? { source: sky.source, simulated: sky.source === SIMULATED_SOURCE }
        : {}),
    };
  }

  return (
    <QuickStage
      beats={beats}
      thing={{
        entityId: DRACONIDS_ID,
        entityKind: "Event",
        name: view.subject.name,
        startsAt: view.subject.startTime ?? null,
      }}
      signedIn={Boolean(user)}
      initiallySaved={things.some((t) => t.entityId === DRACONIDS_ID)}
      detailHref={`/passport/${DRACONIDS_ID}`}
      yourNight={night}
    />
  );
}
