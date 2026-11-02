import { homeIn, startIn } from "@/domain/day/brief";
import type { Evening, StopTag } from "./evenings";
import {
  addStop,
  clock,
  endingOf,
  fixedAt,
  homeAt,
  homeBy,
  layOut,
  optionStop,
  removeStop,
  ruleOf,
  switchEnding,
  type PlanStop,
} from "./itinerary";
import type { DayOption, NightDay } from "./types";

/**
 * **"Let's spend more time at the lake and get home by eight."**
 *
 * One sentence, read against the itinerary the two of you already have, and
 * answered with that same itinerary changed — never a second one. The
 * reading is deterministic: the Day Builder's own clock readers (`startIn`,
 * `homeIn`) for times, the night's checked Atlas places (`TOMORROW`) for
 * "somewhere warm for dinner" or "something fun along the way", and the
 * itinerary's own rules for the sunset, the least each stop can shrink to,
 * and what's fixed. No model is called and nothing is invented: a place is
 * only ever one Atlas holds, and a request nothing can meet changes nothing
 * and says why. The person sees before → after and applies it (doctrine
 * §2.5: change what was asked, leave everything else alone).
 */

export type Reading =
  | {
      readonly kind: "change";
      readonly heard: readonly string[];
      readonly stops: readonly PlanStop[];
    }
  | { readonly kind: "none"; readonly reply: string };

export const EXAMPLES = [
  "Let's leave later",
  "Get us home by eight",
  "Find somewhere warm for dinner",
  "Skip the swim",
  "Make it more romantic",
  "We want more time at the lake",
  "Find something fun along the way",
];

/**
 * What the reader understands, said plainly on the page: it is a set of
 * rules, not a model, and a person should know where its edges are.
 */
export const UNDERSTANDS = [
  "leaving earlier or later, or at a time",
  "home by a time",
  "more or less time somewhere",
  "skipping a stop",
  "somewhere warm for dinner",
  "more romantic",
  "something fun on the way",
] as const;

/** What a tag is called when it isn't on the plan. */
const NOUN: Partial<Record<StopTag, string>> = {
  swim: "swim",
  hunt: "hunt",
  fire: "fire",
  stars: "stargazing",
  dinner: "dinner",
  sunset: "sunset stop",
  pools: "hot pools",
  lake: "lake",
};

const WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
};

/** Lower case, number words as digits, "o'clock" gone. */
export function normalise(said: string): string {
  return said
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\bhalf an? hour\b/g, "30 minutes")
    .replace(/\ban hour and a half\b/g, "90 minutes")
    .replace(/\ban? (hour|hr)\b/g, "1 $1")
    .replace(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,
      (w) => WORDS[w]!,
    )
    .replace(/\s*o'?clock\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** What a word in a sentence points at on the plan. */
const TARGETS: readonly [RegExp, StopTag][] = [
  [/\b(swim|swimming|dip|plunge)\b/, "swim"],
  [/\b(hunt|hunting|grouse|birds?|shooting)\b/, "hunt"],
  [/\b(fire|campfire)\b/, "fire"],
  [/\b(stars|stargazing)\b/, "stars"],
  [/\b(dinner|supper|food|eat|eating|restaurant)\b/, "dinner"],
  [/\b(sunset)\b/, "sunset"],
  [/\b(pools?|hot springs?|soak)\b/, "pools"],
  [/\b(lake|water|shore)\b/, "lake"],
];

function targetIn(text: string): StopTag | undefined {
  return TARGETS.find(([pattern]) => pattern.test(text))?.[1];
}

/** "1 hour", "45 minutes", "20 min" → minutes. */
function amountIn(text: string): number | undefined {
  const m = text.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Math.round(m[2]!.startsWith("h") ? n * 60 : n);
}

/** An evening's "8" means 8 pm. */
function evening(minutes: number, after: number): number {
  return minutes < 12 * 60 && minutes + 12 * 60 > after
    ? minutes + 12 * 60
    : minutes;
}

const has = (
  stop: PlanStop,
  tag: StopTag,
  e: Evening | undefined,
  day: NightDay,
) => ruleOf(e, stop, day).tags.includes(tag);

/** The stop a word is about: the main one first, then the first in time. */
function find(
  stops: readonly PlanStop[],
  tag: StopTag,
  e: Evening | undefined,
  day: NightDay,
): number {
  const all = stops
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => has(s, tag, e, day) && !fixedAt(stops, i));
  if (all.length === 0) return -1;
  // "the lake" is the lake stop itself before anything else at the lake,
  // and never the cold dip when something else is there.
  const exact = all.find(({ s }) => ruleOf(e, s, day).tags[0] === tag);
  const dry =
    tag === "swim"
      ? undefined
      : all.find(({ s }) => !ruleOf(e, s, day).tags.includes("swim"));
  return (exact ?? dry ?? all[0]!).i;
}

