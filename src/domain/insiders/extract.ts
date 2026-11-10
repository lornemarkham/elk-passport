import { canonicalInterest, interestsIn, type Kind } from "./model";

/**
 * **Reading a submission into a listing draft, by rules.** What a person
 * typed or said ("Squealing Pig hare scramble out past Lumby, hosted by the
 * North Okanagan Dirt Bike Club, June 7 — nodbc.ca") becomes fields to
 * confirm.
 *
 * It only copies. A date is a date the text states (a month and a day, or an
 * ISO date); an organizer is a name the text introduces with "hosted by",
 * "organized by" or "run by"; a link is a link in the text. Nothing is
 * guessed to fill a gap. An AI reading (see `src/lib/insiders/ai.ts`) may add
 * what these rules missed, and is held to the same rule.
 */

export interface Draft {
  kind?: Kind;
  title?: string;
  description?: string;
  town?: string;
  venue?: string;
  interests: string[];
  organizer?: string;
  organizerUrl?: string;
  /** Dates as the text states them, ISO. Unchecked until a person checks. */
  starts?: string;
  ends?: string;
  schedule?: string;
  registrationUrl?: string;
}

/** North Okanagan places the network starts with, and how they are written. */
export const TOWNS = [
  "Vernon",
  "Coldstream",
  "Armstrong",
  "Spallumcheen",
  "Enderby",
  "Lumby",
  "Cherryville",
  "Lake Country",
  "Falkland",
  "Silver Star",
  "Okanagan Landing",
  "Kelowna",
  "Salmon Arm",
] as const;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTH_RE =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const pad = (n: number) => String(n).padStart(2, "0");

function monthIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3);
  return MONTHS.findIndex((m) => m.startsWith(w));
}

/**
 * Explicit dates in the text, in order. A month-and-day without a year takes
 * the next time that day comes round after `today` — the reading of "June 7"
 * on a poster. Anything vaguer ("next spring", "every summer") is no date.
 */
export function statedDates(text: string, today: Date): string[] {
  const out: { at: number; iso: string }[] = [];
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    out.push({ at: m.index ?? 0, iso: `${m[1]}-${m[2]}-${m[3]}` });
  }
  const re = new RegExp(
    `\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:-|–|to)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?(?:,?\\s+(\\d{4}))?\\b`,
    "gi",
  );
  for (const m of text.matchAll(re)) {
    const month = monthIndex(m[1]!);
    const day = Number(m[2]);
    if (month < 0 || day < 1 || day > 31) continue;
    let year = m[4] ? Number(m[4]) : today.getFullYear();
    if (!m[4]) {
      const candidate = Date.UTC(year, month, day);
      const floor = Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      if (candidate < floor) year += 1;
    }
    out.push({
      at: m.index ?? 0,
      iso: `${year}-${pad(month + 1)}-${pad(day)}`,
    });
    if (m[3]) {
      const endDay = Number(m[3]);
      if (endDay > day && endDay <= 31)
        out.push({
          at: (m.index ?? 0) + 1,
          iso: `${year}-${pad(month + 1)}-${pad(endDay)}`,
        });
    }
  }
  return out.sort((a, b) => a.at - b.at).map((d) => d.iso);
}

export function urlsIn(text: string): string[] {
  const found =
    text.match(
      /\bhttps?:\/\/[^\s<>()"']+|\b(?:www\.)[^\s<>()"']+|\b[a-z0-9-]+\.(?:ca|com|org|net|club)(?:\/[^\s<>()"']*)?/gi,
    ) ?? [];
  return [
    ...new Set(
      found
        .map((u) => u.replace(/[.,;:!?)]+$/, ""))
        .map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)),
    ),
  ];
}

const KIND_WORDS: [Kind, RegExp][] = [
  ["club", /\b(club|association|society|league|team)\b/i],
  [
    "event",
    /\b(race|tournament|festival|show|concert|night|meet|rally|competition|fundraiser|scramble|enduro|on (?:sat|sun|mon|tue|wed|thu|fri))/i,
  ],
  [
    "community",
    /\b(group|meetup|meet-up|circle|gathering|jam|crew|collective)\b/i,
  ],
  [
    "experience",
    /\b(trail|lookout|spot|park|swimming hole|viewpoint|hidden gem)\b/i,
  ],
];

function kindOf(text: string, hasDate: boolean): Kind | undefined {
  // A date makes it an event unless it says outright it is a club that meets.
  const recurring =
    /\b(every|weekly|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\b/i.test(
      text,
    );
  if (hasDate && !recurring) return "event";
  for (const [kind, re] of KIND_WORDS) if (re.test(text)) return kind;
  return hasDate ? "event" : undefined;
}

function organizerIn(text: string): string | undefined {
  const m = text.match(
    /\b(?:hosted|organi[sz]ed|run|put on|presented)\s+by\s+(?:the\s+)?([A-Z][\w'&.-]*(?:\s+(?:[A-Z][\w'&.-]*|of|and|the|&))*)/,
  );
  return m?.[1]
    ?.split(/\.\s/)[0]!
    .replace(/[.]+$/, "")
    .replace(/\s+(of|and|the|&)$/i, "")
    .trim();
}

