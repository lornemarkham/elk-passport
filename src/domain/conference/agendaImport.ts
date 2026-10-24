import { z } from "zod";
import { parseDetails } from "./details";
import type { AgendaItem, ConferenceDetails } from "./types";

/**
 * **Importing an organiser's agenda, as many times as it takes.**
 *
 * An organiser's programme arrives as a file — exported, corrected, sent
 * again on the morning of day two with a room changed. Importing it must
 * never make two of anything, so every line in the file carries its own
 * stable `id`, and a line is matched by that id and nothing else:
 *
 * - a line whose id is new is **added**;
 * - a line whose id exists is **replaced** by the file's version (the file
 *   is the organiser's latest word) — or left alone when nothing changed;
 * - a line already on the agenda that the file doesn't mention is **kept**,
 *   unless the organiser asks for the file to be the whole agenda.
 *
 * Importing the same file twice therefore changes nothing the second time,
 * and says so. The result is a complete details record that goes through
 * the same schema and the same endpoint as every other edit, so an import
 * can't publish anything the editor couldn't.
 *
 * The file can also carry the conference's dates, time zone and venue —
 * the facts the agenda's times depend on. Those are proposed in the preview,
 * not applied behind the organiser's back.
 *
 * Nothing here knows any particular conference: the programme is data the
 * organiser brings, and it lives only in their conference's record.
 */

export const AGENDA_FILE_FORMAT = "passport-conference-agenda/1";

const fileSchema = z.object({
  format: z.literal(AGENDA_FILE_FORMAT, {
    message: `Not an agenda file (expected "format": "${AGENDA_FILE_FORMAT}").`,
  }),
  conference: z
    .object({
      startsOn: z.string().optional(),
      endsOn: z.string().optional(),
      timeZone: z.string().optional(),
      tagline: z.string().optional(),
      welcome: z.string().optional(),
      objectives: z
        .array(z.object({ title: z.string(), line: z.string().optional() }))
        .optional(),
      venue: z
        .object({ name: z.string(), address: z.string().optional() })
        .optional(),
    })
    .optional(),
  dayTitles: z
    .array(z.object({ day: z.string(), title: z.string() }))
    .optional(),
  agenda: z
    .array(
      z
        .object({ id: z.string().regex(/^[\w-]{1,24}$/, "Not an id.") })
        .passthrough(),
    )
    .min(1, "The file has no agenda lines."),
});

export type AgendaFile = z.infer<typeof fileSchema>;

export type ReadFile =
  | { readonly ok: true; readonly file: AgendaFile }
  | { readonly ok: false; readonly problem: string };

export function readAgendaFile(text: string): ReadFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, problem: "That isn't valid JSON." };
  }
  const parsed = fileSchema.safeParse(json);
  if (!parsed.success) {
    const i = parsed.error.issues[0]!;
    return {
      ok: false,
      problem: `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`,
    };
  }
  const ids = parsed.data.agenda.map((l) => l.id);
  const dupe = ids.find((id, n) => ids.indexOf(id) !== n);
  if (dupe)
    return {
      ok: false,
      problem: `Two lines in the file share the id "${dupe}".`,
    };
  return { ok: true, file: parsed.data };
}

export interface ImportChange {
  readonly id: string;
  readonly title: string;
  readonly day: string;
  readonly start: string;
}

export interface ConferenceChange {
  readonly field:
    | "startsOn"
    | "endsOn"
    | "timeZone"
    | "venue"
    | "tagline"
    | "welcome"
    | "objectives";
  readonly from: string | null;
  readonly to: string;
}

export type ImportPlan =
  | {
      readonly ok: true;
      /** The whole details record to save. */
      readonly details: ConferenceDetails;
      readonly added: readonly ImportChange[];
      readonly updated: readonly ImportChange[];
      readonly unchanged: number;
      /** On the agenda, not in the file: kept, or removed when replacing. */
      readonly notInFile: readonly ImportChange[];
      readonly removed: boolean;
      readonly conference: readonly ConferenceChange[];
      readonly dayTitlesChanged: boolean;
      /** The Agenda tab was off and importing switches it on. */
      readonly turnsOnAgenda: boolean;
      /** True when saving would change nothing at all. */
      readonly nothingToDo: boolean;
    }
  | {
      readonly ok: false;
      readonly issues: readonly { path: string; message: string }[];
    };

