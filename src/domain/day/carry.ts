import type { DayBrief, Party } from "./brief";

/**
 * **A revised brief, carried to the paper intact.**
 *
 * The sentence alone is not enough: "four hours, $40 — longer — we have $80
 * now" re-read from scratch is four hours and $40, because the first thing a
 * person said is the first thing a parser finds. So the fields a revision
 * can change travel beside the sentence, and the print page lays them over
 * its own reading. Every field is checked on the way in; anything malformed
 * is dropped rather than trusted — it came from a URL.
 */
export type CarriedBrief = Pick<
  DayBrief,
  | "hours"
  | "budget"
  | "party"
  | "startAt"
  | "homeBy"
  | "startsNow"
  | "interests"
  | "avoid"
  | "shelter"
  | "appetite"
  | "cautions"
  | "withinKm"
  | "lessDriving"
>;

export function carryBrief(brief: DayBrief): string {
  const carried: Partial<CarriedBrief> = {
    ...(brief.hours !== undefined ? { hours: brief.hours } : {}),
    ...(brief.budget !== undefined ? { budget: brief.budget } : {}),
    ...(brief.party ? { party: brief.party } : {}),
    ...(brief.startAt !== undefined ? { startAt: brief.startAt } : {}),
    ...(brief.homeBy !== undefined ? { homeBy: brief.homeBy } : {}),
    ...(brief.startsNow ? { startsNow: true } : {}),
    interests: brief.interests,
    ...(brief.avoid?.length ? { avoid: brief.avoid } : {}),
    ...(brief.shelter ? { shelter: brief.shelter } : {}),
    ...(brief.appetite ? { appetite: brief.appetite } : {}),
    ...(brief.cautions?.length ? { cautions: brief.cautions } : {}),
    ...(brief.withinKm !== undefined ? { withinKm: brief.withinKm } : {}),
    ...(brief.lessDriving ? { lessDriving: true } : {}),
  };
  return JSON.stringify(carried);
}

const PARTIES: readonly Party[] = ["solo", "couple", "family", "friends"];
const num = (v: unknown, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max
    ? v
    : undefined;
const words = (v: unknown, max = 20) =>
  Array.isArray(v)
    ? v
        .filter((w): w is string => typeof w === "string" && w.length <= 300)
        .slice(0, max)
    : undefined;

export function uncarryBrief(raw: string | undefined): Partial<CarriedBrief> {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const hours = num(v.hours, 24);
  const budget = num(v.budget, 100_000);
  const startAt = num(v.startAt, 24 * 60);
  const homeBy = num(v.homeBy, 24 * 60);
  const withinKm = num(v.withinKm, 1000);
  const interests = words(v.interests);
  const avoid = words(v.avoid);
  const cautions = words(v.cautions, 6);
  return {
    ...(hours !== undefined ? { hours } : {}),
    ...(budget !== undefined ? { budget } : {}),
    ...(PARTIES.includes(v.party as Party) ? { party: v.party as Party } : {}),
    ...(startAt !== undefined ? { startAt } : {}),
    ...(homeBy !== undefined ? { homeBy } : {}),
    ...(v.startsNow === true ? { startsNow: true } : {}),
    ...(interests ? { interests } : {}),
    ...(avoid ? { avoid } : {}),
    ...(v.shelter === "indoor" || v.shelter === "outdoor"
      ? { shelter: v.shelter }
      : {}),
    ...(v.appetite === "gentle" ||
    v.appetite === "odd" ||
    v.appetite === "adventurous"
      ? { appetite: v.appetite }
      : {}),
    ...(cautions ? { cautions } : {}),
    ...(withinKm !== undefined ? { withinKm } : {}),
    ...(v.lessDriving === true ? { lessDriving: true } : {}),
  };
}
