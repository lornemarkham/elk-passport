import type { Experience } from "@/domain/experience/types";
import type { Point } from "@/domain/discovery/situation";
import { distanceLabel, distanceTo } from "@/domain/discovery/proximity";
import { weekdayOf } from "@/domain/discovery/recurrence";
import {
  ageBecause,
  ageEvidence,
  ageLine,
  needsAdult,
} from "@/domain/discovery/suitability";
import { rainBecause, rainLine } from "@/domain/discovery/environment";

/**
 * **"Let's do this" — the smallest honest thing between finding something and
 * going.**
 *
 * This is the first vertical slice of planning and it is deliberately not an
 * itinerary engine. It schedules nothing, sequences nothing, routes nothing and
 * optimises nothing. It takes one subject, one date and — where somebody has
 * shared it — one position, and it **repeats what Atlas states**, under the
 * headings a person actually needs before leaving the house.
 *
 * ## Every fact has three possible states, and the third one is the point
 *
 * ```
 * known      Atlas states it, and the sentence it came from is carried
 * ruled out  Atlas states something that contradicts the plan
 * unknown    Atlas holds nothing — said out loud, never filled in
 * ```
 *
 * A plan that silently omits what it does not know reads exactly like a plan
 * that checked. Measured on the live corpus, the honest answer is *unknown*
 * most of the time: 2,494 of 2,680 subjects have no age evidence at all, 1,813
 * have no geography, and 16 of 365 dated subjects state the days they recur
 * on. So `unknown` is a first-class result here rather than an empty slot.
 *
 * ## The one thing this must never do
 *
 * **Present a season as an opening.** Atlas frequently knows that something
 * runs between two dates and nothing whatever about which days inside that run
 * it is open — `Osoyoos Farmers' Market 2026 Season` holds a 161-day interval
 * and opens 23 times. A plan that turns the first into "open on your date" is
 * the single most expensive lie this page could tell, because somebody acts on
 * it by driving somewhere. So an interval without a pattern is reported as an
 * interval, in those words.
 */
export interface PlanFact {
  readonly label: string;
  /** What Atlas states. Absent when it states nothing. */
  readonly value?: string;
  /** The sentence it was read from, in its source's words. Never rewritten. */
  readonly because?: string;
  /** Why nothing can be said. Present exactly when `value` is absent. */
  readonly unknown?: string;
  /** Atlas states something that argues against this plan, as stated. */
  readonly against?: true;
}

export interface PlanLink {
  readonly label: string;
  readonly href: string;
}

export interface DayPlan {
  readonly id: string;
  readonly title: string;
  /** The town or venue Atlas can vouch for, or absent. */
  readonly where?: string;
  /** `YYYY-MM-DD`, exactly as it was asked. */
  readonly on?: string;
  /** The verbs Atlas states for this subject, in its own words. */
  readonly doing: readonly string[];
  readonly facts: readonly PlanFact[];
  /** Conditions of entry and rules, each in the words a publisher used. */
  readonly restrictions: readonly string[];
  /** Headings this plan has nothing to put under. Printed, not hidden. */
  readonly unknowns: readonly string[];
  readonly links: readonly PlanLink[];
}

export interface PlanInput {
  /** The day somebody picked, `YYYY-MM-DD`. Absent when they picked none. */
  readonly on?: string;
  /** Where they are, already blunted. Absent unless they shared it. */
  readonly origin?: Point;
  /** The age they named. Absent unless they named one — never defaulted. */
  readonly childAge?: number;
}

