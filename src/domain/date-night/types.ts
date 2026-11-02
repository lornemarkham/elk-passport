/**
 * **Date Night — what one invitation is made of.**
 *
 * A Date Night is a personal invitation from one person to another: a handful
 * of adventure ideas, the person invited choosing what they like and adding
 * their own, and the person who sent it reading the answers privately and
 * deciding the day together.
 *
 * The engine (this folder, `src/components/date-night/`, the
 * `/date-night/[slug]` routes and `passport_date_night_*` in Postgres) knows
 * nothing about any particular couple. One night is a `DateNight` value in
 * `nights/`; the engine renders whichever one a slug names. A future
 * "make your own Date Night" writes the same shape from a form instead of a
 * file — nothing below assumes it was typed by hand.
 *
 * The person who planned it owns an ordinary Passport adventure of kind
 * `date-night` (src/lib/adventures/kinds.ts), so membership, invitations and
 * a shared plan are the adventure core's when the night wants them. The
 * no-sign-in invitation and its answers are Date Night's own extension.
 */

/** A real-world check an idea needs before anybody acts on it. */
export type CautionId =
  | "cold-water"
  | "fire"
  | "hunting"
  | "backcountry-snow"
  | "forest-roads"
  | "unverified-place";

export interface DateNightIdea {
  /** Stable within its night; it is what an answer records. */
  readonly id: string;
  readonly emoji: string;
  readonly title: string;
  /** One playful line, in the voice of the person inviting. */
  readonly line: string;
  /**
   * Checks this idea needs before it is real. The invitation says them out
   * loud; it never says an idea is safe, open or possible.
   */
  readonly cautions?: readonly CautionId[];
  /**
   * Atlas entities this idea is about, by id. Facts shown for them are
   * Atlas's, read when the page is; an id Atlas no longer returns is dropped.
   */
  readonly atlasIds?: readonly string[];
  /**
   * The idea names a place Atlas does not hold (yet). The invitation says
   * so rather than inventing hours, access or conditions for it.
   */
  readonly placeAtlasDoesNotKnow?: string;
  /**
   * True when the idea depends on light: the invitation shows the day's
   * sunset, computed for `area`.
   */
  readonly aboutSunset?: boolean;
}

export interface DateNightArea {
  /** Said to the reader — "around Vernon". Not a geocode. */
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface DateNight {
  /** The URL segment: `/date-night/<slug>`. */
  readonly slug: string;
  /** A shorter public path for this night, if it has one (`/lorne-and-jess`). */
  readonly vanityPath?: string;
  /** Who sent it and who it is for, as they call each other. */
  readonly from: string;
  readonly to: string;
  /** The headline, e.g. "Lorne ❤️ Jess". */
  readonly headline: string;
  /** The local day of the date, `YYYY-MM-DD`. */
  readonly on: string;
  /** IANA zone the day is read in. */
  readonly timeZone: string;
  /** The opening sentence under the headline. */
  readonly invitation: string;
  readonly area: DateNightArea;
  readonly ideas: readonly DateNightIdea[];
  /** Atlas places to offer when the invited person suggests somewhere. */
  readonly suggestPlaceIds?: readonly string[];
  /** Food and drink to tap, beside a free-text box. */
  readonly food: readonly string[];
  /** How the invitation signs off after it is sent. */
  readonly thanks: string;
}

/** How adventurous the invited person feels, 1 (cozy) to 5 (send it). */
export const ADVENTUROUS_LEVELS = [
  {
    value: 1,
    emoji: "🛋️",
    label: "Cozy",
    line: "Blankets, warm drinks, nowhere to be.",
  },
  {
    value: 2,
    emoji: "🥾",
    label: "Easy outside",
    line: "Fresh air, nothing too wild.",
  },
  {
    value: 3,
    emoji: "🌲",
    label: "Up for it",
    line: "A proper adventure, home by dark.",
  },
  {
    value: 4,
    emoji: "🏔️",
    label: "Bring it",
    line: "Cold, muddy, far — I'm in.",
  },
  {
    value: 5,
    emoji: "🔥",
    label: "Send it",
    line: "Surprise me. The wilder the better.",
  },
] as const;

export type Adventurous = (typeof ADVENTUROUS_LEVELS)[number]["value"];

/** What the invited person says about one idea. Desire, not a plan (§2.2). */
export type IdeaPick = "yes" | "maybe" | "no";

export const IDEA_PICKS: readonly { value: IdeaPick; label: string }[] = [
  { value: "yes", label: "Yes please" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Not this time" },
];
