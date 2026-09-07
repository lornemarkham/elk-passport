import { christmasLightUp } from "./christmasLightUp";
import { dateNight } from "./dateNight";
import { hockeyNight } from "./hockeyNight";
import { powderDay } from "./powderDay";
import { threeHours } from "./threeHours";
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

export function findFixture(slug: string): ExperienceDefinition | undefined {
  return FIXTURES.find((f) => f.slug === slug);
}

export { hockeyNight, powderDay, christmasLightUp, dateNight, threeHours };
