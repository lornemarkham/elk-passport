/**
 * **Who is riding, and how much mountain that is.**
 *
 * The one safety rule in here is the one that matters on a real hill: *a
 * group rides at the level of its most careful member.* Nobody is asked to
 * keep up. Challenges, run suggestions and the crew summary all read this.
 */
export const ABILITIES = [
  "first-timer",
  "beginner",
  "intermediate",
  "advanced",
] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_LABEL: Record<Ability, string> = {
  "first-timer": "First time",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/**
 * What the resort's own map will call the runs for this level, by the North
 * American convention (green circle, blue square, black diamond). Which
 * runs are actually open is the resort's to say, not ours.
 */
export const ABILITY_RUNS: Record<Ability, string> = {
  "first-timer": "the learning area and a lesson — no lift-served runs yet",
  beginner: "green circle runs",
  intermediate: "green circle and blue square runs",
  advanced: "green, blue and black diamond runs you have read on the map",
};

export const DISCIPLINES = ["ski", "snowboard", "apres"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  ski: "Skiing",
  snowboard: "Snowboarding",
  apres: "Après & the lodge only",
};

export function abilityRank(a: Ability): number {
  return ABILITIES.indexOf(a);
}

export function isAbility(v: unknown): v is Ability {
  return typeof v === "string" && (ABILITIES as readonly string[]).includes(v);
}

export function isDiscipline(v: unknown): v is Discipline {
  return (
    typeof v === "string" && (DISCIPLINES as readonly string[]).includes(v)
  );
}

export interface Rider {
  readonly discipline: Discipline;
  readonly ability: Ability;
}

/** The most careful rider's level. `undefined` when nobody is on the snow. */
export function groupCeiling(people: readonly Rider[]): Ability | undefined {
  const riders = people.filter((p) => p.discipline !== "apres");
  if (riders.length === 0) return undefined;
  return riders.reduce(
    (low, p) => (abilityRank(p.ability) < abilityRank(low) ? p.ability : low),
    riders[0].ability,
  );
}

/** One sentence the crew can read out loud at the base of the lift. */
export function groupLine(people: readonly Rider[]): string {
  const ceiling = groupCeiling(people);
  if (!ceiling) return "Nobody is riding — a lodge day is still a day.";
  return `The group rides at ${ABILITY_LABEL[ceiling].toLowerCase()} level: stick to ${ABILITY_RUNS[ceiling]}.`;
}
