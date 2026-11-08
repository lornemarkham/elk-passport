import { groupLine } from "./ability";
import {
  chosenFor,
  proposalsFor,
  votesFor,
  type Proposal,
  type SnowDay,
  type Topic,
} from "./day";
import { apresRank, filterPicks, type Pick } from "./nearby";
import { liftHoursOn, type ResortFacts } from "./resorts";

/**
 * **One suggested day on the mountain, and how it changes when you say so.**
 *
 * A pure function of what is known: the crew's decisions, the resort's
 * published hours, the Atlas places near the mountain, and a few tweaks a
 * person made. Every stop says what it rests on, so the screen can keep
 * facts and suggestions visibly apart (doctrine §5):
 *
 * - `decided`   — the crew locked it in. Never moved by a tweak.
 * - `crew`      — someone in the crew suggested it; not locked yet.
 * - `published` — the resort's own published fact (with its source).
 * - `atlas`     — a real Atlas place Passport is suggesting. A suggestion.
 * - `suggested` — Passport's idea of timing or shape. Nobody's fact.
 *
 * It never invents a place: where Atlas holds nothing that fits, the stop is
 * a `gap` that says so.
 */
export type Basis = "decided" | "crew" | "published" | "atlas" | "suggested";

export interface Stop {
  readonly id: string;
  readonly time?: string;
  readonly title: string;
  readonly detail?: string;
  readonly who: "everyone" | "riders" | "others";
  readonly basis: Basis;
  /** The Atlas place behind it, when there is one. */
  readonly pick?: Pick;
  /** The decision this stop is about, so the screen can offer "Add". */
  readonly topic?: Topic;
  readonly source?: { readonly label: string; readonly url: string };
  /** Nothing real fits here; this says what's missing. */
  readonly gap?: string;
}

export interface Tweaks {
  /** `HH:MM`, 24 h. */
  readonly lunchAt: string;
  readonly stay: "mountain" | "anywhere";
  /** How many suggestions to skip, per kind ("make après more interesting"). */
  readonly skip: {
    readonly lunch: number;
    readonly apres: number;
    readonly activity: number;
  };
}

export const DEFAULT_TWEAKS: Tweaks = {
  lunchAt: "12:30",
  stay: "anywhere",
  skip: { lunch: 0, apres: 0, activity: 0 },
};