const change = (i: AgendaItem): ImportChange => ({
  id: i.id,
  title: i.title,
  day: i.day,
  start: i.start,
});

/** One line, compared by what it says, not by key order. */
const same = (a: AgendaItem, b: AgendaItem) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const canonical = (i: AgendaItem) =>
  Object.fromEntries(
    Object.entries(i)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => x.localeCompare(y)),
  );

const venueWords = (v: ConferenceDetails["venue"]) =>
  v ? [v.name, v.address].filter(Boolean).join(", ") : null;

export function planImport(
  current: ConferenceDetails,
  file: AgendaFile,
  options: { readonly replace?: boolean } = {},
): ImportPlan {
  const c = file.conference ?? {};
  const byId = new Map((current.agenda ?? []).map((i) => [i.id, i]));
  const fileIds = new Set(file.agenda.map((l) => l.id));
  const kept = (current.agenda ?? []).filter((i) => !fileIds.has(i.id));

  // The file's lines first, through the real schema (with the dates the
  // file proposes, since "near the conference's days" depends on them).
  const proposed = {
    ...current,
    ...(c.startsOn ? { startsOn: c.startsOn } : {}),
    ...(c.endsOn ? { endsOn: c.endsOn } : {}),
    ...(c.timeZone ? { timeZone: c.timeZone } : {}),
    ...(c.venue ? { venue: c.venue } : {}),
    ...(c.tagline ? { tagline: c.tagline } : {}),
    ...(c.welcome ? { welcome: c.welcome } : {}),
    ...(c.objectives ? { objectives: c.objectives } : {}),
    ...(file.dayTitles ? { dayTitles: file.dayTitles } : {}),
    agenda: [...file.agenda, ...(options.replace ? [] : kept)],
    // Importing an agenda publishes it: the Agenda tab is switched on.
    modules: current.modules.includes("schedule")
      ? current.modules
      : [...current.modules, "schedule"],
  };
  const parsed = parseDetails(proposed);
  if (!parsed.ok) return { ok: false, issues: parsed.issues };
  const details = parsed.details;

  const added: ImportChange[] = [];
  const updated: ImportChange[] = [];
  let unchanged = 0;
  for (const line of details.agenda ?? []) {
    if (!fileIds.has(line.id)) continue;
    const before = byId.get(line.id);
    if (!before) added.push(change(line));
    else if (same(before, line)) unchanged++;
    else updated.push(change(line));
  }

  const conference: ConferenceChange[] = [];
  for (const field of [
    "startsOn",
    "endsOn",
    "timeZone",
    "tagline",
    "welcome",
  ] as const)
    if (details[field] !== current[field] && details[field])
      conference.push({
        field,
        from: current[field] ?? null,
        to: details[field]!,
      });
  if (venueWords(details.venue) !== venueWords(current.venue))
    conference.push({
      field: "venue",
      from: venueWords(current.venue),
      to: venueWords(details.venue) ?? "",
    });

  const objectives = (d: ConferenceDetails) =>
    (d.objectives ?? []).map((o) => o.title).join(" · ");
  if (
    JSON.stringify(details.objectives ?? []) !==
    JSON.stringify(current.objectives ?? [])
  )
    conference.push({
      field: "objectives",
      from: objectives(current) || null,
      to: objectives(details),
    });

  const dayTitlesChanged =
    JSON.stringify(details.dayTitles ?? []) !==
    JSON.stringify(current.dayTitles ?? []);
  const removed = options.replace === true && kept.length > 0;
  const turnsOnAgenda = !current.modules.includes("schedule");

  return {
    ok: true,
    details,
    added,
    updated,
    unchanged,
    notInFile: kept.map(change),
    removed,
    conference,
    dayTitlesChanged,
    turnsOnAgenda,
    nothingToDo:
      !added.length &&
      !updated.length &&
      !removed &&
      !conference.length &&
      !dayTitlesChanged &&
      !turnsOnAgenda,
  };
}
