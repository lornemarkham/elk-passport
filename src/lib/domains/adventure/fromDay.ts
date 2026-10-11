import type { DayPlanned, DayStop } from "@/domain/day/build";
import type { DayBrief } from "@/domain/day/brief";
import { ageEvidence } from "@/domain/discovery/suitability";
import {
  adventureSchema,
  type Adventure,
  type AdventureConstraints,
  type Reading,
  type SubjectMoment,
} from "./contracts";

/**
 * **The day Go have a day built, as an Adventure.**
 *
 * `buildDay` stays the builder; this only reads what it produced and the
 * Atlas readings already on each `Experience`, and labels every one of them
 * with where it came from. Nothing is looked up, and nothing the stop did not
 * carry is added.
 *
 * Returns `undefined` for a day with no stops — "a day we could not fill" is
 * an answer on screen, not something to save or print.
 */
export function adventureFromDay(
  day: DayPlanned,
  { id, createdAt }: { id: string; createdAt: string },
): Adventure | undefined {
  if (day.stops.length === 0) return undefined;
  return adventureSchema.parse({
    version: 1,
    id,
    createdAt,
    said: day.brief.said,
    title: day.title,
    constraints: constraintsFromBrief(day.brief),
    moments: day.stops.map((stop) => momentFromStop(stop, day.brief)),
    unknowns: [...day.unknowns],
    builtBy: { by: "plan", method: "buildDay" },
  });
}

export function constraintsFromBrief(brief: DayBrief): AdventureConstraints {
  return {
    time: {
      ...(brief.on ? { on: brief.on } : {}),
      ...(brief.hours !== undefined ? { hours: brief.hours } : {}),
    },
    ...(brief.budget !== undefined
      ? { budget: { maxDollars: brief.budget } }
      : {}),
    party: {
      companions:
        brief.childAge !== undefined
          ? [{ role: "child", age: brief.childAge }]
          : [],
      needs: [],
    },
    ...(brief.town
      ? {
          origin: {
            name: brief.town.name,
            townId: brief.town.id,
            point: {
              latitude: brief.town.latitude,
              longitude: brief.town.longitude,
            },
          },
        }
      : {}),
    ...(brief.withinKm !== undefined ? { withinKm: brief.withinKm } : {}),
  };
}

const FREE = /\bfree\b|no charge|no admission/i;

function momentFromStop(stop: DayStop, brief: DayBrief): SubjectMoment {
  const { experience } = stop;
  return {
    kind: "subject",
    id: experience.id,
    label: experience.title,
    minutes: stop.minutes,
    because: stop.because,
    notes: [...stop.notes],
    ...(stop.challenge ? { challenge: stop.challenge } : {}),
    subject: {
      id: experience.id,
      kind: experience.kind,
      title: experience.title,
    },
    point: pointReading(stop),
    open: openReading(stop),
    cost: stop.cost
      ? {
          state: "known",
          value: {
            text: stop.cost,
            // Free is free for everybody. Any other price is per something,
            // and is not turned into a total.
            ...(FREE.test(stop.cost) ? { dollars: 0 } : {}),
          },
          source: { by: "atlas", contract: "candidate-knowledge/1" },
        }
      : { state: "unknown", because: "No published price." },
    ...(brief.childAge !== undefined
      ? { suitability: suitabilityReading(stop, brief.childAge) }
      : {}),
  };
}

/** Atlas's tuple is `[longitude, latitude]`; this is the one place it is turned round. */
function pointReading(stop: DayStop): SubjectMoment["point"] {
  const geography = stop.experience.geography;
  const c = geography?.coordinates;
  if (!c) return { state: "unknown", because: "Atlas has not placed this." };
  return {
    state: "known",
    value: { latitude: c[1], longitude: c[0] },
    source: { by: "atlas", contract: "candidate-geography/2" },
    ...(geography?.coordinatesBasis
      ? { basis: geography.coordinatesBasis }
      : {}),
  };
}

function openReading(stop: DayStop): SubjectMoment["open"] {
  const onDate = stop.experience.schedule?.onDate;
  if (!onDate || onDate.reading === "unknown") {
    return { state: "unknown", because: "No published hours for the day." };
  }
  if (onDate.reading === "conflicting") {
    return {
      state: "conflicting",
      because: onDate.note || "Published hours disagree about the day.",
    };
  }
  return {
    state: "known",
    value: { date: onDate.date, open: onDate.reading === "on" },
    source: { by: "atlas", contract: "candidate-schedule/1" },
    ...(onDate.basis ? { basis: onDate.basis } : {}),
  };
}

function suitabilityReading(
  stop: DayStop,
  age: number,
): NonNullable<SubjectMoment["suitability"]> {
  const evidence = ageEvidence(stop.experience, age);
  const statement = evidence.statements[0]?.text;
  switch (evidence.verdict) {
    case "unknown":
      return { state: "unknown", because: `Atlas states nothing for ${age}.` };
    case "unclear":
      return {
        state: "conflicting",
        because: `Sources disagree about ${age}-year-olds.`,
      };
    default:
      return {
        state: "known",
        value: { age, verdict: evidence.verdict },
        source: { by: "atlas", contract: "candidate-suitability/1" },
        ...(statement ? { basis: statement } : {}),
      } satisfies Reading<{ age: number; verdict: typeof evidence.verdict }>;
  }
}
