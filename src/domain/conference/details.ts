import { z } from "zod";
import {
  CONFERENCE_KINDS,
  MODULE_IDS,
  type ConferenceDetails,
  type ConferenceKind,
} from "./types";

/**
 * **What an organiser may say about their conference, checked.**
 *
 * One schema for create and edit, so the two can't drift. Strings are
 * trimmed and empty optional strings become absent, because a blank tagline
 * should not render as an empty line.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const realDay = (s: string) =>
  DAY.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
    ? new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
    : false;

const realZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s ? s : undefined));

export const detailsSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name.").max(80),
    kind: z.enum(CONFERENCE_KINDS).default("conference"),
    tagline: optionalText(120),
    welcome: optionalText(600),
    place: z.object({
      label: z.string().trim().min(1, "Say where it is.").max(80),
      townId: optionalText(60),
    }),
    timeZone: z.string().refine(realZone, "Not a time zone."),
    startsOn: z.string().refine(realDay, "Not a date."),
    endsOn: z
      .string()
      .optional()
      .transform((s) => (s ? s : undefined))
      .refine((s) => s === undefined || realDay(s), "Not a date."),
    branding: z
      .object({
        accent: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "A colour like #1f6feb.")
          .transform((s) => s.toLowerCase()),
      })
      .default({ accent: "#1f6feb" }),
    modules: z
      .array(z.enum(MODULE_IDS))
      .max(MODULE_IDS.length)
      .transform((ids) => [...new Set(ids)])
      .default(["discover"]),
  })
  .refine((d) => !d.endsOn || d.endsOn >= d.startsOn, {
    message: "It can't end before it starts.",
    path: ["endsOn"],
  });

export type DetailsInput = z.input<typeof detailsSchema>;

export type ParsedDetails =
  | { readonly ok: true; readonly details: ConferenceDetails }
  | {
      readonly ok: false;
      readonly issues: readonly { path: string; message: string }[];
    };

export function parseDetails(input: unknown): ParsedDetails {
  const parsed = detailsSchema.safeParse(input);
  if (parsed.success) return { ok: true, details: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}

/**
 * How long a conference's data outlives its last day. Long enough to keep
 * the adventures you want into your own Passport (vision §5.5, idea 26);
 * short enough that a staff trip is not a permanent record of who went.
 */
export const RETENTION_DAYS = 30;

export function retainUntilFor(details: ConferenceDetails): string {
  const last = details.endsOn ?? details.startsOn;
  const end = new Date(`${last}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + RETENTION_DAYS + 1);
  return end.toISOString();
}

/** The words a kind of gathering goes by. Wording only — never behaviour. */
export const KIND_WORDS: Record<
  ConferenceKind,
  { readonly noun: string; readonly people: string }
> = {
  conference: { noun: "conference", people: "colleagues" },
  retreat: { noun: "retreat", people: "everyone" },
  wedding: { noun: "wedding", people: "guests" },
  reunion: { noun: "reunion", people: "everyone" },
  festival: { noun: "festival", people: "your crew" },
  trip: { noun: "trip", people: "the group" },
};
