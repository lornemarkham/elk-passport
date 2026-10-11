import { readBrief } from "@/domain/day/brief";
import type { Company, Window } from "@/domain/discovery/situation";

/**
 * **A question somebody asked Discovery, read into answers it already has.**
 *
 * > "What can we do with three hours?"
 * > "What's something unusual nearby?"
 * > "Where can I take my kid this afternoon?"
 * > "What is worth driving an hour for?"
 *
 * None of these is a search query. Each one is a handful of the answers the
 * five rows on Discovery already ask for — how long, who with, which day, how
 * far — plus, at most, one way of looking (`lens`) that the rows cannot
 * express: *unusual*, *worth the drive*.
 *
 * ## Why it is read into the rows rather than beside them
 *
 * The doctrine asks for both directions (§4): let somebody state constraints
 * immediately, and let them refine with ordinary controls. So a sentence sets
 * the same rows a tap would, the rows visibly change, and the person can
 * correct any of them without retyping. Nothing the sentence decides is
 * hidden from the controls.
 *
 * ## The floor, and what a model may add
 *
 * This reading is deterministic: no key, no network, no spend. It reuses
 * `/go`'s `readBrief` for hours, ages, towns and distances, so a sentence
 * handed from Discovery to *Go have a day* means the same thing on both
 * pages. A model, where one is configured (`model.ts`), fills this same shape
 * and nothing more — it never names a place.
 *
 * ## What it refuses to infer
 *
 * "my kid" is a child, not an age. "nearby" is a wish to stay close, not a
 * position. "an hour's drive" is a feeling about distance that Passport has
 * no routing to measure. Each of those is carried as what was said, and the
 * answer asks for the missing half instead of filling it in.
 */
export interface DiscoveryAsk {
  /** The sentence as typed. */
  readonly said: string;
  /** Hours they said they have. */
  readonly hours?: number;
  /** The row's coarse version of that, or of "this afternoon". */
  readonly window?: Window;
  /** Who is coming, where the sentence says. */
  readonly company?: Company;
  /** A child's age, only where a number was given. */
  readonly childAge?: number;
  /** `YYYY-MM-DD`, where the sentence named a day. */
  readonly on?: string;
  /** The part of that day, where named. Carried for the heading only. */
  readonly partOfDay?: "morning" | "afternoon" | "evening";
  /** A town they named, by `towns.ts` id. */
  readonly townId?: string;
  /** "nearby", "close", "around here". */
  readonly near?: boolean;
  /** A distance they actually stated, in km. */
  readonly withinKm?: number;
  /** A stated verb, matched against the verbs Atlas offers on this page. */
  readonly doing?: string;
  /** Asked to stay dry, or to get outside. */
  readonly shelter?: "indoor" | "outdoor";
  /**
   * **Two of them** — a partner, a date. The rows have no answer for it
   * (`Company` is alone, a child or a group), so it is carried here and
   * changes only the answer, never a row.
   */
  readonly pair?: true;
  /** The way of looking the rows cannot express. */
  readonly lens?: AskLens;
}

/**
 * `unusual` — the rarer things here, by what Atlas holds.
 * `drive`   — further out, and with more to it.
 * `kids`    — somewhere a child can do something, by stated evidence.
 * `on`      — what is on: dated things on the day, then what is open.
 * `couple`  — the two of them: evenings and stated adults-only first.
 * `group`   — friends: more to do, stated as suiting everyone.
 * `time`    — they said how long, and that is the question.
 */
export type AskLens =
  "unusual" | "drive" | "kids" | "on" | "couple" | "group" | "time";

