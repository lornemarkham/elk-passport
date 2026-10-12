import type { Adventure, SubjectMoment } from "./contracts";

/** Test fixtures. Not exported from the module index. */

export const VERNON_POINT = { latitude: 50.267, longitude: -119.272 };

/** A point `km` north of Vernon. One degree of latitude is ~111 km. */
export const north = (km: number) => ({
  latitude: VERNON_POINT.latitude + km / 111,
  longitude: VERNON_POINT.longitude,
});

export const subjectMoment = (
  id: string,
  over: Partial<SubjectMoment> = {},
): SubjectMoment => ({
  kind: "subject",
  id,
  label: id,
  minutes: 60,
  notes: [],
  subject: { id, kind: "Place", title: id },
  point: {
    state: "known",
    value: north(2),
    source: { by: "atlas", contract: "candidate-geography/2" },
  },
  open: { state: "unknown", because: "No published hours for the day." },
  cost: { state: "unknown", because: "No published price." },
  ...over,
});

export const anAdventure = (over: Partial<Adventure> = {}): Adventure => ({
  version: 1,
  id: "a",
  createdAt: "2026-10-11T15:00:00.000Z",
  said: "four hours near Vernon",
  title: "Polson Park to Kal Beach, out of Vernon",
  constraints: {
    time: { hours: 4 },
    party: { companions: [], needs: [] },
    origin: { name: "Vernon, BC", townId: "vernon", point: VERNON_POINT },
  },
  moments: [subjectMoment("polson-park"), subjectMoment("kal-beach")],
  unknowns: [],
  builtBy: { by: "plan", method: "buildDay" },
  ...over,
});
