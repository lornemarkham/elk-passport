import type { Experience } from "@/domain/experience/types";

/**
 * **What Discovery puts on the wire, and what it leaves behind.**
 *
 * `/discovery` serialises the whole pool to the browser so search, the rows
 * and the composed page can all answer without a round trip. Measured on the
 * committed Atlas fixture (2,979 candidates) that was 5.6 MB of flight data
 * in a 6.5 MB document, and most of it was **working the client never reads**:
 *
 * ```
 * environment.season         ~500 KB   a generic rule's explanation, per candidate
 * knowledge.practical        ~435 KB   labelled facts — read by the day builder, not here
 * schedule.statements        ~100 KB   the sentences behind `onDate`
 * suitability provenance      ~60 KB   sourceRecordId / seenAt / voice per statement
 * slug                        ~70 KB   a lower-cased `title`, derived by the mapper
 * ```
 *
 * Everything dropped here is **dropped, not set to `undefined`**: an
 * `undefined` prop is serialised as the literal `"$undefined"`, so the
 * previous `description: undefined` still cost 26 bytes a candidate.
 *
 * ## What this is not
 *
 * It is not a view-model and it does not change a single value the page reads.
 * `wire.test.ts` renders the real view from the full pool and from this one
 * and requires identical markup, and requires every reader of a dropped field
 * to still be absent from the Discovery client. The knowledge dropped is still
 * Atlas's, still one request away on the subject's own page, and nothing here
 * is written back anywhere.
 *
 * ## Adding a reader
 *
 * If a Discovery surface starts to read a field named below, stop dropping
 * it here — that is the whole contract, and the test exists to say so.
 */
export function forDiscoveryWire(experience: Experience): Experience {
  // `slug` is `title` lower-cased by the mapper; no Discovery surface reads it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { slug, ...rest } = experience;
  const lean: Record<string, unknown> = { ...rest };

  // **The same sentence, not shipped twice.** `candidateToExperience` sets
  // `shortDescription` and `description` to the identical Atlas string, and
  // every consumer that reads `description` concatenates `shortDescription`
  // beside it.
  if (rest.description === rest.shortDescription) delete lean.description;

  // `candidate-geography/2`'s `evidence` is the records behind the claim.
  // The claim is kept whole; its working is one request away on the
  // subject's own page.
  if (rest.geography) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { evidence, ...geography } = rest.geography;
    lean.geography = geography;
  }

  // Read: setting, rain, exposure.{value,basis}, statements (see
  // `domain/discovery/environment.ts`, `lib/ai/ask/answer.ts`). Not read:
  // `season`, or the rule and evidence behind an exposure.
  const environment = rest.environment as
    | (Record<string, unknown> & {
        exposure?: { value: unknown; basis: unknown };
      })
    | undefined;
  if (environment) {
    lean.environment = {
      ...(environment.setting !== undefined
        ? { setting: environment.setting }
        : {}),
      ...(environment.rain !== undefined ? { rain: environment.rain } : {}),
      ...(environment.exposure
        ? {
            exposure: {
              value: environment.exposure.value,
              basis: environment.exposure.basis,
            },
          }
        : {}),
      ...(environment.statements !== undefined
        ? { statements: environment.statements }
        : {}),
    };
  }

  // Read: `onDate` (`preference.ts`, `answer.ts`) and `stated`.
  const schedule = rest.schedule as
    | (Record<string, unknown> & { onDate?: unknown; stated?: unknown })
    | undefined;
  if (schedule) {
    lean.schedule = {
      ...(schedule.stated !== undefined ? { stated: schedule.stated } : {}),
      ...(schedule.onDate !== undefined ? { onDate: schedule.onDate } : {}),
    };
  }

  // Read: affordances, features, descriptionAddsKnowledge, descriptionCaveat.
  // Not read: `practical` and `conditions`, which belong to the day builder
  // and the subject's own page.
  if (rest.knowledge) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { practical, conditions, ...knowledge } = rest.knowledge;
    lean.knowledge = knowledge;
  }

  // Provenance per statement is for the subject's page, not a card.
  if (rest.suitability?.statements) {
    lean.suitability = {
      ...rest.suitability,
      statements: rest.suitability.statements.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ sourceRecordId, seenAt, voice, ...statement }) => statement,
      ),
    };
  }

  return withoutUndefined(lean) as unknown as Experience;
}

/**
 * **A key holding `undefined` is a key that costs bytes.** The mapper leaves
 * `startTime`, `endTime`, `timePrecision` and a dozen more as `undefined` on
 * most candidates; across the server boundary each becomes `"$undefined"`,
 * ~14 bytes a key a candidate. A missing key and an `undefined` one read the
 * same everywhere Discovery looks (`x.y`, `x?.y`, `??`), and the render test
 * holds the page to it.
 */
function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, withoutUndefined(v)]),
  );
}