export interface ReadContext {
  /** Today where the subjects are, `YYYY-MM-DD`. Resolves "tomorrow", "Saturday". */
  readonly today: string;
  /** The verbs Atlas offers on this page, so "hiking" can choose one. */
  readonly verbs?: readonly string[];
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** `day` plus `n` days, as `YYYY-MM-DD`. Calendar arithmetic, no zone. */
function plusDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

function weekdayIndex(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** The next `weekday` on or after today — "Saturday" on a Saturday is today. */
function nextWeekday(today: string, weekday: number): string {
  const ahead = (weekday - weekdayIndex(today) + 7) % 7;
  return plusDays(today, ahead);
}

/**
 * **"Driving an hour" is about distance, and Passport cannot measure it.**
 *
 * Taken out of the sentence before `readBrief` sees it, or "an hour" would be
 * read as the length of the day.
 */
/** "an hour", "two hours", "1.5 hrs" — a length, here of a drive. */
const SPAN = String.raw`(?:an?|one|two|three|four|half\s+an?|\d+(?:\.\d+)?)\s*(?:hours?|hrs?)`;
const DRIVE = new RegExp(
  [
    // "worth the drive", "worth driving an hour for"
    String.raw`\bworth\s+(?:the\s+|a\s+)?(?:drive|driving|trip|road\s*trip)(?:\s+(?:for\s+)?${SPAN})?`,
    // "drive an hour", "driving for two hours"
    String.raw`\b(?:drive|driving)\s+(?:for\s+)?${SPAN}`,
    // "an hour's drive", "two hours of driving"
    String.raw`\b${SPAN}(?:'s|s')?\s+(?:of\s+)?(?:drive|driving)`,
    String.raw`\b(?:road|day)\s*trip`,
  ].join("|"),
  "i",
);

const KID =
  /\b(kids?|child|children|toddlers?|son|daughter|niece|nephew|grandkids?|grandchild(?:ren)?|little ones?)\b/;
const GROUP = /\b(friends|group|crew|mates|the gang|buddies|colleagues)\b/;
const ALONE = /\b(alone|by myself|on my own|solo|just me)\b/;

/** A partner or a date. "Couple" alone, as in "a couple of hours", is not. */
const PAIR =
  /\b(date|date night|my (?:partner|wife|husband|girlfriend|boyfriend|spouse|fianc[ée]e?|other half)|the two of us|just us two|us two|romantic|anniversary|a couple\b(?! of))/;

/** Asking what is on, rather than what is there. */
const ON =
  /\b(what'?s on|what is on|anything on|what'?s happening|happening|going on|events?)\b/;

/** Stated fine weather — a wish to be outside it, as "it's raining" is to stay dry. */
const FINE =
  /\b(sunny|sunshine|nice (?:day|out|weather)|beautiful day|gorgeous day)\b/;

const UNUSUAL =
  /\b(unusual|weird|strange|odd|offbeat|quirky|unexpected|hidden|secret|different|surprise me|never (?:been|heard))\b/;

/** Words too common to choose a verb with. */
const STOP = new Set([
  "what",
  "with",
  "where",
  "something",
  "worth",
  "near",
  "nearby",
  "this",
  "that",
  "take",
  "have",
  "hour",
  "hours",
  "afternoon",
  "morning",
  "evening",
  "today",
  "tomorrow",
  "there",
  "some",
  "could",
  "should",
  "would",
  "about",
  "around",
  "place",
  "places",
  "things",
  "thing",
  "somewhere",
  "unusual",
  "driving",
  "drive",
  "here",
  "want",
  "like",
  "good",
  "best",
  "kind",
  "more",
  "less",
  "time",
  "week",
  "weekend",
  "kids",
  "family",
  "friends",
  "your",
  "them",
  "they",
  "from",
  "into",
  "over",
  "just",
  "very",
  "really",
  "maybe",
  "anything",
  "everything",
  "going",
  "doing",
  "make",
  "does",
  "spend",
  "spent",
  "close",
  "local",
  "quick",
  "date",
  "night",
  "tonight",
  "partner",
  "happening",
  "events",
]);

/**
 * The verb Atlas offers that the sentence names, where it names one.
 *
 * Matched on stems both ways round — "hike" chooses *Hiking*, "swim"
 * chooses *Swimming* — on words of four letters or more, so "go" and "do"
 * choose nothing. Against the verb's **last word**, which is the doing:
 * "date night" once chose *night skiing* because the verb began "night".
 */
function verbIn(text: string, verbs: readonly string[]): string | undefined {
  const stem = (word: string) => word.replace(/(?:ing|es|e|s)$/, "");
  const words = (text.match(/[a-z]{4,}/g) ?? [])
    .filter((w) => !STOP.has(w))
    .map(stem);
  for (const verb of verbs) {
    const v = stem(verb.toLowerCase().trim().split(/\s+/).pop() ?? "");
    if (v.length < 3) continue;
    if (words.some((w) => v.startsWith(w) || w.startsWith(v))) return verb;
  }
  return undefined;
}

/** The row's window for a number of hours. Coarse, as the row is. */
export function windowFor(hours: number): Window {
  if (hours <= 1.5) return "an-hour";
  if (hours <= 5) return "half-day";
  return "all-day";
}

export function readAsk(said: string, context: ReadContext): DiscoveryAsk {
  const text = said.toLowerCase().replace(/[’']/g, "'");

  const drive = DRIVE.test(text);
  // `readBrief` reads hours, a stated age, a town, a stated distance and
  // shelter — the parts both pages must read identically.
  const brief = readBrief(drive ? text.replace(DRIVE, " ") : text);

  const partOfDay = /\bafternoon\b/.test(text)
    ? ("afternoon" as const)
    : /\bmorning\b/.test(text)
      ? ("morning" as const)
      : /\b(evening|tonight)\b/.test(text)
        ? ("evening" as const)
        : undefined;

  const weekday = WEEKDAYS.findIndex((w) =>
    new RegExp(`\\b${w}\\b`).test(text),
  );
  const on = /\btomorrow\b/.test(text)
    ? plusDays(context.today, 1)
    : weekday >= 0
      ? nextWeekday(context.today, weekday)
      : /\bthis weekend\b|\bweekend\b/.test(text)
        ? nextWeekday(context.today, 6)
        : /\btoday\b|\bthis (?:afternoon|morning|evening)\b|\btonight\b|\bright now\b/.test(
              text,
            )
          ? context.today
          : undefined;

  const company: Company | undefined =
    brief.childAge !== undefined || KID.test(text)
      ? "child"
      : GROUP.test(text)
        ? "group"
        : ALONE.test(text)
          ? "alone"
          : undefined;

  const hours = brief.hours;
  const window =
    hours !== undefined
      ? windowFor(hours)
      : partOfDay === "afternoon" || partOfDay === "morning"
        ? ("half-day" as const)
        : undefined;

  // `readBrief` turns "nearby" into 15 km for a day plan. Discovery keeps the
  // wish and the number apart: a stated number is a radius, "nearby" is a
  // wish that needs somewhere to measure from before it can become one.
  const statedKm = /\d+(?:\.\d+)?\s*km\b/.test(text)
    ? brief.withinKm
    : undefined;
  const near =
    /\b(nearby|near me|near here|close by|close to here|around here|not far|local)\b/.test(
      text,
    ) || undefined;

  const unusual = UNUSUAL.test(text) || brief.appetite === "odd";
  const pair = company !== "child" && PAIR.test(text);
  const asksOn = ON.test(text);
  // **The most specific question wins the lens**; everything else it said
  // still applies — the hours still draw the circle, the day still filters.
  const lens: AskLens | undefined = drive
    ? "drive"
    : unusual
      ? "unusual"
      : company === "child"
        ? "kids"
        : pair
          ? "couple"
          : asksOn
            ? "on"
            : company === "group"
              ? "group"
              : hours !== undefined
                ? "time"
                : undefined;
  // "What's on?" with no day is about today.
  const day = on ?? (asksOn ? context.today : undefined);
  const shelter =
    brief.shelter ?? (FINE.test(text) ? ("outdoor" as const) : undefined);

  const doing = context.verbs ? verbIn(text, context.verbs) : undefined;

  return {
    said: said.trim(),
    ...(hours !== undefined ? { hours } : {}),
    ...(window ? { window } : {}),
    ...(company ? { company } : {}),
    ...(brief.childAge !== undefined && brief.childAge <= 17
      ? { childAge: brief.childAge }
      : {}),
    ...(day ? { on: day } : {}),
    ...(partOfDay ? { partOfDay } : {}),
    ...(brief.town ? { townId: brief.town.id } : {}),
    ...(near ? { near } : {}),
    ...(statedKm !== undefined ? { withinKm: statedKm } : {}),
    ...(doing ? { doing } : {}),
    ...(shelter ? { shelter } : {}),
    ...(pair ? { pair: true as const } : {}),
    ...(lens ? { lens } : {}),
  };
}

/**
 * **What was understood, said back** — so a wrong reading is visible before
 * anybody trusts the answer under it. Short phrases, the person's register,
 * in the order a person would say them.
 */
export function readBack(
  ask: DiscoveryAsk,
  context: { readonly today: string; readonly townName?: string },
): readonly string[] {
  const out: string[] = [];
  if (ask.lens === "unusual") out.push("something unusual");
  if (ask.lens === "drive") out.push("worth the drive");
  if (ask.lens === "on") out.push("what's on");
  if (ask.doing) out.push(ask.doing.toLowerCase());
  if (ask.hours !== undefined)
    out.push(ask.hours === 1 ? "an hour" : `${ask.hours} hours`);
  if (ask.company === "child")
    out.push(
      ask.childAge !== undefined
        ? `with a ${ask.childAge}-year-old`
        : "with a kid",
    );
  if (ask.pair) out.push("the two of you");
  if (ask.company === "group") out.push("with friends");
  if (ask.company === "alone") out.push("on your own");
  if (ask.on) {
    const part = ask.partOfDay
      ? ask.partOfDay === "evening"
        ? "tonight"
        : `this ${ask.partOfDay}`
      : undefined;
    if (ask.on === context.today) out.push(part ?? "today");
    else if (ask.on === plusDays(context.today, 1))
      out.push(ask.partOfDay ? `tomorrow ${ask.partOfDay}` : "tomorrow");
    else
      out.push(
        new Intl.DateTimeFormat("en-CA", {
          weekday: "long",
          timeZone: "UTC",
        }).format(new Date(`${ask.on}T12:00:00Z`)),
      );
  }
  if (ask.withinKm !== undefined) out.push(`within ${ask.withinKm} km`);
  else if (ask.near) out.push("close by");
  if (context.townName) out.push(`from ${context.townName}`);
  if (ask.shelter === "indoor") out.push("staying dry");
  if (ask.shelter === "outdoor") out.push("outdoors");
  return out;
}
