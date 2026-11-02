import type { EveningId } from "./evenings";

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
  /** The vanity path and the registry key: `/datenight`. */
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
  /** The day itself, when the night has one. */
  readonly day?: NightDay;
  /**
   * The evenings it opens on, as choices (mission 485). Ids, so the config
   * stays plain data on its way to the browser; `evenings.ts` holds them.
   */
  readonly evenings?: readonly EveningId[];
  /** Who the invitation is for, said on the owner's own page only. */
  readonly partnerName?: string;
}

// ------------------------------------------------------------------ the day

/** START → EXPLORE → EXPERIENCE → UNWIND → REMEMBER. */
export type Phase = "start" | "explore" | "experience" | "unwind";
export type Mood = "romantic" | "adventurous" | "cozy" | "playful";

/**
 * **One real place a night's day may use**, checked against Atlas for the
 * day it is for. The words are ours; every fact shown about the place comes
 * from Atlas on the page (`atlasRef`), except `checked`, which says exactly
 * where and when somebody looked.
 */
export interface DayOption {
  readonly atlasRef: string;
  /** Atlas's name, used only until Atlas answers. */
  readonly title: string;
  readonly phase: Phase;
  readonly moods: readonly Mood[];
  /** What you're doing, in a line. */
  readonly line: string;
  /** Why it's worth it, today. */
  readonly why: string;
  /** Minutes the plan sets aside. Arithmetic, not a claim. */
  readonly minutes: number;
  /** 0 free · 1 $ · 2 $$ · 3 $$$ — our own reading of a published price. */
  readonly cost: 0 | 1 | 2 | 3;
  /** Road minutes from the night's start, about. Used only to respect reach. */
  readonly reach: number;
  /** Only worth it in daylight (a lake, a trail, a view). */
  readonly daylight?: true;
  /** Stated hours on the day, minutes after midnight — only where stated. */
  readonly opens?: number;
  readonly closes?: number;
  /** Where the hours came from. Without it, the card says they're unknown. */
  readonly hoursSource?: string;
  readonly drinks?: true;
  readonly coldWater?: true;
  readonly caution?: string;
}

export interface NightDay {
  /** `YYYY-MM-DD`. */
  readonly on: string;
  /** A Discovery town id: where the day starts. */
  readonly townId: string;
  readonly area: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timeZone: string;
  readonly options: readonly DayOption[];
  /** The REMEMBER beat: ours, not a place Passport checked. */
  readonly finale: {
    readonly title: string;
    readonly line: string;
    readonly caution?: string;
  };
}
