import type { Experience } from "@/domain/experience/types";
import type { SuitabilityForAge, SuitabilityStatement } from "@/lib/data/types";

/**
 * **Whether a particular child is welcome here, answered by Atlas.**
 *
 * What this replaces: `CHILD_DOABLE` in `situation.ts` — a hardcoded list of
 * fourteen affordance words (`playground`, `swimming`, `skating`…) that
 * Passport treated as evidence a five-year-old would be fine. It was the last
 * place Passport was guessing about people, and it is the same shape as the
 * `PLAINLY_OUTDOOR` list that called a picnic shelter outdoor.
 *
 * It was wrong in both directions. A tennis court is "child-doable" by that
 * list; a 19+ brewery with a playground out the back would have been too. And
 * it had nothing to say about **Jump2it Indoor Playground**, which states
 * *"Activities for children up to 9 years old"* — real, stated, and invisible
 * to a word list.
 *
 * ## The verdicts, and what each may be rendered as
 *
 * `candidate-suitability/1` answers `?childAge=N` with a reading per subject.
 * Measured for a five-year-old across 2,680 candidates:
 *
 * ```
 * welcome      stated 10 · part-stated 3      a rule admits this age
 * described    characterised 137              described in a way that implies it
 * priced       priced 11                      a price band names this age
 * excluded     excluded 16 · advised-against 1
 * other-ages   stated-other-ages 7           named for other ages, not barred
 * unclear      conflicting 1                  the evidence disagrees
 * unknown      2,494                          Atlas has no evidence either way
 * ```
 *
 * **`characterised` is not `stated`.** Ten subjects carry a rule that admits a
 * five-year-old; a hundred and thirty-seven merely read as family-ish. Showing
 * those as the same claim is how a product sends somebody to a 19+ venue
 * because the copy mentioned families, so they are kept apart here and said
 * differently on screen.
 *
 * **`unknown` is 93% and means nothing at all.** Not suitable, not unsuitable.
 */
export type AgeVerdict =
  | "welcome"
  | "described"
  | "priced"
  /** A stated **rule** shuts this age out. */
  | "excluded"
  /**
   * **Atlas names ages, and not this one — without shutting this one out.**
   *
   * This was mapped to `excluded`, and that was wrong. Measured on production
   * for a five-year-old, `stated-other-ages` is:
   *
   * ```
   * Winfield Arena      "the location where Adult Shinny (18+) games are held"
   * Another World VR    "Perfect for families with kids ages 6 and up"
   * Baby Story Time     "a free drop-in programme for babies under 2"
   * ```
   *
   * The arena is not closed to a five-year-old; one activity held there is
   * 18+. The VR place is characterised for six and up, not barred below it.
   * Treating any of those as a rule removed real, open venues from a parent's
   * answer — and Atlas reserves `excluded` for `strength: rule` ("ALL GUESTS
   * MUST BE 16+", "19+/No Minors"), which these are not.
   *
   * So it is its own answer: still offered, and labelled for what it is.
   */
  | "other-ages"
  | "unclear"
  | "unknown";

const VERDICTS: Readonly<Record<string, AgeVerdict>> = {
  stated: "welcome",
  "part-stated": "welcome",
  characterised: "described",
  priced: "priced",
  excluded: "excluded",
  "advised-against": "excluded",
  // **Not `excluded`.** See `AgeVerdict`: Atlas reserves `excluded` for a
  // stated rule, and this is a statement about other ages that does not bar
  // this one.
  "stated-other-ages": "other-ages",
  conflicting: "unclear",
};

export interface AgeEvidence {
  readonly verdict: AgeVerdict;
  /** The age Atlas was asked about, so nothing can be shown for another. */
  readonly age?: number;
  /** Atlas's own word, kept so a surface can be specific where it matters. */
  readonly reading?: string;
  /** The statements the verdict rests on, in their sources' words. */
  readonly statements: readonly SuitabilityStatement[];
}

const NOTHING: AgeEvidence = { verdict: "unknown", statements: [] };

/**
 * Read the verdict for the age Atlas was asked about.
 *
 * `undefined` where nobody asked — and **never** a verdict for a different
 * age than the one requested, which is the quiet way a product starts
 * answering about a five-year-old with evidence about a twelve-year-old.
 */
