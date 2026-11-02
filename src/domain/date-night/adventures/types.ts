/**
 * **A Date Night built on the shared adventure core.**
 *
 * Everything that makes one couple's night theirs is data here; the engine
 * (pages under `/night`, the packing list, the memories) knows no names. A new
 * night is a new entry in `./index.ts`.
 */
export interface NightActivity {
  readonly id: string;
  readonly emoji: string;
  readonly title: string;
  /** One playful line under the title. */
  readonly line: string;
  /**
   * What the card is allowed to say about the place. Nothing here is a
   * verified fact: Atlas facts come from `atlasRef`, and an idea Atlas does
   * not hold says so.
   */
  readonly caution?: string;
  /** An Atlas entity id, only where one was checked to exist. */
  readonly atlasRef?: string;
  /** Passport picks the place from `NightConfig.mysteryAtlasIds`. */
  readonly mystery?: true;
}

export interface NightConfig {
  /** The vanity path and the registry key: `/markham`. */
  readonly slug: string;
  readonly title: string;
  /** The adventure's own title in the database. */
  readonly adventureTitle: string;
  readonly tagline: string;
  /** What the invitation says, shown on the share screen and the join page. */
  readonly invitation: readonly string[];
  readonly activities: readonly NightActivity[];
  readonly packing: readonly string[];
  /** Real Atlas places a mystery may be drawn from (checked against Atlas). */
  readonly mysteryAtlasIds: readonly string[];
}
