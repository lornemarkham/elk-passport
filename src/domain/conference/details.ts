import { z } from "zod";
import {
  AGENDA_KINDS,
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

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** At most this many agenda lines: the whole details record must stay small. */
export const AGENDA_MAX = 40;

const agendaItemSchema = z
  .object({
    id: z
      .string()
      .regex(/^[\w-]{1,24}$/, "Not an id.")
      .optional(),
    day: z.string().refine(realDay, "Not a date."),
    start: z.string().regex(CLOCK, "A time like 09:30."),
    end: z
      .string()
      .optional()
      .transform((s) => (s ? s : undefined))
      .refine((s) => s === undefined || CLOCK.test(s), "A time like 10:15."),
    title: z.string().trim().min(1, "Say what it is.").max(80),
    where: optionalText(80),
    note: optionalText(200),
    featured: z
      .boolean()
      .optional()
      .transform((b) => (b ? true : undefined)),
    kind: z
      .enum(AGENDA_KINDS)
      .optional()
      .transform((k) => (k && k !== "session" ? k : undefined)),
    topics: z
      .array(z.string().trim().min(1).max(120))
      .max(8, "At most 8 topics.")
      .optional()
      .transform((t) => (t?.length ? t : undefined)),
    aside: optionalText(120),
  })
  .refine((i) => !i.end || i.end > i.start, {
    message: "It can't end before it starts.",
    path: ["end"],
  });

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
    venue: z
      .object({
        name: optionalText(80),
        address: optionalText(120),
      })
      .optional()
      .transform((v) =>
        v?.name
          ? { name: v.name, ...(v.address ? { address: v.address } : {}) }
          : undefined,
      ),
    agenda: z
      .array(agendaItemSchema)
      .max(AGENDA_MAX, `At most ${AGENDA_MAX} agenda lines.`)
      .optional()
      .transform((items) =>
        items?.length
          ? items
              .map((i, n) => ({
                ...i,
                id:
                  i.id ??
                  `a${n.toString(36)}${i.day.replace(/-/g, "")}${i.start.replace(":", "")}`,
              }))
              .sort((a, b) =>
                `${a.day}T${a.start}`.localeCompare(`${b.day}T${b.start}`),
              )
          : undefined,
      ),
    objectives: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(24),
          line: optionalText(140),
        }),
      )
      .max(6, "At most 6 objectives.")
      .optional()
      .transform((o) => (o?.length ? o : undefined)),
    dayTitles: z
      .array(
        z.object({
          day: z.string().refine(realDay, "Not a date."),
          title: z.string().trim().min(1).max(80),
        }),
      )
      .max(31)
      .optional()
      .transform((t) => (t?.length ? t : undefined)),
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
  })
  .refine(
    (d) => {
      // A typo'd year shouldn't publish a session in 2062: the agenda keeps
      // to the conference's days, with a few either side for arrivals.
      const n = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`) / 86_400_000;
      const from = n(d.startsOn) - 3;
      const to = n(d.endsOn ?? d.startsOn) + 3;
      return (d.agenda ?? []).every((i) => n(i.day) >= from && n(i.day) <= to);
    },
    {
      message: "Agenda lines have to be on or near the conference's days.",
      path: ["agenda"],
    },
  )
  .refine(
    (d) =>
      new Set((d.agenda ?? []).map((i) => i.id)).size ===
      (d.agenda ?? []).length,
    { message: "Two agenda lines share an id.", path: ["agenda"] },
  );

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