export function ageEvidence(
  experience: Experience,
  askedAge: number | undefined,
): AgeEvidence {
  const suitability = experience.suitability;
  const forAge: SuitabilityForAge | undefined = suitability?.forAge;
  if (askedAge === undefined || !forAge || forAge.age !== askedAge) {
    return NOTHING;
  }
  const all = suitability?.statements ?? [];
  const statements = (forAge.because ?? [])
    .map((index) => all[index])
    .filter((statement): statement is SuitabilityStatement =>
      Boolean(statement),
    );
  return {
    verdict: VERDICTS[forAge.reading] ?? "unknown",
    age: forAge.age,
    reading: forAge.reading,
    statements,
  };
}

/** Whether Atlas says a rule shuts this age out. Only a rule — never silence. */
export const excludesAge = (
  experience: Experience,
  askedAge: number | undefined,
): boolean => ageEvidence(experience, askedAge).verdict === "excluded";

/**
 * Whether Atlas says anything at all that bears on this age.
 *
 * `unknown` is not evidence, so it is not an answer — it is the reason the
 * surface has to admit how little is known.
 */
export const speaksToAge = (
  experience: Experience,
  askedAge: number | undefined,
): boolean => ageEvidence(experience, askedAge).verdict !== "unknown";

export interface AgeSplit {
  /** A stated rule admits this age. */
  readonly welcome: readonly Experience[];
  /** Described in a way that implies it. Weaker, and said as weaker. */
  readonly described: readonly Experience[];
  /** A price band names this age — evidence of admission, not of suitability. */
  readonly priced: readonly Experience[];
  /** A rule shuts this age out, or advises against. */
  readonly excluded: readonly Experience[];
  /** Atlas names ages, and not this one — without barring it. */
  readonly otherAges: readonly Experience[];
  /** Atlas's evidence disagrees with itself and it will not pick. */
  readonly unclear: readonly Experience[];
  /** No evidence either way. 93% of the corpus for a five-year-old. */
  readonly unknown: readonly Experience[];
}

export function splitByAge(
  experiences: readonly Experience[],
  askedAge: number | undefined,
): AgeSplit {
  const out: Record<AgeVerdict, Experience[]> = {
    welcome: [],
    described: [],
    priced: [],
    excluded: [],
    "other-ages": [],
    unclear: [],
    unknown: [],
  };
  for (const experience of experiences) {
    out[ageEvidence(experience, askedAge).verdict].push(experience);
  }
  return { ...out, otherAges: out["other-ages"] };
}

/**
 * **What a person is told, and how firmly.**
 *
 * Never a bare "suitable". A rule and a turn of phrase are different claims,
 * and the whole value of this contract is that Atlas distinguishes them.
 */
export function ageLine(
  experience: Experience,
  askedAge: number | undefined,
): string | undefined {
  const { verdict, age } = ageEvidence(experience, askedAge);
  if (age === undefined) return undefined;
  switch (verdict) {
    case "welcome":
      return `Admits ${age}-year-olds`;
    case "described":
      // Deliberately hedged. It is a description, not a rule.
      return `Described for families — no stated age rule`;
    case "priced":
      return `Has a price for a ${age}-year-old`;
    case "excluded":
      return `Not for a ${age}-year-old`;
    case "other-ages":
      // Said as what it is: a statement about other ages, not a closed door.
      return `Atlas states other ages for this — not a rule against ${age}`;
    case "unclear":
      return `Atlas's evidence disagrees about ${age}-year-olds`;
    default:
      return undefined;
  }
}

/** The sentence Atlas read the verdict from, where there is one. */
export function ageBecause(
  experience: Experience,
  askedAge: number | undefined,
): string | undefined {
  const [first] = ageEvidence(experience, askedAge).statements;
  return first?.text?.trim() || undefined;
}

/**
 * Whether an adult must be with them, where Atlas states that as a rule.
 *
 * Twenty subjects carry a `supervision` statement — *"Guests under 12 must be
 * accompanied by an adult"*. Worth saying out loud to somebody planning a day,
 * and never inferred from anything else.
 */
export function needsAdult(
  experience: Experience,
  askedAge: number | undefined,
): string | undefined {
  if (askedAge === undefined) return undefined;
  const statement = (experience.suitability?.statements ?? []).find(
    (candidate) =>
      candidate.about === "supervision" && withinAges(candidate.ages, askedAge),
  );
  return statement?.text?.trim() || undefined;
}

const withinAges = (
  ages: { min?: number; max?: number } | undefined,
  age: number,
): boolean => {
  if (!ages) return false;
  if (ages.min !== undefined && age < ages.min) return false;
  if (ages.max !== undefined && age > ages.max) return false;
  return true;
};
