/**
 * **The GO HAVE A DAY test cohort — ten real days somebody might ask for.**
 *
 * Each scenario is the sentence a person would type into `/go`, the town the
 * page would know them to be in (`?at=`, as Discovery hands it over), and two
 * kinds of expectation that are kept apart on purpose:
 *
 * - `hears` — what a correct reading of the sentence contains. A miss is an
 *   **objective** failure: the person said it and the day was built without
 *   it. Only things that were literally said go here; nothing is inferred.
 * - `needs` — what every stop must satisfy for the day to answer the question,
 *   checked against what Atlas itself states (exposure, age verdicts,
 *   distance, schedule). Also objective, and only ever failed on a stated
 *   fact: Atlas silence is recorded as unknown, never as a pass or a fail.
 *
 * Anything softer (is it actually unusual, is it a good family day) is a
 * **judgement**, and lives in `docs/product/critic/judgements.json`, keyed to
 * the exact stops it judged, so it goes stale the moment the day changes.
 *
 * Changing a sentence here changes the experiment. Add a scenario rather than
 * editing one, or comparisons across runs stop meaning anything; the runner
 * fingerprints this file and says so when it changes.
 */
export interface Scenario {
  readonly id: string;
  readonly town: "vernon" | "vancouver";
  /** Exactly what is typed into the box. */
  readonly says: string;
  /** What the cohort brief asked this scenario to test, in its words. */
  readonly brief: string;
  readonly hears: {
    readonly hours?: number;
    readonly childAge?: boolean;
    readonly shelter?: "indoor" | "outdoor";
    readonly appetite?: "odd" | "adventurous" | "gentle";
    /** The reading must allow at least this far, in km. */
    readonly reachAtLeastKm?: number;
    /** The reading must keep the day inside this, in km. */
    readonly reachAtMostKm?: number;
    /**
     * Said, and with no field in `DayBrief` to hold it. Recorded as a reading
     * gap every run until the brief can carry it — a visible failure, so the
     * day it starts being heard shows up as an improvement.
     */
    readonly unheld?: readonly string[];
  };
  readonly needs: {
    /** Every stop: Atlas must not state it is outdoors / exposed to rain. */
    readonly sheltered?: boolean;
    /** Every stop: Atlas must not exclude a young child. */
    readonly youngChildren?: boolean;
    /** Every stop within this straight-line distance of the origin. */
    readonly withinKm?: number;
    /** At least one stop at least this far from the origin. */
    readonly someStopBeyondKm?: number;
    /** The whole day, travel included, must fit in this many hours. */
    readonly fitsHours?: number;
  };
}

/** Where each town sets out from. Downtown Vancouver is Waterfront. */
export const ORIGIN_LABEL: Readonly<Record<Scenario["town"], string>> = {
  vernon: "Vernon",
  vancouver: "Vancouver",
};

export const COHORT: readonly Scenario[] = [
  {
    id: "vernon-three-hours",
    town: "vernon",
    says: "I've got three free hours this afternoon",
    brief: "Three free hours",
    hears: { hours: 3 },
    needs: { fitsHours: 3 },
  },
  {
    id: "vernon-family",
    town: "vernon",
    says: "A family adventure today with my kids, they're 5 and 8",
    brief: "Family adventure",
    hears: { childAge: true, appetite: "adventurous" },
    needs: { youngChildren: true },
  },
  {
    id: "vernon-unusual",
    town: "vernon",
    says: "Show me something unusual around Vernon",
    brief: "Something unusual",
    hears: { appetite: "odd" },
    needs: {},
  },
  {
    id: "vernon-rainy",
    town: "vernon",
    says: "It's a rainy afternoon, what can we do?",
    brief: "Rainy afternoon",
    hears: { shelter: "indoor" },
    needs: { sheltered: true },
  },
  {
    id: "vernon-longer-drive",
    town: "vernon",
    says: "Something worth a longer drive, I'm happy to go an hour or two",
    brief: "Worth a longer drive",
    hears: { reachAtLeastKm: 60 },
    needs: { someStopBeyondKm: 40 },
  },
  {
    id: "vancouver-before-meeting",
    town: "vancouver",
    says: "I have two hours before a meeting downtown",
    brief: "Two hours before a meeting",
    hears: { hours: 2, reachAtMostKm: 5, unheld: ["downtown"] },
    needs: { fitsHours: 2, withinKm: 5 },
  },
  {
    id: "vancouver-unusual-downtown",
    town: "vancouver",
    says: "Something unusual downtown",
    brief: "Something unusual downtown",
    hears: { appetite: "odd", reachAtMostKm: 5, unheld: ["downtown"] },
    needs: { withinKm: 5 },
  },
  {
    id: "vancouver-rainy-adventure",
    town: "vancouver",
    says: "Rainy-day adventure in Vancouver",
    brief: "Rainy-day adventure",
    hears: { shelter: "indoor", appetite: "adventurous" },
    needs: { sheltered: true },
  },
  {
    id: "vancouver-young-family",
    town: "vancouver",
    says: "Family day with young children, they're 3 and 6",
    brief: "Family with young children",
    hears: { childAge: true },
    needs: { youngChildren: true },
  },
  {
    id: "vancouver-colleagues-evening",
    town: "vancouver",
    says: "An evening out with colleagues after work",
    brief: "Evening with colleagues",
    hears: { unheld: ["evening", "colleagues (a group of adults)"] },
    needs: {},
  },
];
