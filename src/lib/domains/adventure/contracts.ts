import { z } from "zod";
import type { ExperienceKind } from "@/domain/experience/types";
import type { AgeVerdict } from "@/domain/discovery/suitability";

/**
 * **The Adventure contract for Go have a day.**
 *
 * One saved, printable, remixable shape for "a day made of things that
 * actually exist". It is built *from* what `src/domain/day/` already produces
 * (`DayBrief`, `DayPlanned`, `DayStop` — see `fromDay.ts`) rather than beside
 * it, and it changes none of it. `docs/domain/current-model.md` §5 lists three
 * day-of-stops shapes that share no code; this is meant to be the one that
 * leaves the screen — to storage, to paper, to a remix.
 *
 * ## What it deliberately does not hold
 *
 * - **No lifecycle status.** Wanted / planned / lived is doctrine §15 Q3 and
 *   Q14, open. Nothing here names those states; a persisted Adventure is a
 *   plan's content, and what the person has done with it belongs elsewhere.
 * - **No drive times.** Passport has no routing provider. Distances are
 *   straight-line and say so; a travel time can only be `known` when a routing
 *   provider is named as its source (see `feasibility.ts`).
 * - **No opening hours, prices or age rules Atlas did not state.** Each is a
 *   `Reading`, and `unknown` is an answer, not a gap to fill.
 *
 * ## Name clash, named
 *
 * `src/lib/schemas.ts` already exports an `Adventure` and a `Moment` for the
 * legacy `/plan → /adventure` flow, where a Moment is a captured memory (a
 * note or a photo). Here a Moment is **one part of the day**. They are
 * different things with the same word; this module does not touch the legacy
 * ones, and which word survives is for whoever retires that flow.
 */

// ---------------------------------------------------------------------------
// Evidence and uncertainty
// ---------------------------------------------------------------------------

/**
 * **Who says so.** Doctrine §5: signals are evidence, inference is inference,
 * confirmed state is state — and the system keeps them apart all the way down.
 *
 * - `person` — they said it. The strongest thing Passport has.
 * - `atlas` — Atlas states it; `contract` names the read it came from
 *   (`candidate-schedule/1`), so provenance survives into Passport.
 * - `plan` — Passport's own arithmetic (`method` says which). A plan dividing
 *   four hours by three stops is a fact about the plan, never about a venue.
 * - `model` — a generative reading. Inference, and labelled as such.
 * - `routing` — a routing provider. **None is configured today**; this is the
 *   only source a travel time may carry.
 */
export const evidenceSourceSchema = z.discriminatedUnion("by", [
  z.object({ by: z.literal("person") }),
  z.object({ by: z.literal("atlas"), contract: z.string().min(1).optional() }),
  z.object({ by: z.literal("plan"), method: z.string().min(1) }),
  z.object({ by: z.literal("model"), model: z.string().min(1).optional() }),
  z.object({ by: z.literal("routing"), provider: z.string().min(1) }),
]);
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;

/**
 * **A value, or an honest statement that there isn't one.**
 *
 * `unknown` and `conflicting` carry a reason because a guide has to say *why*
 * it is silent. There is no "probably": a model's guess is `known` with
 * `source.by === "model"`, and anything reading it can tell.
 */
export type Reading<T> =
  | {
      readonly state: "known";
      readonly value: T;
      readonly source: EvidenceSource;
      /** The source's own words for why, where it gave any. */
      readonly basis?: string;
    }
  | { readonly state: "unknown"; readonly because: string }
  | { readonly state: "conflicting"; readonly because: string };

export function readingSchema<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion("state", [
    z.object({
      state: z.literal("known"),
      value,
      source: evidenceSourceSchema,
      basis: z.string().min(1).optional(),
    }),
    z.object({ state: z.literal("unknown"), because: z.string().min(1) }),
    z.object({ state: z.literal("conflicting"), because: z.string().min(1) }),
  ]);
}

export const unknown = (because: string): Reading<never> => ({
  state: "unknown",
  because,
});

// ---------------------------------------------------------------------------
// Where
// ---------------------------------------------------------------------------

/**
 * Structurally the same as `Point` in `src/domain/discovery/situation.ts`, so
 * either passes for the other. Named fields, never a tuple: the lon-first
 * order of Atlas's coordinates is converted once, in `fromDay.ts`.
 */
export const pointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type AdventurePoint = z.infer<typeof pointSchema>;

/** Where the day sets out from. A known town, or a name and nothing more. */
export const originSchema = z.object({
  name: z.string().min(1).max(120),
  /** A `DiscoveryTown` id (`vernon`), where it is one. */
  townId: z.string().min(1).max(60).optional(),
  point: pointSchema.optional(),
});
export type AdventureOrigin = z.infer<typeof originSchema>;

// ---------------------------------------------------------------------------
// Companions / party
// ---------------------------------------------------------------------------

/**
 * **Somebody coming along**, besides the person planning.
 *
 * Only what was said: "with a five-year-old" is one child aged five; "with
 * the kids" is not two children, and "family" is not a child at all.
 */