function scheduleIn(text: string): string | undefined {
  const m = text.match(
    /\b(every\s+\w+(?:\s+(?:and|&)\s+\w+)?(?:\s+(?:night|morning|evening|afternoon))?(?:[^.\n]{0,40}?\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s*(?:-|–|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?)?|(?:mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)(?:\s+(?:and|&)\s+\w+days)?(?:[^.\n]{0,40}?\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s*(?:-|–|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?)?)/i,
  );
  return m?.[1]?.trim();
}

function titleIn(text: string): string | undefined {
  const first = text
    .trim()
    .split(/\n|(?<=[.!?])\s/)[0]
    ?.replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!first) return undefined;
  const short = first
    .split(
      /\s+[-–—:]\s+|,\s+(?:hosted|organi[sz]ed|run)\b|\s+(?:hosted|organi[sz]ed|run)\s+by\b/i,
    )[0]!
    .trim();
  return short.length > 90 ? `${short.slice(0, 87).trimEnd()}…` : short;
}

/** The whole draft. `today` decides the year of a date written without one. */
export function draftFrom(text: string, today: Date): Draft {
  const dates = statedDates(text, today);
  const urls = urlsIn(text);
  const registration = urls.find((u) =>
    /regist|signup|sign-up|tickets?|eventbrite|zone4|raceroster/i.test(u),
  );
  const organizerUrl = urls.find((u) => u !== registration);
  // The first place the text names: "at Becker Lake, Lumby — hosted by the
  // Vernon club" is in Lumby.
  const town = TOWNS.map((t) => ({
    t,
    at: text.search(new RegExp(`\\b${t}\\b`, "i")),
  }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)[0]?.t;
  const schedule = scheduleIn(text);
  const kind = kindOf(text, dates.length > 0);
  const organizer = organizerIn(text);
  const title = titleIn(text);
  return {
    ...(kind ? { kind } : {}),
    ...(title ? { title } : {}),
    description: text.trim().replace(/\s+/g, " ").slice(0, 600),
    ...(town ? { town } : {}),
    interests: interestsIn(text).map(canonicalInterest),
    ...(organizer ? { organizer } : {}),
    ...(organizerUrl ? { organizerUrl } : {}),
    ...(dates[0] ? { starts: dates[0] } : {}),
    ...(dates[1] && dates[1] > dates[0]! ? { ends: dates[1] } : {}),
    ...(schedule ? { schedule } : {}),
    ...(registration ? { registrationUrl: registration } : {}),
  };
}

/**
 * An AI's reading laid over the rules': it fills only what the rules left
 * empty, and a value it names must appear in the text it was given (a date's
 * day number, a link, an organizer's name) — a model that "knows" the Night
 * Pig is in June does not get to say so.
 */
export function mergeReading(
  rules: Draft,
  ai: Partial<Draft>,
  source: string,
): Draft {
  const lower = source.toLowerCase();
  const inText = (v: string | undefined) =>
    !!v && lower.includes(v.toLowerCase());
  const dateInText = (iso: string | undefined) => {
    if (!iso) return false;
    const day = String(Number(iso.slice(8, 10)));
    return (
      lower.includes(iso) ||
      new RegExp(`\\b${day}(st|nd|rd|th)?\\b`).test(lower)
    );
  };
  return {
    ...rules,
    kind: rules.kind ?? ai.kind,
    title: rules.title ?? ai.title,
    town: rules.town ?? (inText(ai.town) ? ai.town : undefined),
    venue: rules.venue ?? (inText(ai.venue) ? ai.venue : undefined),
    interests: [
      ...new Set([
        ...rules.interests,
        ...(ai.interests ?? []).map(canonicalInterest),
      ]),
    ],
    organizer:
      rules.organizer ?? (inText(ai.organizer) ? ai.organizer : undefined),
    organizerUrl:
      rules.organizerUrl ??
      (inText(ai.organizerUrl?.replace(/^https?:\/\//, ""))
        ? ai.organizerUrl
        : undefined),
    starts: rules.starts ?? (dateInText(ai.starts) ? ai.starts : undefined),
    ends: rules.ends ?? (dateInText(ai.ends) ? ai.ends : undefined),
    schedule: rules.schedule ?? ai.schedule,
    registrationUrl:
      rules.registrationUrl ??
      (inText(ai.registrationUrl?.replace(/^https?:\/\//, ""))
        ? ai.registrationUrl
        : undefined),
  } as Draft;
}
