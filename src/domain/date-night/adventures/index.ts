import { MARKHAM } from "./markham";
import type { NightConfig } from "./types";

export type { NightActivity, NightConfig } from "./types";

const NIGHTS: readonly NightConfig[] = [MARKHAM];

export const nightConfig = (slug: string): NightConfig | undefined =>
  NIGHTS.find((n) => n.slug === slug);

/** The night an existing adventure was made from, by its title. */
export const nightForTitle = (title: string): NightConfig | undefined =>
  NIGHTS.find((n) => n.adventureTitle === title);

/** Which Atlas place a mystery reveals: the first not already on the plan. */
export function pickMystery(
  config: NightConfig,
  held: ReadonlySet<string>,
  random: () => number = Math.random,
): string | null {
  const open = config.mysteryAtlasIds.filter((id) => !held.has(id));
  if (open.length === 0) return null;
  return open[Math.floor(random() * open.length)] ?? null;
}