export const companionSchema = z
  .object({
    role: z.enum(["adult", "child"]),
    /** Whole years, only where a number was actually given. */
    age: z.number().int().min(0).max(120).optional(),
    name: z.string().min(1).max(60).optional(),
  })
  .refine((c) => c.role !== "child" || c.age === undefined || c.age <= 17, {
    message: "A child's age must be 17 or under",
    path: ["age"],
  });
export type Companion = z.infer<typeof companionSchema>;

export const partySchema = z.object({
  companions: z.array(companionSchema).max(30).default([]),
  /**
   * Needs in the person's own words — "allergic to shellfish", "no stairs".
   * Passport cannot check most of these against Atlas, and feasibility says
   * so rather than ignoring them.
   */
  needs: z.array(z.string().min(1).max(140)).max(20).default([]),
});
export type Party = z.infer<typeof partySchema>;

// ---------------------------------------------------------------------------
// Time and budget
// ---------------------------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `HH:MM` → minutes after midnight. */
export const clockMinutes = (clock: string): number => {
  const [h, m] = clock.split(":").map(Number);
  return h! * 60 + m!;
};

/**
 * **The time the person has.** Every field is optional because constraints
 * are progressive (doctrine §4): a day can be shaped before anybody says how
 * long it is.
 *
 * Clock times are local wall-clock times in the day's own timezone — today
 * that is always `America/Vancouver`, the only one Atlas holds. A window may
 * not cross midnight.
 */
export const timeWindowSchema = z
  .object({
    /** `YYYY-MM-DD`. */
    on: z.string().regex(DATE).optional(),
    /** Hours available, as said. */
    hours: z.number().positive().max(24).optional(),
    /** `HH:MM` — when they can leave. */
    startAt: z.string().regex(CLOCK).optional(),
    /** `HH:MM` — when they must be home. */
    homeBy: z.string().regex(CLOCK).optional(),
  })
  .refine(
    (t) =>
      !t.startAt ||
      !t.homeBy ||
      clockMinutes(t.startAt) < clockMinutes(t.homeBy),
    {
      message: "homeBy must be after startAt on the same day",
      path: ["homeBy"],
    },
  );
export type TimeWindow = z.infer<typeof timeWindowSchema>;

/**
 * Minutes the person has, from what they said: the tighter of `hours` and
 * `startAt → homeBy`. `undefined` where they have not said.
 */
export function availableMinutes(time: TimeWindow): number | undefined {
  const fromHours = time.hours !== undefined ? time.hours * 60 : undefined;
  const fromClock =
    time.startAt && time.homeBy
      ? clockMinutes(time.homeBy) - clockMinutes(time.startAt)
      : undefined;
  if (fromHours === undefined) return fromClock;
  if (fromClock === undefined) return fromHours;
  return Math.min(fromHours, fromClock);
}

/** Dollars, total, for everybody — the same unit as `DayBrief.budget`. */
export const budgetSchema = z.object({
  maxDollars: z.number().min(0).max(100_000),
});
export type Budget = z.infer<typeof budgetSchema>;

export const constraintsSchema = z.object({
  time: timeWindowSchema.default({}),
  budget: budgetSchema.optional(),
  party: partySchema.default({ companions: [], needs: [] }),
  origin: originSchema.optional(),
  /** How far they said they would go, km. Straight-line is the shortest any road can be. */
  withinKm: z.number().positive().max(1000).optional(),
});
export type AdventureConstraints = z.infer<typeof constraintsSchema>;

// ---------------------------------------------------------------------------
// Moments
// ---------------------------------------------------------------------------

const EXPERIENCE_KINDS = [
  "Place",
  "Organization",
  "Activity",
  "Event",
  "Experience",
] as const satisfies readonly ExperienceKind[];

/** The Atlas subject a moment is at. The title is a snapshot, so paper works offline. */
export const subjectRefSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(EXPERIENCE_KINDS),
  title: z.string().min(1).max(300),
});
export type SubjectRef = z.infer<typeof subjectRefSchema>;

/** What Atlas stated about the chosen day — `candidate-schedule/1`'s `onDate`. */
export const openingSchema = z.object({
  date: z.string().regex(DATE),
  open: z.boolean(),
});

/**
 * A published price. `dollars` is the **total for the party**, and is set only
 * where that is unambiguous — in practice, a place that says it is free. "$12
 * adults" is a price; it is not a total for three people, and it is not
 * multiplied into one.
 */
export const costSchema = z.object({
  text: z.string().min(1).max(1000),
  dollars: z.number().min(0).optional(),
});

const AGE_VERDICTS = [
  "welcome",
  "described",
  "priced",
  "excluded",
  "other-ages",
] as const satisfies readonly AgeVerdict[];

/** Atlas's verdict for one asked-about age. `unclear` and `unknown` are reading states, not values. */
export const suitabilitySchema = z.object({
  age: z.number().int().min(0).max(17),
  verdict: z.enum(AGE_VERDICTS),
});