const title = (day: string): string => {
  const weekday = weekdayOf(day);
  const written = new Intl.DateTimeFormat("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
  return weekday
    ? `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${written}`
    : written;
};

/** The verbs Atlas states, deduplicated, in its own words. */
const doingAt = (experience: Experience): readonly string[] => {
  const seen = new Map<string, string>();
  for (const { name } of experience.knowledge?.affordances ?? []) {
    const key = name?.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }
  return [...seen.values()];
};

/**
 * **What Atlas knows about whether this is on, on this day.**
 *
 * Four different answers, deliberately kept apart. The third is the one the
 * doctrine's *evidence over invention* exists for.
 */
function openingFact(experience: Experience, on: string | undefined): PlanFact {
  const label = "Open on your date";
  if (!on) {
    return {
      label,
      unknown: "No date picked yet.",
    };
  }

  const occurrence = experience.occurrence;

  if (occurrence?.days?.length) {
    if (occurrence.days.includes(on)) {
      return {
        label,
        value: `${on} is one of the ${occurrence.days.length} days this runs.`,
        ...(occurrence.because ? { because: occurrence.because } : {}),
      };
    }
    return {
      label,
      value: `This runs on ${occurrence.days.length} dates, and ${on} is not one of them.`,
      against: true,
      ...(occurrence.because ? { because: occurrence.because } : {}),
    };
  }

  if (occurrence?.weekdays?.length) {
    const weekday = weekdayOf(on);
    const named = occurrence.weekdays.map((d) => d.toLowerCase());
    const stated = named
      .map((d) => `${d.charAt(0).toUpperCase()}${d.slice(1)}s`)
      .join(", ");
    if (weekday && named.includes(weekday)) {
      return {
        label,
        value: `Runs on ${stated} — and ${on} is a ${weekday}.`,
        ...(occurrence.because ? { because: occurrence.because } : {}),
      };
    }
    return {
      label,
      value: `Runs on ${stated}${weekday ? `, and ${on} is a ${weekday}` : ""}.`,
      against: true,
      ...(occurrence.because ? { because: occurrence.because } : {}),
    };
  }

  // **A run is not a schedule.** Atlas has two dates and no pattern between
  // them, so the only true sentence is the one about the two dates.
  const { startTime, endTime } = experience;
  if (startTime && endTime && startTime.slice(0, 10) !== endTime.slice(0, 10)) {
    return {
      label,
      value: `On somewhere between ${startTime.slice(0, 10)} and ${endTime.slice(0, 10)}. Which days inside that it actually opens has not been published — so this is a season, not an opening. Check before you go.`,
      ...(occurrence?.because ? { because: occurrence.because } : {}),
    };
  }
  if (startTime && startTime.slice(0, 10) === on) {
    return { label, value: `On ${on}.` };
  }
  if (startTime) {
    return {
      label,
      value: `The one date for this is ${startTime.slice(0, 10)}, which is not ${on}.`,
      against: true,
    };
  }

  const times = experience.availability?.timesOfDay ?? [];
  if (times.length > 0) {
    return {
      label,
      value: `Start times are published — ${times.join(", ")} — but no dates, so we cannot say whether ${on} is one of them.`,
    };
  }

  return {
    label,
    unknown:
      "No opening hours have been published. That does not mean it is shut — check with them before you go.",
  };
}

/**
 * **Travel, and the capability Passport does not have.**
 *
 * There is no routing service behind Passport, so there is no drive time to
 * give. A straight line between two stated coordinates is a real measurement
 * and is offered as exactly that; anything else says so.
 */
function travelFact(
  experience: Experience,
  origin: Point | undefined,
): PlanFact {
  const label = "How far";
  if (!origin) {
    return {
      label,
      unknown: "Tell us where you are starting from and we can measure this.",
    };
  }
  const km = distanceTo(experience, origin);
  if (km === undefined) {
    return {
      label,
      unknown:
        "No map location has been published for this, so we cannot measure the distance.",
    };
  }
  return {
    label,
    value: `${distanceLabel(km)} in a straight line — not a drive time.`,
  };
}

/** Rules and conditions of entry, each in the words somebody published. */
function restrictionsFor(
  experience: Experience,
  childAge: number | undefined,
): readonly string[] {
  const out: string[] = [];
  for (const condition of experience.knowledge?.conditions ?? []) {
    const text = condition.trim();
    if (text) out.push(text);
  }
  // A rule is a condition of entry. A characterisation is somebody's turn of
  // phrase, and printing the second under this heading is how a product sends
  // a parent somewhere on the strength of the word "family".
  for (const statement of experience.suitability?.statements ?? []) {
    if (statement.strength !== "rule") continue;
    const text = statement.text?.trim();
    if (text && !out.includes(text)) out.push(text);
  }
  const adult = needsAdult(experience, childAge);
  if (adult && !out.includes(adult)) out.push(adult);
  return out;
}

export function dayPlan(
  experience: Experience,
  { on, origin, childAge }: PlanInput = {},
): DayPlan {
  const facts: PlanFact[] = [];

  facts.push({
    label: "What you would be doing",
    ...(doingAt(experience).length > 0
      ? { value: doingAt(experience).join(" · ") }
      : {
          unknown:
            "Nothing specific has been published about what you can do here. The description below is all we have.",
        }),
  });

  facts.push(openingFact(experience, on));
  facts.push(travelFact(experience, origin));

  // Age, only ever as the verdict Atlas returned for the age that was asked.
  const age = ageEvidence(experience, childAge);
  facts.push({
    label:
      childAge === undefined
        ? "Who it suits"
        : `Suitable for a ${childAge}-year-old`,
    ...(childAge === undefined
      ? {
          unknown: "Tell us who is coming and we can check age rules.",
        }
      : age.verdict === "unknown"
        ? {
            unknown: `No age rules have been published for this one. That is not a yes and it is not a no — most places say nothing either way.`,
          }
        : {
            value: ageLine(experience, childAge) ?? "",
            ...(ageBecause(experience, childAge)
              ? { because: ageBecause(experience, childAge)! }
              : {}),
            ...(age.verdict === "excluded" ? { against: true as const } : {}),
          }),
  });

  // What a publisher stated plainly — hours, admission, parking. Carried under
  // their own labels, because "Admission: by donation" is their sentence.
  for (const { label, value } of experience.knowledge?.practical ?? []) {
    const text = value?.trim();
    if (label?.trim() && text) facts.push({ label: label.trim(), value: text });
  }

  const rain = rainLine(experience);
  facts.push({
    label: "If it rains",
    ...(rain
      ? {
          value: rain,
          ...(rainBecause(experience)
            ? { because: rainBecause(experience)! }
            : {}),
        }
      : {
          unknown: "Nothing published about whether rain affects this.",
        }),
  });

  const features = experience.knowledge?.features ?? [];
  if (features.length > 0) {
    facts.push({ label: "What is there", value: features.join(" · ") });
  }

  const links: PlanLink[] = [];
  const point = experience.geography?.coordinates;
  if (point) {
    links.push({
      label: "Directions",
      href: `https://www.google.com/maps/search/?api=1&query=${point[1]},${point[0]}`,
    });
  } else if (experience.geography?.locality) {
    // A town and a name is a weaker door than a point, and it is the strongest
    // one Atlas can open here — so it is offered, and nothing pretends it is
    // the point.
    links.push({
      label: "Find it on a map",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${experience.title}, ${experience.geography.locality}`,
      )}`,
    });
  }
  // A URL a publisher printed inside a fact is a real source. Nothing else is
  // offered as one — Passport never constructs an "official site".
  const seen = new Set<string>();
  for (const { label, value } of experience.knowledge?.practical ?? []) {
    const href = value?.match(/https?:\/\/[^\s)"'<>]+/)?.[0];
    if (href && !seen.has(href)) {
      seen.add(href);
      links.push({ label: label?.trim() || "Source", href });
    }
  }

  return {
    id: experience.id,
    title: experience.title,
    ...(experience.geography?.locality
      ? { where: experience.geography.locality }
      : experience.venue?.name
        ? { where: experience.venue.name }
        : {}),
    ...(on ? { on } : {}),
    doing: doingAt(experience),
    facts,
    restrictions: restrictionsFor(experience, childAge),
    unknowns: facts.filter((f) => f.unknown).map((f) => f.label),
    links,
  };
}

/** The date, written the way the plan prints it. Exported for the surface. */
export const planDateLine = (on: string): string => title(on);
