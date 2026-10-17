import { readBrief } from "@/domain/day/brief";
import { asksForFree, travelIn } from "@/domain/day/intent";
import { activityByKey, activityIn } from "@/domain/discovery/activities";
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
  /**
   * **The length of drive they said they would make**, in hours — "worth
   * driving an hour for". A statement, not a distance: Passport turns it into
   * nothing but Atlas's own routed estimate, where there is one.
   */
  readonly driveHours?: number;
  /**
   * **How long they will travel, at most**, in minutes — "within 20
   * minutes", "happy to drive an hour", or "maybe 45 minutes" said in answer
   * to *how far?*. A limit, not a lens: it keeps what Atlas's routed estimate
   * puts inside it, and never turns into a speed Passport made up.
   */
  readonly driveMinutes?: number;
  /**
   * **The activity they named**, by `activities.ts` key — "biking" is
   * `cycling`, "the movies" is `movies`. Whether anything here offers it is
   * the answer's question, not the reader's.
   */
  readonly doing?: string;
  /** Activities they said no to — "outside, but not hiking". Keys. */
  readonly avoid?: readonly string[];
  /** Asked for things that cost nothing. Atlas rarely says, and the answer says so. */
  readonly free?: true;
  /**
   * **Easy going** — grandparents, "nothing strenuous", a wheelchair. Moves
   * gentle things up and long hikes down; promises nothing about access.
   */
  readonly gentle?: true;
  /** "Show me something completely different" — away from what was shown. */
  readonly different?: true;
  /** "Start over", "forget that" — the conversation begins again here. */
  readonly reset?: true;
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
 * `surprise` — "I'm bored", "surprise me": a varied handful, nothing asked.
 * `adventure` — climbing, ziplines, paddling: Atlas's words for a thrill.
 * `unusual` — the rarer things here, by what Atlas holds.
 * `drive`   — further out, and with more to it.
 * `kids`    — somewhere a child can do something, by stated evidence.
 * `on`      — what is on: dated things on the day, then what is open.
 * `couple`  — the two of them: evenings and stated adults-only first.
 * `group`   — friends: more to do, stated as suiting everyone.
 * `time`    — they said how long, and that is the question.
 */
export type AskLens =
  | "unusual"
  | "drive"
  | "kids"
  | "on"
  | "couple"
  | "group"
  | "time"
  | "surprise"
  | "adventure";

export interface ReadContext {
  /** Today where the subjects are, `YYYY-MM-DD`. Resolves "tomorrow", "Saturday". */
  readonly today: string;
  /** Kept for callers that still pass Atlas's verbs; activities are read from words. */
  readonly verbs?: readonly string[];
  /**
   * **The question Passport just asked**, so a bare answer means what it
   * answers: "maybe 45 minutes" after *how far?* is a drive, after *how much
   * time?* it is the length of the outing, and "5" after *how old?* is an age.
   */
  readonly expecting?: "time" | "distance" | "age";
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

const SPAN_WORDS: Readonly<Record<string, number>> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
};

/**
 * **How long a drive somebody said they would make**, in hours, from the text
 * `DRIVE` matched. Absent for "worth the drive" and "a road trip", which name
 * no length — Passport does not supply one.
 */
export function driveHoursIn(matched: string): number | undefined {
  const span = new RegExp(`(${SPAN})`, "i").exec(matched)?.[1];
  if (!span) return undefined;
  const half = /^half\s+an?\s/i.test(span);
  if (half) return 0.5;
  const word = /^(an?|one|two|three|four)\b/i.exec(span)?.[1];
  const hours = word ? SPAN_WORDS[word.toLowerCase()] : Number.parseFloat(span);
  return hours !== undefined && Number.isFinite(hours) && hours > 0
    ? hours
    : undefined;
}

const KID =
  /\b(kids?|child|children|toddlers?|son|daughter|niece|nephew|grandkids?|grandchild(?:ren)?|little ones?)\b/;
