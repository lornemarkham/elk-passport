import { z } from "zod";
import {
  ACTIVITY_KINDS,
  KINDS,
  LIMITS,
  type ActivityKind,
  type Audience,
  type MeetingPoint,
} from "./types";
import { zonedToUtc } from "./time";

/**
 * **Reading what an organiser typed into a plan.**
 *
 * One time for every chosen day is how the morning walk was organised
 * ("Tuesday 7:00, Wednesday 7:00"), so the form asks for days and a time;
 * a plan can carry up to 14 occurrences. Days are checked against the
 * conference's dates with a week either side, because people arrive early and
 * stay on, but a "morning walk" in March is a typo.
 */

const placeId = z
  .string()
  .trim()
  .max(200)
  .regex(/^[\w:.\-/]+$/, "Not a place id");

const text = (max: number) => z.string().trim().max(max);

export const PlanInputSchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  title: text(LIMITS.title).min(1, "Give it a name"),
  description: text(LIMITS.description).default(""),
  days: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Not a date"))
    .min(1, "Pick at least one day")
    .max(LIMITS.occurrences, `At most ${LIMITS.occurrences} days`),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Not a time"),
  meeting: text(LIMITS.meeting).default(""),
  meetingPlaceId: placeId.optional().or(z.literal("")),
  venueId: placeId.optional().or(z.literal("")),
  audience: z.enum(["everyone", "selected"]).default("everyone"),
  invited: z.array(z.string().max(64)).max(LIMITS.invited).default([]),
});

export interface PlanInput {
  readonly kind: ActivityKind;
  readonly title: string;
  readonly description: string;
  /** UTC instants, sorted, one per chosen day. */
  readonly starts: readonly string[];
  readonly meeting: MeetingPoint | null;
  readonly venueId: string | null;
  readonly audience: Audience;
  readonly invited: readonly string[];
}

export type Issues = readonly { path: string; message: string }[];

const DAY = 86_400_000;
const dayMs = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);

export function parsePlanInput(
  input: unknown,
  conference: { timeZone: string; startsOn: string; endsOn?: string },
): { ok: true; value: PlanInput } | { ok: false; issues: Issues } {
  const r = PlanInputSchema.safeParse(input);
  if (!r.success)
    return {
      ok: false,
      issues: r.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  const v = r.data;
  const from = dayMs(conference.startsOn) - 7 * DAY;
  const to = dayMs(conference.endsOn ?? conference.startsOn) + 7 * DAY;
  const days = [...new Set(v.days)].sort();
  const outside = days.filter((d) => dayMs(d) < from || dayMs(d) > to);
  if (outside.length)
    return {
      ok: false,
      issues: [
        {
          path: "days",
          message: "Pick days around the conference (a week either side)",
        },
      ],
    };
  const starts = days.map((d) =>
    zonedToUtc(d, v.time, conference.timeZone)!.toISOString(),
  );
  const label = v.meeting;
  return {
    ok: true,
    value: {
      kind: v.kind,
      title: v.title,
      description: v.description,
      starts,
      meeting: label
        ? {
            label,
            ...(v.meetingPlaceId ? { placeId: v.meetingPlaceId } : {}),
          }
        : null,
      venueId: v.venueId || null,
      audience: v.audience,
      invited: v.audience === "selected" ? [...new Set(v.invited)] : [],
    },
  };
}

/** A title when the organiser leaves the kind's example in place. */
export const exampleTitle = (kind: ActivityKind) => KINDS[kind].example;
