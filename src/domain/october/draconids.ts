/**
 * **The Draconids, as a thing to care about rather than a record to read.**
 *
 * A detail page answers *what is this*. It is very good at that and it should
 * keep doing it. What it cannot do is answer the question somebody actually
 * has first, which is *why would I stand outside in the cold for this* — and
 * the honest answer for the Draconids is specific, surprising, and already in
 * Atlas:
 *
 * > **Radiant: highest in the sky in the evening hours.**
 *
 * Almost every meteor shower asks you to be awake at three in the morning.
 * This one does not. That is the whole hook, and nobody reading a facts table
 * would ever notice it.
 *
 * ## Every claim here is Atlas's, and says so
 *
 * A beat either carries a `fact` — the label and value exactly as Atlas holds
 * them, attributed to the source Atlas recorded — or it carries no claim at
 * all. The connective lines are framing, not assertions: "something is
 * happening above you" is true of every night.
 *
 * Nothing here promises a sighting. The expectation beat exists precisely to
 * stop the rest of it from over-promising: ten an hour, under ideal
 * conditions, is what the source says and it is not a storm.
 */

export interface DraconidFact {
  /** Atlas's own label, verbatim. */
  readonly label: string;
  /** Atlas's own value, verbatim. */
  readonly value: string;
}

export interface Beat {
  readonly id: string;
  /** The line that carries the beat. Framing, never a factual claim. */
  readonly line: string;
  /** A quieter second line, where one helps. */
  readonly under?: string;
  /** Atlas's fact for this beat, shown as evidence under the framing. */
  readonly fact?: DraconidFact;
  /** Which illustration the stage draws behind it. */
  readonly art: "sky" | "radiant" | "evening" | "scale" | "yours";
}

/** The Atlas labels this experience reads, in the order it needs them. */
export const NEEDED_FACTS = [
  "Radiant",
  "Expected meteors at peak, under ideal conditions",
  "Nearest moon phase",
  "When to watch",
  "Predicted peak",
  "Overall duration of shower",
] as const;

/**
 * Builds the sequence from whatever Atlas actually holds.
 *
 * A beat whose fact is missing is **dropped**, not padded — if Atlas stops
 * carrying the radiant fact, the beat that exists to deliver it stops
 * existing, rather than becoming a sentence Passport made up.
 */
export function beatsFor(
  facts: readonly DraconidFact[],
  window: { readonly from?: string; readonly to?: string },
): readonly Beat[] {
  const byLabel = new Map(facts.map((f) => [f.label, f] as const));
  const fact = (label: string) => byLabel.get(label);

  const beats: Beat[] = [];

  beats.push({
    id: "open",
    line: "Something is going on above you this week.",
    under: window.from && window.to ? undefined : "Early October.",
    art: "sky",
    ...(fact("Overall duration of shower")
      ? { fact: fact("Overall duration of shower")! }
      : {}),
  });

  beats.push({
    id: "dragon",
    line: "They come out of the dragon.",
    under:
      "The point they appear to radiate from sits in Draco — which is where the shower gets its name.",
    art: "radiant",
  });

  const radiant = fact("Radiant");
  if (radiant) {
    beats.push({
      id: "evening",
      line: "And you don't have to stay up for it.",
      under:
        "Nearly every meteor shower is a three-in-the-morning proposition. This one is highest while you are still awake.",
      fact: radiant,
      art: "evening",
    });
  }

  const rate = fact("Expected meteors at peak, under ideal conditions");
  if (rate) {
    beats.push({
      id: "scale",
      line: "Don't expect a storm.",
      under:
        "This is a quiet one. Ten in an hour is the good version, and only if everything cooperates.",
      fact: rate,
      art: "scale",
    });
  }

  const moon = fact("Nearest moon phase");
  if (moon) {
    beats.push({
      id: "moon",
      line: "This year the moon mostly stays out of the way.",
      under:
        "A bright moon washes out everything but the best of them. Not this time.",
      fact: moon,
      art: "sky",
    });
  }

  const best = fact("When to watch") ?? fact("Predicted peak");
  if (best) {
    beats.push({
      id: "when",
      line: "If you only go out once —",
      fact: best,
      art: "sky",
    });
  }

  beats.push({
    id: "yours",
    line: "So — what does your night look like?",
    art: "yours",
  });

  return beats;
}