export function parseTweaks(raw: unknown): Tweaks {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Tweaks>;
  const n = (v: unknown) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 50 ? v : 0;
  return {
    lunchAt:
      typeof r.lunchAt === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(r.lunchAt)
        ? r.lunchAt
        : DEFAULT_TWEAKS.lunchAt,
    stay: r.stay === "mountain" ? "mountain" : "anywhere",
    skip: {
      lunch: n(r.skip?.lunch),
      apres: n(r.skip?.apres),
      activity: n(r.skip?.activity),
    },
  };
}

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const toClock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** "12:30" → "12:30 pm", "09:00" → "9:00 am". */
export function clockWords(t: string): string {
  const m = toMin(t);
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** The crew's own pick for a topic: locked, else most votes, else first said. */
export function crewPick(
  day: SnowDay,
  topic: Topic,
): { proposal: Proposal; locked: boolean } | undefined {
  const locked = chosenFor(day, topic);
  if (locked) return { proposal: locked, locked: true };
  const all = proposalsFor(day, topic);
  if (all.length === 0) return undefined;
  const best = [...all].sort(
    (a, b) => votesFor(day, b.id) - votesFor(day, a.id),
  )[0];
  return { proposal: best, locked: false };
}

const pickFor = (picks: readonly Pick[], label: string) =>
  picks.find((p) => p.title.toLowerCase() === label.toLowerCase());

function rotate<T>(list: readonly T[], skip: number): T | undefined {
  return list.length ? list[skip % list.length] : undefined;
}

export interface ComposeInput {
  readonly day: SnowDay;
  readonly mountainName?: string;
  readonly facts?: ResortFacts;
  readonly picks: readonly Pick[];
  readonly tweaks: Tweaks;
}

export interface Composed {
  readonly stops: readonly Stop[];
  /** Plain lines under the plan: what it assumed, what it couldn't know. */
  readonly notes: readonly string[];
}

export function composeDay(input: ComposeInput): Composed {
  const { day, facts, picks, tweaks } = input;
  const riders = day.people.filter((p) => p.discipline !== "apres");
  const others = day.people.filter((p) => p.discipline === "apres");
  const where = input.mountainName ?? "the mountain";
  const stops: Stop[] = [];
  const notes: string[] = [];
  const stay = tweaks.stay === "mountain";
  const hours = liftHoursOn(facts, day.date);
  const liftsOpen = hours?.value.from ?? "09:00";
  const liftsClose = hours?.value.to;

  // Decided or crew-chosen first; Atlas suggestion only where nobody has said.
  function decision(
    topic: Topic,
    candidates: readonly Pick[],
    skip: number,
    gapWords: string,
  ): Omit<Stop, "id" | "time" | "who"> {
    const crew = crewPick(day, topic);
    if (crew)
      return {
        title: crew.proposal.label,
        detail: crew.proposal.detail,
        basis: crew.locked ? "decided" : "crew",
        pick: pickFor(picks, crew.proposal.label),
        topic,
      };
    const pick = rotate(candidates, skip);
    if (pick)
      return {
        title: pick.title,
        detail: `${pick.onMountain ? "On the mountain" : `${pick.km} km in a straight line`}${pick.locality ? ` · ${pick.locality}` : ""} · Atlas: ${pick.evidence.slice(0, 3).join(", ")}`,
        basis: "atlas",
        pick,
        topic,
      };
    return { title: gapWords, basis: "suggested", topic, gap: gapWords };
  }

  // ---- morning
  const transport = crewPick(day, "transport");
  stops.push({
    id: "meet",
    time: day.meetTime ?? toClock(toMin(liftsOpen) - 90),
    title: transport
      ? transport.proposal.label
      : `Meet and head up to ${where}`,
    detail: transport
      ? undefined
      : "How you're getting there isn't decided yet. Check road conditions at DriveBC before you leave.",
    who: "everyone",
    basis:
      day.meetTime || transport?.locked
        ? "decided"
        : transport
          ? "crew"
          : "suggested",
    topic: "transport",
    source: { label: "DriveBC road conditions", url: "https://www.drivebc.ca" },
  });
  stops.push({
    id: "lifts",
    time: liftsOpen,
    title: hours ? "Lifts open" : "First chair",
    detail: hours
      ? `“${hours.quote}”`
      : "Lift hours are the resort's to publish; Passport doesn't have them for this mountain.",
    who: riders.length ? "riders" : "everyone",
    basis: hours ? "published" : "suggested",
    source: hours ? { label: "Resort's hours", url: hours.source } : undefined,
  });
  if (riders.length)
    stops.push({
      id: "ride-am",
      time: liftsOpen,
      title: `Ride: ${riders.map((r) => r.name).join(", ")}`,
      detail: groupLine(day.people),
      who: "riders",
      basis: "suggested",
    });

  const forOthers = filterPicks(picks, {
    nonSkier: true,
    onMountainOnly: stay,
    date: day.date,
  }).filter((p) => !p.categories.every((c) => c === "lunch" || c === "apres"));
  if (others.length) {
    const act = decision(
      "activity",
      forOthers,
      tweaks.skip.activity,
      stay
        ? "Nothing in Atlas for a non-skier on the mountain yet"
        : "Nothing in Atlas for a non-skier near here yet",
    );
    stops.push({
      id: "others-am",
      time: toClock(toMin(liftsOpen) + 60),
      who: "others",
      ...act,
      title: act.gap
        ? act.title
        : `${others.map((o) => o.name).join(", ")}: ${act.title}`,
    });
  }

  // ---- lunch
  // Lunch is on the mountain whatever "stay" says: the riders are up there,
  // and a 30-minute drive down and back is not lunch on a ski day.
  const lunchSpots = filterPicks(picks, {
    category: "lunch",
    onMountainOnly: true,
  });
  const lunch = decision(
    "meals",
    lunchSpots,
    tweaks.skip.lunch,
    "Atlas has no lunch spot on the mountain yet",
  );
  stops.push({
    id: "lunch",
    time: tweaks.lunchAt,
    who: "everyone",
    ...lunch,
    title: lunch.gap ? lunch.title : `Lunch: ${lunch.title}`,
    detail: lunch.gap
      ? "Passport won't invent one. Pack a lunch, or pick from the resort's own list and add it under Meals."
      : lunch.detail,
    source:
      lunch.gap && facts?.links.dining
        ? { label: "The resort's own dining list", url: facts.links.dining }
        : undefined,
  });

  // ---- afternoon
  if (others.length) {
    const second = forOthers.filter(
      (p) =>
        p.title !==
        (stops.find((s) => s.id === "others-am")?.pick?.title ?? ""),
    );
    const pm = rotate(second, tweaks.skip.activity);
    if (pm && !crewPick(day, "activity"))
      stops.push({
        id: "others-pm",
        time: toClock(toMin(tweaks.lunchAt) + 75),
        title: `${others.map((o) => o.name).join(", ")}: ${pm.title}`,
        detail: `${pm.onMountain ? "On the mountain" : `${pm.km} km in a straight line`} · Atlas: ${pm.evidence.slice(0, 3).join(", ")}`,
        who: "others",
        basis: "atlas",
        pick: pm,
        topic: "activity",
      });
  }
  if (riders.length)
    stops.push({
      id: "last-run",
      time: liftsClose ? toClock(toMin(liftsClose) - 30) : undefined,
      title: "Last run together",
      detail: liftsClose
        ? `Lifts close at ${clockWords(liftsClose)} (published). Meet at the bottom.`
        : "Before the lifts close — the resort's hours say when.",
      who: "riders",
      basis: "suggested",
    });

  // ---- après
  const apresSpots = apresRank(
    stay ? picks.filter((p) => p.onMountain) : picks,
  );
  const apres = decision(
    "apres",
    apresSpots,
    tweaks.skip.apres,
    stay
      ? "Atlas has no après spot on the mountain yet"
      : "Atlas has no après spot near here yet",
  );
  stops.push({
    id: "apres",
    time: liftsClose ?? undefined,
    who: "everyone",
    ...apres,
    title: apres.gap ? apres.title : `Après: ${apres.title}`,
    detail: apres.gap
      ? "Passport won't invent one. The resort lists its own; or say “Après in town”."
      : apres.detail,
    source:
      apres.gap && facts?.links.dining
        ? { label: "The resort's own dining list", url: facts.links.dining }
        : undefined,
  });

  // ---- events that day
  if (day.date)
    for (const ev of picks
      .filter((p) => p.categories.includes("events") && p.date === day.date)
      .slice(0, 2))
      stops.push({
        id: `event-${ev.id}`,
        title: `Also on: ${ev.title}`,
        detail: `Atlas lists it for this date · ${ev.km} km away`,
        who: "everyone",
        basis: "atlas",
        pick: ev,
      });

  stops.push({
    id: "home",
    title: "Head home",
    detail:
      "Whoever drives stays alcohol-free. Check DriveBC before the drive down.",
    who: "everyone",
    basis: "suggested",
  });

  if (!day.date)
    notes.push("No date yet — opening hours and events depend on it.");
  if (!hours && facts?.liftHours)
    notes.push(
      "The resort's published lift hours don't cover this date; check its hours page.",
    );
  notes.push(
    "Times are Passport's suggestion. Lift status, snow and hours on the day are the resort's to say.",
  );
  return { stops, notes };
}

// ------------------------------------------------------- saying a change

export type Reading =
  { ok: true; tweaks: Tweaks; said: string } | { ok: false; said: string };

/**
 * **A change in words**, read by rules — not a model — so it does exactly
 * what it says and leaves everything else alone (doctrine §2.5). What it
 * can't read, it says so and lists what it can.
 */
export const CAN_SAY = [
  "Add somewhere for lunch",
  "Find something for the non-skier",
  "Make après more interesting",
  "Keep us on the mountain",
  "Move lunch earlier",
] as const;

export function readChange(
  text: string,
  tweaks: Tweaks,
  day: SnowDay,
  picks: readonly Pick[] = [],
): Reading {
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/è/g, "e")} `;
  const locked = (topic: Topic, what: string) => {
    const c = chosenFor(day, topic);
    return c
      ? ({
          ok: false,
          said: `${what} is locked in (${c.label}). Reopen it under ${what} to change it.`,
        } as const)
      : undefined;
  };

  // "lunch at 12", "lunch at 1:15"
  const at = t.match(/lunch (?:at|for) (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (at) {
    let h = Number(at[1]);
    if (at[3] === "pm" && h < 12) h += 12;
    if (!at[3] && h < 7) h += 12;
    const m = Number(at[2] ?? 0);
    if (h < 10 || h > 15 || m > 59)
      return { ok: false, said: "Lunch between 10 and 3 works on a ski day." };
    const lunchAt = toClock(h * 60 + m);
    return {
      ok: true,
      tweaks: { ...tweaks, lunchAt },
      said: `Lunch moves to ${clockWords(lunchAt)}.`,
    };
  }
  if (/lunch/.test(t) && /\b(earlier|sooner|early)\b/.test(t)) {
    const lunchAt = toClock(
      Math.max(toMin("11:00"), toMin(tweaks.lunchAt) - 30),
    );
    if (lunchAt === tweaks.lunchAt)
      return {
        ok: false,
        said: "Lunch is already at 11:00, the earliest that works.",
      };
    return {
      ok: true,
      tweaks: { ...tweaks, lunchAt },
      said: `Lunch moves earlier, to ${clockWords(lunchAt)}.`,
    };
  }
  if (/lunch/.test(t) && /\b(later|late)\b/.test(t)) {
    const lunchAt = toClock(
      Math.min(toMin("14:00"), toMin(tweaks.lunchAt) + 30),
    );
    if (lunchAt === tweaks.lunchAt)
      return {
        ok: false,
        said: "Lunch is already at 2:00 pm, the latest that works.",
      };
    return {
      ok: true,
      tweaks: { ...tweaks, lunchAt },
      said: `Lunch moves later, to ${clockWords(lunchAt)}.`,
    };
  }
  if (/\b(lunch|eat|food|hungry)\b/.test(t)) {
    const l = locked("meals", "Meals");
    if (l) return l;
    if (
      !crewPick(day, "meals") &&
      !filterPicks(picks, { category: "lunch", onMountainOnly: true }).length
    )
      return {
        ok: false,
        said: "Atlas doesn't hold a lunch spot on this mountain yet, so Passport won't make one up. The resort lists its own (linked on the Lunch stop), and the gap is in the Atlas request below.",
      };
    const skip = crewPick(day, "meals")
      ? tweaks.skip.lunch
      : tweaks.skip.lunch + (/(another|different|else|other)/.test(t) ? 1 : 0);
    return {
      ok: true,
      tweaks: { ...tweaks, skip: { ...tweaks.skip, lunch: skip } },
      said: crewPick(day, "meals")
        ? "Lunch is the crew's pick; it stays."
        : "Lunch: a real place from Atlas, at the time you have.",
    };
  }
  if (
    /(non-?skier|doesn't ski|don't ski|not skiing|isn't skiing|non-?riders?|for (him|her|them) to do|something to do)/.test(
      t,
    )
  ) {
    if (!day.people.some((p) => p.discipline === "apres"))
      return {
        ok: false,
        said: "Nobody in the crew is marked as not skiing. In Crew, set them to “Après & the lodge only”.",
      };
    const l = locked("activity", "Activities");
    if (l) return l;
    return {
      ok: true,
      tweaks: {
        ...tweaks,
        skip: { ...tweaks.skip, activity: tweaks.skip.activity + 1 },
      },
      said: "Something else for whoever isn't skiing, from Atlas.",
    };
  }
  if (/apres/.test(t) || /after (the )?(lifts|skiing)/.test(t)) {
    const l = locked("apres", "Après");
    if (l) return l;
    return {
      ok: true,
      tweaks: {
        ...tweaks,
        skip: { ...tweaks.skip, apres: tweaks.skip.apres + 1 },
      },
      said: "A different après, from Atlas.",
    };
  }
  if (
    /(keep us|stay|stick) (on|up) (the )?(mountain|hill)|on the mountain|don't (want to )?(drive|leave)/.test(
      t,
    )
  )
    return tweaks.stay === "mountain"
      ? { ok: false, said: "You're already staying on the mountain." }
      : {
          ok: true,
          tweaks: { ...tweaks, stay: "mountain" },
          said: "Everything stays on the mountain.",
        };
  if (/(into town|in town|off the mountain|anywhere|down the hill)/.test(t))
    return tweaks.stay === "anywhere"
      ? { ok: false, said: "Town is already allowed." }
      : {
          ok: true,
          tweaks: { ...tweaks, stay: "anywhere" },
          said: "Town is back in play.",
        };
  return {
    ok: false,
    said: `Passport reads changes by rules, not AI, and didn't catch that one. Try: ${CAN_SAY.map((c) => `“${c}”`).join(", ")}.`,
  };
}

/** Which stops a change would touch — for the preview before applying. */
export function changedStops(before: Composed, after: Composed): Stop[] {
  const key = (s: Stop) => `${s.id}|${s.time}|${s.title}`;
  const was = new Set(before.stops.map(key));
  return after.stops.filter((s) => !was.has(key(s)));
}