const momentCommon = {
  /** Stable within the adventure. A subject moment uses the subject id. */
  id: z.string().min(1).max(120),
  /** What the guide calls it. */
  label: z.string().min(1).max(300),
  /**
   * **Minutes this plan sets aside.** The plan's division of the person's own
   * time — never a claim about how long the place takes.
   */
  minutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  /** Why this one is here, in a sentence a person would say. */
  because: z.string().min(1).max(500).optional(),
  /** Rules worth knowing before you leave the house, in the publisher's words. */
  notes: z.array(z.string().min(1).max(1000)).max(40).default([]),
  /** Something to do there that is not looking at a phone. */
  challenge: z.string().min(1).max(500).optional(),
  /**
   * The person said keep this one. A remix must leave it alone — doctrine
   * §2.5, "just adjust those two things".
   */
  pinned: z.boolean().optional(),
};

/** A moment at a real Atlas subject. Every reading is required: silence is spelled `unknown`. */
export const subjectMomentSchema = z.object({
  kind: z.literal("subject"),
  ...momentCommon,
  subject: subjectRefSchema,
  point: readingSchema(pointSchema),
  open: readingSchema(openingSchema),
  cost: readingSchema(costSchema),
  /** Present only where somebody asked about a child's age. */
  suitability: readingSchema(suitabilitySchema).optional(),
});

/**
 * Time the person keeps for themselves — "lunch, wherever looks good". It has
 * no place, so it has no point, no hours and no price, and it is never given
 * one.
 */
export const freeMomentSchema = z.object({
  kind: z.literal("free"),
  ...momentCommon,
});

export const momentSchema = z.discriminatedUnion("kind", [
  subjectMomentSchema,
  freeMomentSchema,
]);
export type Moment = z.infer<typeof momentSchema>;
export type SubjectMoment = z.infer<typeof subjectMomentSchema>;
export type FreeMoment = z.infer<typeof freeMomentSchema>;

// ---------------------------------------------------------------------------
// Adventure
// ---------------------------------------------------------------------------

export const ADVENTURE_VERSION = 1 as const;

export const adventureSchema = z
  .object({
    /** Bumped when a saved adventure would no longer parse. */
    version: z.literal(ADVENTURE_VERSION),
    id: z.string().min(1).max(120),
    createdAt: z.iso.datetime({ offset: true }),
    /** The sentence as typed. A remix re-reads it; the guide quotes it back. */
    said: z.string().max(2000),
    title: z.string().min(1).max(500),
    constraints: constraintsSchema,
    /** In the order they will be done. */
    moments: z.array(momentSchema).min(1).max(12),
    /** What the plan could not find out, named rather than left blank. */
    unknowns: z.array(z.string().min(1).max(280)).max(20).default([]),
    /** What put this day together. */
    builtBy: evidenceSourceSchema,
    /** The adventure this one was remixed from. */
    remixOf: z.string().min(1).max(120).optional(),
  })
  .superRefine((adventure, ctx) => {
    const seen = new Set<string>();
    adventure.moments.forEach((moment, index) => {
      if (seen.has(moment.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate moment id "${moment.id}"`,
          path: ["moments", index, "id"],
        });
      }
      seen.add(moment.id);
    });
    if (adventure.remixOf === adventure.id) {
      ctx.addIssue({
        code: "custom",
        message: "An adventure cannot be a remix of itself",
        path: ["remixOf"],
      });
    }
  });
export type Adventure = z.infer<typeof adventureSchema>;

/** Read a saved adventure back. Anything that does not parse is not an adventure. */
export function parseAdventure(
  input: unknown,
): { ok: true; adventure: Adventure } | { ok: false; error: z.ZodError } {
  const result = adventureSchema.safeParse(input);
  return result.success
    ? { ok: true, adventure: result.data }
    : { ok: false, error: result.error };
}

/**
 * **What a remix broke.** Empty means it is a faithful remix of `parent`: it
 * names its parent, and every pinned moment survives with the same subject
 * and the same time set aside.
 */
export function remixProblems(parent: Adventure, child: Adventure): string[] {
  const problems: string[] = [];
  if (child.remixOf !== parent.id) {
    problems.push(`remixOf is "${child.remixOf ?? ""}", not "${parent.id}"`);
  }
  const kept = new Map(child.moments.map((m) => [m.id, m]));
  for (const moment of parent.moments) {
    if (!moment.pinned) continue;
    const after = kept.get(moment.id);
    if (!after) {
      problems.push(`Pinned moment "${moment.label}" was removed`);
      continue;
    }
    const subjectOf = (m: Moment) =>
      m.kind === "subject" ? m.subject.id : null;
    if (after.kind !== moment.kind || subjectOf(after) !== subjectOf(moment)) {
      problems.push(`Pinned moment "${moment.label}" was replaced`);
    } else if (after.minutes !== moment.minutes) {
      problems.push(`Pinned moment "${moment.label}" changed its time`);
    }
  }
  return problems;
}
