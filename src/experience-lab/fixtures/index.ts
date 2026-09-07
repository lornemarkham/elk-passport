import { christmasLightUp } from "./christmasLightUp";
import { dateNight } from "./dateNight";
import { hockeyNight } from "./hockeyNight";
import { powderDay } from "./powderDay";
import { threeHours } from "./threeHours";
import { nextEdition, nextEditionSlug } from "../core/lineage";
import type { ExperienceDefinition } from "../core/types";

/**
 * The specimens.
 *
 * The order is the order they were attacked in: hockey built the engine, and
 * every fixture after it was chosen specifically because it should have
 * broken something. Adding a sixth is the cheapest way to find out whether
 * the primitives are real — a fixture is a data file and nothing else.
 */
export const FIXTURES: readonly ExperienceDefinition[] = [
  hockeyNight,
  powderDay,
  christmasLightUp,
  dateNight,
  threeHours,
];

/**
 * Fixtures, plus every fixture's next edition.
 *
 * A second edition is not a sixth fixture — it is the same definition with a
 * later anchor, resolved on demand. That is what makes "run it back" cost
 * almost nothing, and it is the first hint that *creating* an experience might
 * mostly be a matter of deriving one from another.
 */
export function findFixture(slug: string): ExperienceDefinition | undefined {
  const direct = FIXTURES.find((f) => f.slug === slug);
  if (direct) return direct;

  const base = FIXTURES.find((f) => nextEditionSlug(f.slug) === slug);
  return base ? nextEdition(base) : undefined;
}

/** Every route the lab serves, including the second editions. */
export function fixtureSlugs(): string[] {
  return FIXTURES.flatMap((f) => [f.slug, nextEditionSlug(f.slug)]);
}

export { hockeyNight, powderDay, christmasLightUp, dateNight, threeHours };