const GROUP = /\b(friends|group|crew|mates|the gang|buddies|colleagues)\b/;
const ALONE = /\b(alone|by myself|on my own|solo|just me)\b/;

/** A partner or a date. "Couple" alone, as in "a couple of hours", is not. */
const PAIR =
  /\b(date|date night|my (?:partner|wife|husband|girlfriend|boyfriend|spouse|fianc[ée]e?|other half)|the two of us|just us two|us two|romantic|anniversary|a couple\b(?!\s+(?:of|hours?|hrs?|minutes?|mins?|days?)\b))/;

/** Asking what is on, rather than what is there. */
const ON =
  /\b(what'?s on|what is on|anything on|what'?s happening|happening|going on|events?)\b/;

/** Stated fine weather — a wish to be outside it, as "it's raining" is to stay dry. */
const FINE =
  /\b(sunny|sunshine|nice (?:day|out|weather)|beautiful day|gorgeous day)\b/;

const UNUSUAL =
  /\b(unusual|weird|strange|odd|offbeat|quirky|unexpected|hidden|secret|different|never (?:been|heard|tried|done)|something new|new to me|first time|try something)\b/;

/** Nothing in mind, and saying so — a mood, not a constraint. */
const SURPRISE =
  /\b(bored|boring|surprise me|surprise us|anything|whatever|no idea|don'?t know what|something fun|fun|inspire me|ideas?)\b/;

const ADVENTURE =
  /\b(adventur\w*|thrill\w*|adrenaline|exciting|daring|epic|wild|extreme|active)\b/;

/** Easy going: older company, or saying nothing strenuous. */
const GENTLE =
  /\b(grand(?:parents?|ma|pa|mother|father|mom|dad)|seniors?|elderly|older (?:folks|relatives|parents)|my (?:mom|mum|dad|parents)|easy|gentle|not too (?:strenuous|hard|active)|nothing strenuous|low[- ]key|relaxing|accessible|wheelchair|stroller)\b/;

/** Away from what was just shown — not a lens, a direction. */
const DIFFERENT =
  /\b(completely different|totally different|something else|anything else|other ideas|other options|show me (?:something |some )?(?:else|other)|not these|different ones|none of these|more ideas)\b/;

const RESET =
  /\b(start (?:over|again)|forget (?:that|it|all that|everything)|never ?mind|scratch that|from scratch)\b/;

/** "walking distance" — a product judgement of ~2 km, said as one. */
export const WALKING_KM = 2;

/** A drive they will make, as a limit: "happy to drive an hour", "within 20 minutes". */
const TOLERANCE =
  /\b(?:within|under|up to|less than|no more than|at most|max(?:imum)?|happy to|willing to|don'?t mind|(?:is |it'?s )?ok(?:ay)? to|fine to|can|could|maybe|about|around)\b/;

