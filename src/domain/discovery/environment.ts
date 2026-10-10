import type { Experience } from "@/domain/experience/types";
import type {
  EnvironmentBasis,
  EnvironmentStatement,
  RainReading,
} from "@/lib/data/types";

/**
 * **What the rain does to a possibility, read from Atlas rather than guessed.**
 *
 * What this replaces: Passport held a set of words it considered "plainly
 * outdoor" and matched activity names against it. The set contained
 * `picnic shelter`. So Coldstream Park, Kin Beach, Polson Park and
 * Paddlewheel Park — each of which Atlas now says is **partly sheltered**,
 * because each has a picnic shelter — were all reported as ruled out by the
 * rain, on the evidence of the shelter. The Allan Brooks Nature Centre, which
 * Atlas says is **indoor**, was called outdoors because it offers
 * birdwatching. Seven candidates were wrong in that direction, and every one
 * of them was wrong in the way that matters: it hid somewhere dry on a wet day.
 *
 * `candidate-environment/1` states it instead, with the evidence attached.
 *
 * ## The readings are not a scale
 *
 * They are four different kinds of answer and are deliberately not collapsed
 * into one:
 *
 * ```
 * stands up to it   sheltered · partly-sheltered · runs-in-rain
 * argues against    exposed
 * may not happen    weather-dependent      ← a different worry entirely
 * no answer         unknown · conflicting
 * ```
 *
 * `weather-dependent` is the one most easily lost. *"Open daily, weather
 * dependent"* is not a claim about shelter; it is a warning that the thing may
 * not be running at all. Filed under either neighbour it stops being useful.
 *
 * ## `unknown` is 95% of the corpus and stays empty
 *
 * 2,561 of 2,683 candidates have no reading. That is not *outdoor*, not
 * *fine*, and not *unsuitable*. Every function here keeps it in its own
 * bucket, and the one thing Passport may conclude from it is that Passport
 * does not know.
 */
export interface RainEvidence {
  readonly reading: RainReading;
  readonly basis: EnvironmentBasis;
  /** The sentences behind it, in their sources' words. Held for 154 subjects. */
  readonly statements: readonly EnvironmentStatement[];
}

const NOTHING: RainEvidence = {
  reading: "unknown",
  basis: "none",
  statements: [],
};

export function rainEvidence(experience: Experience): RainEvidence {
  const environment = experience.environment;
  if (!environment?.rain) return NOTHING;
  return {
    reading: environment.rain.reading,
    basis: environment.rain.basis,
    statements: environment.statements ?? [],
  };
}

/**
 * **Whether a wet day argues against this.**
 *
 * Only `exposed`. Not `weather-dependent` — that is a question of whether it
 * is running, and the previous version of this product would have had to
 * guess which. Emphatically not `unknown`, which is the answer for 95% of the
 * corpus and would turn an admission into an accusation.
 */
export function arguesAgainst(experience: Experience): boolean {
  return rainEvidence(experience).reading === "exposed";
}

/**
 * **Whether Atlas says the rain does not stop this.**
 *
 * The three readings that mean somewhere to be when it is wet — under cover,
 * partly under cover, or happening regardless. Nothing else qualifies, and a
 * candidate Atlas says nothing about never does.
 */
export function standsUpToRain(experience: Experience): boolean {
  const { reading } = rainEvidence(experience);
  return (
    reading === "sheltered" ||
    reading === "partly-sheltered" ||
    reading === "runs-in-rain"
  );
}

/** Whether Atlas warns this may simply not be running. */
export function mayNotRun(experience: Experience): boolean {
  return rainEvidence(experience).reading === "weather-dependent";
}

/** Whether Atlas has any answer at all. `conflicting` counts as none. */
export function placedByWeather(experience: Experience): boolean {
  const { reading } = rainEvidence(experience);
  return reading !== "unknown" && reading !== "conflicting";
}

export interface RainSplit {
  /** Sheltered, partly sheltered, or running anyway. */
  readonly stands: readonly Experience[];
  /** Exposed. */
  readonly against: readonly Experience[];
  /** Weather-dependent: it may not be on. */
  readonly uncertain: readonly Experience[];
  /** Atlas says nothing, or says its evidence disagrees. Never reassigned. */
  readonly unknown: readonly Experience[];
}

/**
 * The four buckets, counted once so a surface can state them rather than imply
 * them.
 *
 * Measured over the 83 candidates with evidence a child could do something:
 * `unknown 63 · exposed 7 · partly-sheltered 6 · weather-dependent 3 ·
 * sheltered 3 · runs-in-rain 1`. The honest shape of a wet afternoon is that
 * Passport knows about twenty of them and not about sixty-three.
 */
export function splitByRain(experiences: readonly Experience[]): RainSplit {
  const stands: Experience[] = [];
  const against: Experience[] = [];
  const uncertain: Experience[] = [];
  const unknown: Experience[] = [];
  for (const experience of experiences) {
    if (standsUpToRain(experience)) stands.push(experience);
    else if (arguesAgainst(experience)) against.push(experience);
    else if (mayNotRun(experience)) uncertain.push(experience);
    else unknown.push(experience);
  }
  return { stands, against, uncertain, unknown };
}

/**
 * **What a person is told, and how firmly.**
 *
 * A `derived` reading is Atlas joining its own evidence; a `stated` one is a
 * source saying it outright. The difference is the difference between *there
 * is a picnic shelter here* and *the rink is weather dependent*, and a surface
 * that printed both as fact would be presenting an inference as a promise.
 * `undefined` wherever Atlas has no reading, so nothing can be rendered.
 */
export function rainLine(experience: Experience): string | undefined {
  const { reading, basis } = rainEvidence(experience);
  const said = SAYS[reading];
  if (!said) return undefined;
  // Atlas worked it out rather than being told. Said as a reading, not a fact.
  return basis === "derived" ? `${said}, going by what Atlas holds` : said;
}

const SAYS: Partial<Record<RainReading, string>> = {
  sheltered: "Under cover",
  "partly-sheltered": "Has somewhere to shelter",
  "runs-in-rain": "Runs in the rain",
  "weather-dependent": "May not run in bad weather",
  exposed: "Out in the open",
};

/**
 * The sentence Atlas read it from, where there is one worth showing.
 *
 * Shown rather than summarised. *"Opening hours: Open daily from dusk to dawn
 * March-November (weather dependent)"* tells somebody more about their evening
 * than any label Passport could put on it, and it cannot be accused of being
 * Passport's opinion.
 */
export function rainBecause(experience: Experience): string | undefined {
  const [first] = rainEvidence(experience).statements;
  return first?.text?.trim() || undefined;
}