/** A checked Atlas place open for the whole of `[at, at + minutes]`. */
function openFor(option: DayOption, at: number, minutes: number): boolean {
  if (option.opens === undefined || option.closes === undefined) return false;
  return at >= option.opens && at + minutes <= option.closes;
}

export function readRequest(
  said: string,
  current: readonly PlanStop[],
  e: Evening | undefined,
  day: NightDay,
  sunset: number,
): Reading {
  const text = normalise(said);
  if (!text || current.length === 0)
    return {
      kind: "none",
      reply: "Choose an adventure first, then tell me what to change.",
    };
  let stops: PlanStop[] = current.map((s) => ({ ...s }));
  const heard: string[] = [];
  // Understood, but nothing to change: said only if nothing else is.
  const notes: string[] = [];
  const name = e?.composed ? "this plan" : (e?.title ?? "this plan");
  const missing = (tag: StopTag) => {
    const noun = NOUN[tag];
    if (noun && !stops.some((s) => has(s, tag, e, day)))
      notes.push(`There's no ${noun} on ${name}, so nothing changed there.`);
  };
  const protect = new Set<string>();
  const relay = () => {
    stops = layOut(stops, stops[0]!.at, sunset, e, day);
  };
  const dinnerIndex = () =>
    stops.findIndex((s) => has(s, "dinner", e, day) && s.atlasRef);
  /** A dinner that isn't a place: "Dinner to go". */
  const takeaway = () =>
    stops.findIndex(
      (s, i) => has(s, "dinner", e, day) && !s.atlasRef && !fixedAt(stops, i),
    );

  // ------------------------------------------------ the ending, or dinner
  const wantsWarm =
    /\b(somewhere|something|place) (warm|cozy|cosy|inside|indoors)\b|\bwarm (dinner|ending|place|meal)\b|\b(cozy|cosy) dinner\b|\bdinner (in|back in) (town|vernon)\b|\bdrive back\b.*\bdinner\b/.test(
      text,
    );
  const wantsWild =
    /\bstay (wild|out|at the lake)\b|\b(fire|dinner|eat|cook) (at|by) the lake\b|\bcamp(fire)? (dinner|food)\b/.test(
      text,
    );
  const ending = endingOf(stops, e);
  if (wantsWarm || wantsWild) {
    const to = wantsWarm ? "warm" : "wild";
    const target = e?.endings?.find((x) => x.id === to);
    if (target && ending?.id !== to) {
      stops = switchEnding(stops, e!, to, sunset, day);
      heard.push(
        to === "warm"
          ? `The ending changes: drive back toward Vernon for dinner at BNA Brewing (open till 10). The lake part stays as it is.`
          : "The ending changes: fire, warm food and stars at the lake. Everything before it stays.",
      );
    } else if (target) {
      notes.push(
        to === "warm"
          ? `Dinner's already somewhere warm: ${stops[dinnerIndex()]?.title.replace(/^Dinner at /, "") ?? "back in town"}.`
          : "You're already staying out at the lake.",
      );
    } else if (wantsWarm && dinnerIndex() >= 0) {
      notes.push(
        `Dinner's already somewhere warm: ${stops[dinnerIndex()]!.title.replace(/^Dinner at /, "")}.`,
      );
    } else if (wantsWarm && dinnerIndex() < 0 && takeaway() >= 0) {
      // Dinner to go becomes a sit-down dinner at a checked place open then.
      const t = takeaway();
      const now = stops[t]!;
      const option = day.options.find(
        (o) => o.phase === "unwind" && openFor(o, now.at, o.minutes),
      );
      if (option) {
        stops[t] = {
          ...optionStop(option, "dinner", now.travel),
          at: now.at,
          ...(now.id ? { id: now.id } : {}),
        };
        relay();
        heard.push(
          `${now.title} becomes a sit-down dinner at ${option.title}, open ${clock(option.opens!)}–${clock(option.closes!)}.`,
        );
      } else
        notes.push(
          "No place Atlas has checked is open for a sit-down dinner then, so dinner stays as it is.",
        );
    } else if (wantsWarm && dinnerIndex() < 0) {
      const home = stops.findIndex((s) => s.key === "home");
      const at =
        home > 0 ? stops[home - 1]!.at + stops[home - 1]!.minutes : 18 * 60;
      const option = day.options.find(
        (o) => o.phase === "unwind" && openFor(o, at + 15, o.minutes),
      );
      if (option) {
        stops = addStop(
          stops,
          optionStop(option, "dinner", 15),
          undefined,
          sunset,
          e,
          day,
        );
        heard.push(
          `Dinner at ${option.title}, open till ${clock(option.closes!)}.`,
        );
      }
    }
  }

  const another =
    /\b(another|different|other|new) (dinner|restaurant|place to eat|spot for dinner)\b|\bsomewhere else (for|to eat)\b/.test(
      text,
    );
  const romantic = /\bromantic|romance\b/.test(text);
  if (another || romantic) {
    const d = dinnerIndex();
    if (d >= 0) {
      const now = stops[d]!;
      const pool = day.options.filter(
        (o) =>
          o.phase === "unwind" &&
          o.atlasRef !== now.atlasRef &&
          (!romantic || o.moods.includes("romantic")),
      );
      // Sure-to-be-open first; a place with no stated hours says so.
      const pick = pool.find((o) => openFor(o, now.at, o.minutes)) ?? pool[0];
      if (pick) {
        stops[d] = {
          ...optionStop(pick, "dinner", now.travel),
          at: now.at,
          ...(now.id ? { id: now.id } : {}),
        };
        relay();
        heard.push(
          `Dinner moves to ${pick.title}${pick.opens !== undefined ? `, open till ${clock(pick.closes!)}` : ""}. ${pick.caution ?? ""}`.trim(),
        );
      }
    } else if (
      romantic &&
      stops.some((s) => ruleOf(e, s, day).romance !== undefined)
    ) {
      const i = stops.findIndex((s) => ruleOf(e, s, day).romance);
      const s = stops[i]!;
      const romance = ruleOf(e, s, day).romance!;
      const shift = romance.endAt - (s.at + s.minutes);
      if (shift >= 5) {
        stops = layOut(stops, stops[0]!.at + shift, sunset, e, day);
        heard.push(`${romance.line} Leave at ${clock(stops[0]!.at)}.`);
      } else notes.push(`${s.title} already runs to ${clock(romance.endAt)}.`);
    } else if (romantic) {
      const i = find(stops, "stars", e, day);
      const j = i >= 0 ? i : find(stops, "sunset", e, day);
      if (j >= 0) {
        stops[j] = { ...stops[j]!, minutes: stops[j]!.minutes + 20 };
        protect.add(stops[j]!.title);
        relay();
        heard.push(`Twenty more minutes for ${spokenTitle(stops[j]!.title)}.`);
      }
    }
  }

  // ---------------------------------------------------------- removals
  const drop = text.match(
    /\b(skip|drop|remove|cut|lose|ditch|forget|no|without|not doing|don't do|instead of)\b(?: the| a| any| our)?(?: \w+)?/g,
  );
  if (drop) {
    for (const phrase of drop) {
      const rest = text.slice(text.indexOf(phrase));
      const tag = targetIn(rest.split(/\b(and|but|then)\b/)[0]!);
      if (!tag || /\bno (later|earlier|more|less)\b/.test(phrase)) continue;
      const i = find(stops, tag, e, day);
      if (i < 0) {
        missing(tag);
        continue;
      }
      const rule = ruleOf(e, stops[i]!, day);
      if (rule.main && rule.tags[0] !== tag) {
        notes.push(
          `${stops[i]!.title} is the heart of ${name}. To skip it, choose another adventure.`,
        );
        continue;
      }
      const title = stops[i]!.title;
      const removed = removeStop(stops, i, sunset, e, day);
      if (removed) {
        stops = removed;
        heard.push(`${title} comes off the plan.`);
      }
    }
  }

  // ------------------------------------------------- along the way
  if (
    /\b(something|somewhere) fun\b|\balong the way\b|\bon the way\b/.test(text)
  ) {
    const after = 0;
    const at = stops[after]!.at + stops[after]!.minutes;
    const held = new Set(stops.map((s) => s.atlasRef));
    const option = day.options.find(
      (o) =>
        o.phase !== "unwind" &&
        !held.has(o.atlasRef) &&
        o.reach <= 15 &&
        openFor(o, at + o.reach, o.minutes),
    );
    if (option) {
      stops = addStop(stops, optionStop(option, "fun"), after, sunset, e, day);
      heard.push(
        `${option.title} on the way out: ${option.line} Open till ${clock(option.closes!)}.`,
      );
    } else
      heard.push(
        "Nothing Atlas holds is sure to be open on the way at that time, so I've left the way there as it is.",
      );
  }

  // --------------------------------------------- more or less time at X
  const longer = text.match(
    /\b(more time|longer|extra time|more|linger)\b[^.]*?\b(at|by|with|for|on|in)\b(?: the)? (\w+(?: \w+)?)/,
  );
  const shorter = text.match(
    /\b(less time|shorter|not as long|quicker)\b[^.]*?\b(at|by|with|for|on|in)\b(?: the)? (\w+(?: \w+)?)/,
  );
  for (const [m, sign] of [
    [longer, 1],
    [shorter, -1],
  ] as const) {
    if (!m) continue;
    const tag = targetIn(m[3]!);
    if (!tag) continue;
    const i = find(stops, tag, e, day);
    if (i < 0) {
      missing(tag);
      continue;
    }
    const by = amountIn(text.slice(m.index ?? 0)) ?? 30;
    const s = stops[i]!;
    const rule = ruleOf(e, s, day);
    if (
      sign > 0 &&
      rule.tags.includes("swim") &&
      !rule.tags.includes("pools")
    ) {
      notes.push(
        "The cold dip stays short: a minute or two is the safe amount. Say “more time at the sunset” to linger by the water.",
      );
      continue;
    }
    const least = ruleOf(e, s, day).least;
    const minutes = Math.max(
      sign > 0 ? s.minutes : least,
      s.minutes + sign * by,
    );
    if (minutes === s.minutes) continue;
    stops[i] = { ...s, minutes };
    protect.add(s.title);
    relay();
    heard.push(
      `${sign > 0 ? "More" : "Less"} time for ${spokenTitle(s.title.replace(/^Explore /, ""))}: ${minutes} minutes instead of ${s.minutes}.`,
    );
  }

  // ------------------------------------------------------- leave time
  const leaving = stops[0]!.at;
  const absolute = startIn(text);
  const relative = text.match(
    /\b(?:(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?) )?(earlier|sooner|later)\b/,
  );
  const aboutLeaving =
    /\b(leave|leaving|start|starting|go|going|head(?:ing)? out|get going|set off|out the door)\b/.test(
      text,
    );
  let leaveAt: number | undefined;
  const leavingRelative =
    relative &&
    aboutLeaving &&
    !/\bhome\b[^.]*\b(earlier|sooner|later)\b/.test(text);
  // "leave 1 hour earlier" is not "leave at 1".
  if (absolute !== undefined && !leavingRelative)
    leaveAt = evening(absolute, 10 * 60);
  else if (relative && leavingRelative) {
    const n = relative[1] ? Number(relative[1]) : undefined;
    const by =
      n === undefined
        ? 30
        : relative[2]!.startsWith("h")
          ? Math.round(n * 60)
          : Math.round(n);
    leaveAt = leaving + (relative[3] === "later" ? by : -by);
  }
  if (leaveAt !== undefined && leaveAt !== leaving) {
    const before = stops;
    stops = layOut(stops, leaveAt, sunset, e, day);
    const diff = leaving - leaveAt;
    // The stop that stretches gives or takes the difference, so the sunset
    // stays where it was: say which, and by how much.
    const giver = stops.findIndex((s) => ruleOf(e, s, day).stretch);
    const gave =
      giver >= 0 ? stops[giver]!.minutes - before[giver]!.minutes : 0;
    heard.push(
      `Leave at ${clock(leaveAt)}, ${diff > 0 ? `${spoken(diff)} earlier` : `${spoken(-diff)} later`}.${
        gave !== 0
          ? ` ${gave > 0 ? `${spoken(gave)} more` : `${spoken(-gave)} less`} for ${spokenTitle(stops[giver]!.title.replace(/ along .*$/, ""))}, so you still catch the sunset.`
          : ""
      }`,
    );
  }

  // ---------------------------------------------------------- home by
  let by = homeIn(text);
  const homeRelative = text.match(
    /\bhome\b[^.]*?\b(?:(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?) )?(earlier|sooner)\b/,
  );
  const end = homeAt(stops)!;
  if (by !== undefined) by = evening(by, stops[0]!.at);
  else if (homeRelative) {
    const n = homeRelative[1] ? Number(homeRelative[1]) : undefined;
    by =
      end -
      (n === undefined
        ? 30
        : homeRelative[2]!.startsWith("h")
          ? Math.round(n * 60)
          : Math.round(n));
  }
  if (by !== undefined) {
    if (end <= by)
      notes.push(`Home by ${clock(by)}: you already are, about ${clock(end)}.`);
    else {
      const protectIdx = new Set(
        stops.flatMap((s, i) => (protect.has(s.title) ? [i] : [])),
      );
      const fit = homeBy(stops, by, sunset, e, day, protectIdx);
      stops = fit.stops;
      if (fit.over > 0)
        heard.push(
          `Home by ${clock(by)} doesn't fit without dropping something: the closest is ${clock(homeAt(stops)!)}. Say what to skip.`,
        );
      else
        heard.push(
          `Home by ${clock(by)}: ${fit.trimmed.length ? `a little less time for ${fit.trimmed.map(spokenTitle).join(" and ")}` : "it fits"}.`,
        );
    }
  }

  // A place that closes may have given time back: say so.
  stops.forEach((s, i) => {
    const closes = ruleOf(e, s, day).closesAt;
    const was = current.find((c) => c.title === s.title);
    if (
      closes !== undefined &&
      was &&
      s.minutes < was.minutes &&
      s.at + s.minutes === closes &&
      i > 0
    )
      heard.push(
        `That leaves ${spoken(s.minutes)} at ${s.title}, which closes at ${clock(closes)}.`,
      );
  });

  if (heard.length === 0)
    return {
      kind: "none",
      reply: notes.length
        ? notes.join(" ")
        : PLACE_ASK.test(text)
          ? "Passport only suggests places Atlas has checked for this night, and none of them fits that, so it won't make one up. If you know a place, add it with Add something."
          : `I didn't catch a change in that. I understand ${UNDERSTANDS.slice(0, -1).join(", ")} and ${UNDERSTANDS[UNDERSTANDS.length - 1]}.`,
    };
  return { kind: "change", heard: [...heard, ...notes], stops };
}

/** Asking for a place or a thing to do, rather than a change of time. */
const PLACE_ASK =
  /\b(find|somewhere|some place|a place|go to|go for|instead|restaurant|cafe|coffee|bar|pub|pizza|sushi|bowling|movie|show|museum|winery|brewery|spa)\b/;

/**
 * A stop's title inside a sentence: "dinner at BNA Brewing", "stars", but a
 * name stays a name ("King Edward Lake").
 */
export function spokenTitle(title: string): string {
  const words = title.split(" ");
  if (words.length > 1 && words.every((w) => /^[A-Z0-9&]/.test(w)))
    return title;
  return title.charAt(0).toLowerCase() + title.slice(1);
}

function spoken(minutes: number): string {
  if (minutes % 60 === 0)
    return minutes === 60 ? "an hour" : `${minutes / 60} hours`;
  if (minutes === 30) return "half an hour";
  if (minutes > 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${minutes} minutes`;
}

// ------------------------------------------------------------- preview

export interface DiffRow {
  readonly title: string;
  readonly before?: number;
  readonly after?: number;
  readonly change: "same" | "moved" | "new" | "gone";
}

const identity = (s: PlanStop) => s.id ?? `${s.key ?? ""}|${s.title}`;

/** Before → after, a row a stop, the way the preview shows it. */
export function diffPlans(
  before: readonly PlanStop[],
  after: readonly PlanStop[],
): DiffRow[] {
  const was = new Map(before.map((s) => [identity(s), s]));
  const rows: DiffRow[] = after.map((s) => {
    const old = was.get(identity(s));
    was.delete(identity(s));
    if (!old) return { title: s.title, after: s.at, change: "new" };
    const moved =
      Math.abs(old.at - s.at) >= 5 || Math.abs(old.minutes - s.minutes) >= 5;
    return {
      title: s.title,
      before: old.at,
      after: s.at,
      change: moved ? "moved" : "same",
    };
  });
  for (const s of was.values())
    rows.push({ title: s.title, before: s.at, change: "gone" });
  return rows;
}

/** A change that adds or takes away a stop, or moves the night an hour. */
export function substantial(rows: readonly DiffRow[]): boolean {
  return rows.some(
    (r) =>
      r.change === "new" ||
      r.change === "gone" ||
      (r.before !== undefined &&
        r.after !== undefined &&
        Math.abs(r.after - r.before) >= 60),
  );
}
