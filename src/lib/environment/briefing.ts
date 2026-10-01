import "server-only";
import { currentUser } from "@/lib/auth/currentUser";
import { profileFor } from "@/lib/profile/profileService";
import { placeById, placeFrom } from "@/domain/environment/places";
import { classifySubject } from "@/domain/october/subjectKind";
import { conditionsFor, type ConditionRead } from "@/domain/october/conditions";
import { localDay } from "@/domain/experience/eventTime";
import type { Experience } from "@/domain/experience/types";
import type { SubjectPageView } from "@/lib/passport/subjectPage";
import { environmentsForPoints, nearestPlace } from "./atEvent";
import { scenarioFrom, simulatedEnvironment } from "./scenario";

/**
 * **The detail page's briefing: this thing, its own day, its own place.**
 *
 * A subject page knows more than any lane does — it is one thing, and whoever
 * is looking at it is deciding whether to drive there. So the question is
 * narrow: on the next day this is on, at the place it happens, what will it be
 * like?
 *
 * Everything needed is already in the composed view. `subject.days` is every
 * day its claims state, and `venue.coordinates` is the door Atlas holds — so
 * there is no second Atlas read and no candidate feed to scan.
 *
 * Any failure returns `null` and the page renders exactly as it did before.
 */
export async function briefingFor(
  view: SubjectPageView,
  sim?: string,
): Promise<ConditionRead | null> {
  try {
    const scenario = scenarioFrom(sim);
    const at = scenario ? scenario.now : new Date();
    const { subject, venue } = view;

    // The next day this is on. An Event's own interval counts as a day too.
    const today = localDay(at);
    const day =
      subject.days.find((d) => d >= today) ??
      (subject.startTime ? localDay(subject.startTime) : undefined);
    if (!day || day < today) return null;

    // Classification wants an Experience-shaped thing; only these fields are
    // read, and all of them come straight off the composed view.
    const asExperience = {
      title: subject.name,
      subtype: subject.subtype,
      shortDescription: subject.description,
      description: subject.description,
      startTime: subject.startTime,
      timePrecision: subject.timePrecision,
    } as Experience;

    const { kind } = classifySubject(asExperience, venue?.subtype);
    if (kind === "unknown") return null;

    const point = venue?.coordinates
      ? { latitude: venue.coordinates[1], longitude: venue.coordinates[0] }
      : undefined;

    if (scenario) {
      const place =
        (point ? nearestPlace(point) : undefined) ?? placeById(scenario.areaId);
      if (!place) return null;
      return (
        conditionsFor(kind, day, simulatedEnvironment(scenario, place), at, {
          surface: "page",
        }) ?? null
      );
    }

    const user = await currentUser().catch(() => null);
    const profile = user ? await profileFor(user).catch(() => null) : null;
    const home = placeFrom(profile?.homeArea);
    const environments = await environmentsForPoints(
      point ? [point] : [],
      home,
    );
    const place = point ? nearestPlace(point) : home;
    return (
      conditionsFor(
        kind,
        day,
        place ? environments.get(place.id) : undefined,
        at,
      ) ?? null
    );
  } catch {
    // A subject page must render without this. Always.
    return null;
  }
}