/** Somewhere close, said any way. */
const NEAR =
  /\b(nearby|near me|near here|close by|close to (?:here|home)|around here|not far|not too far|local|don'?t want to (?:drive|go|travel) (?:far|too far|much)|no (?:long )?drive|not much driving|less driving|walking distance)\b/;

/** "not hiking", "no museums", "anything but the beach". */
const NEGATED =
  /\b(?:not|no|without|skip|avoid|anything but|except|rather not|don'?t want to|do not want to|nothing with)\s+(?:a\s+|an\s+|any\s+|the\s+|to\s+|go\s+|more\s+)?([a-z-]+(?:\s+[a-z-]+)?)/g;

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
};

/**
 * **A day named by how far off it is** — "tomorrow", "the day after
 * tomorrow", "in two days". Capped at a week: further out is a date, which
 * this reading does not guess.
 */
function relativeDays(text: string): number | undefined {
  if (/\bday after tomorrow\b/.test(text)) return 2;
  if (/\btomorrow\b/.test(text)) return 1;
  const n = /\bin (\d+|one|two|three|four|five|six|seven) days?\b/.exec(
    text,
  )?.[1];
  if (n === undefined) return undefined;
  const days = /^\d+$/.test(n) ? Number(n) : NUMBER_WORDS[n];
  return days !== undefined && days >= 1 && days <= 7 ? days : undefined;
}

/** The row's window for a number of hours. Coarse, as the row is. */
export function windowFor(hours: number): Window {
  if (hours <= 1.5) return "an-hour";
  if (hours <= 5) return "half-day";
  return "all-day";
}

/** "an hour", "2 hours", "half an hour" — as a person would say a drive. */
export function driveSpan(hours: number): string {
  if (hours === 0.5) return "half an hour";
  if (hours === 1) return "an hour";
  return `${hours} hours`;
}

/** A bare duration — "45 minutes", "maybe an hour", "about 3 hours". */
const BARE_SPAN =
  /\b(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|half an?|a couple of|a couple)\s*(hours?|hrs?|minutes?|mins?)\b/;

const SPOKEN: Readonly<Record<string, number>> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

function spanMinutes(match: RegExpExecArray): number | undefined {
  const [, qty = "", unit = ""] = match;
  const n = /^\d/.test(qty)
    ? Number(qty)
    : qty.startsWith("half")
      ? 0.5
      : qty.includes("couple")
        ? 2
        : SPOKEN[qty];
  if (n === undefined || !(n > 0)) return undefined;
  return /^h/.test(unit) ? Math.round(n * 60) : Math.round(n);
}

/** What they said no to, as activity keys, and the sentence without it. */
function negations(text: string): { avoid: string[]; rest: string } {
  const avoid: string[] = [];
  let rest = text;
  for (const m of text.matchAll(NEGATED)) {
    const activity = activityIn(m[1] ?? "");
    if (!activity) continue;
    avoid.push(activity.key);
    rest = rest.replace(m[0], " ");
  }
  return { avoid: [...new Set(avoid)], rest };
}

export function readAsk(said: string, context: ReadContext): DiscoveryAsk {
  const lowered = said.toLowerCase().replace(/[’']/g, "'");
  // **Said no to first**, so "outside but not hiking" never chooses hiking.
  const { avoid, rest: text } = negations(lowered);

  // **A drive they will make is a limit; "worth the drive" is a lens.**
  // "Happy to drive an hour", "within 20 minutes" and — in answer to *how
  // far?* — a bare "maybe 45 minutes" are how far they will go. "Worth
  // driving an hour for" and "a road trip" are asking for somewhere further.
  const travel = travelIn(text);
  const bare =
    context.expecting === "distance" && travel.minutes === undefined
      ? BARE_SPAN.exec(text)
      : null;
  const driveMatch = DRIVE.exec(text);
  const tolerance =
    bare !== null ||
    (travel.minutes !== undefined &&
      (!driveMatch ||
        (!/\bworth\b|\b(?:road|day)\s*trip/.test(text) &&
          TOLERANCE.test(text.slice(0, driveMatch.index + 1) + " "))));
  const driveMinutes = tolerance
    ? (travel.minutes ?? (bare ? spanMinutes(bare) : undefined))
    : undefined;
  const drive = driveMatch !== null && !tolerance;
  const driveHours =
    drive && driveMatch ? driveHoursIn(driveMatch[0]) : undefined;
  // `readBrief` reads hours, a stated age, a town, a stated distance and
  // shelter — the parts both pages must read identically.
  const forBrief = tolerance
    ? bare
      ? text.replace(bare[0], " ")
      : travel.rest
    : drive
      ? text.replace(DRIVE, " ")
      : text;
  // "5" after *how old?* is an age.
  const ageAnswer =
    context.expecting === "age"
      ? /^\D*(\d{1,2})\D*$/.exec(forBrief)?.[1]
      : undefined;
  const brief = readBrief(
    ageAnswer !== undefined ? `${ageAnswer} year old` : forBrief,
  );

  const partOfDay = /\bafternoon\b/.test(text)
    ? ("afternoon" as const)
    : /\bmorning\b/.test(text)
      ? ("morning" as const)
      : /\b(evening|tonight|after dinner|after supper|after work|night out)\b/.test(
            text,
          )
        ? ("evening" as const)
        : undefined;

  const weekday = WEEKDAYS.findIndex((w) =>
    new RegExp(`\\b${w}\\b`).test(text),
  );
  const daysAhead = relativeDays(text);
  const on =
    daysAhead !== undefined
      ? plusDays(context.today, daysAhead)
      : weekday >= 0
        ? nextWeekday(context.today, weekday)
        : /\bnext weekend\b/.test(text)
          ? plusDays(nextWeekday(context.today, 6), 7)
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

  // "All afternoon" is the afternoon, and most of it.
  const hours =
    brief.hours ??
    (/\ball afternoon\b|\bthe whole afternoon\b/.test(text) ? 4 : undefined);
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
    : /\bwalking distance\b|\bwalkable\b|\bon foot\b/.test(text)
      ? WALKING_KM
      : undefined;
  const near = NEAR.test(lowered) || undefined;

  const different = DIFFERENT.test(text);
  const unusual =
    !different &&
    (UNUSUAL.test(text) ||
      (brief.appetite === "odd" && !/\bsurprise\b/.test(text)));
  const adventure = ADVENTURE.test(text);
  const pair = company !== "child" && PAIR.test(text);
  const asksOn = ON.test(text);
  const surprise = SURPRISE.test(text);
  // **The most specific question wins the lens**; everything else it said
  // still applies — the hours still draw the circle, the day still filters.
  const lens: AskLens | undefined = drive
    ? "drive"
    : unusual
      ? "unusual"
      : adventure
        ? "adventure"
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
                  : surprise
                    ? "surprise"
                    : undefined;
  // "What's on?" with no day is about today.
  const day = on ?? (asksOn ? context.today : undefined);
  const shelter =
    brief.shelter ?? (FINE.test(text) ? ("outdoor" as const) : undefined);

  const doing = activityIn(text)?.key;
  const gentle = GENTLE.test(text);
  const free = asksForFree(text);

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
    ...(driveMinutes !== undefined ? { driveMinutes } : {}),
    ...(doing ? { doing } : {}),
    ...(avoid.length > 0 ? { avoid } : {}),
    ...(free ? { free: true as const } : {}),
    ...(gentle ? { gentle: true as const } : {}),
    ...(different ? { different: true as const } : {}),
    ...(RESET.test(text) ? { reset: true as const } : {}),
    ...(shelter ? { shelter } : {}),
    ...(pair ? { pair: true as const } : {}),
    ...(lens ? { lens } : {}),
    ...(drive && driveHours !== undefined ? { driveHours } : {}),
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
  if (ask.lens === "surprise") out.push("surprise me");
  if (ask.lens === "adventure") out.push("something adventurous");
  if (ask.different) out.push("something different");
  if (ask.lens === "unusual") out.push("something unusual");
  if (ask.lens === "drive") out.push("worth the drive");
  if (ask.driveHours !== undefined)
    out.push(`${driveSpan(ask.driveHours)} each way`);
  if (ask.lens === "on") out.push("what's on");
  if (ask.doing)
    out.push((activityByKey(ask.doing)?.label ?? ask.doing).toLowerCase());
  for (const key of ask.avoid ?? [])
    out.push(`no ${(activityByKey(key)?.label ?? key).toLowerCase()}`);
  if (ask.free) out.push("free");
  if (ask.gentle) out.push("easy going");
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
  if (ask.withinKm === WALKING_KM) out.push("walking distance");
  else if (ask.withinKm !== undefined) out.push(`within ${ask.withinKm} km`);
  else if (ask.driveMinutes !== undefined)
    out.push(
      ask.driveMinutes % 60 === 0
        ? `up to ${driveSpan(ask.driveMinutes / 60)} away`
        : `up to ${ask.driveMinutes} min away`,
    );
  else if (ask.near) out.push("close by");
  if (context.townName) out.push(`from ${context.townName}`);
  if (ask.shelter === "indoor") out.push("staying dry");
  if (ask.shelter === "outdoor") out.push("outdoors");
  return out;
}
