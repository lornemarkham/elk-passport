/**
 * **Advent Adventure** (owner brief M1053 "Holiday Season 2026 + Advent
 * Adventure"): 25 doors, December 1–25, one holiday adventure behind each,
 * and after Christmas a New Year's adventure a day until January 3.
 *
 * What a family tells it is a handful of taps, every one optional — who is
 * coming, the children's ages, how far, what it may cost, inside or out,
 * what they love. Where they are is the place every Christmas page shares
 * (ADR 020), not a question of its own. Nothing here needs an account: the
 * choices live in a cookie the server can read (so the doors are picked
 * from Atlas for this family), and what has been opened, swapped and done
 * stays on this browser (`progress.ts`).
 */

export const ADVENT_YEAR = 2026;
/** The doors: December 1 to Christmas Day. */
export const DOORS = 25;
/** After Christmas: a New Year's adventure a day, December 26 – January 3. */
export const AFTER_DAYS = 9;

export type Who = "family" | "friends" | "couple" | "solo";
export type AdventBudget = "free" | "inexpensive" | "any";
export type Setting = "indoor" | "outdoor" | "either";
export type Interest =
  | "lights"
  | "markets"
  | "santa"
  | "shows"
  | "food"
  | "outdoors"
  | "crafts"
  | "movies"
  | "giving";

/** Kilometres, straight-line, as the brief offers them. */
export const ADVENT_DISTANCES = [15, 30, 60] as const;
export const ADVENT_DEFAULT_KM = 30;

export interface AdventPrefs {
  readonly who?: Who;
  /** Children's ages, 0–17. */
  readonly ages: readonly number[];
  readonly km: number;
  readonly budget: AdventBudget;
  readonly setting: Setting;
  readonly interests: readonly Interest[];
  /** A family's own shuffle, so two families' calendars differ. */
  readonly seed: number;
}

export const WHO_CHOICES: readonly {
  readonly value: Who;
  readonly label: string;
  readonly emoji: string;
}[] = [
  { value: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { value: "friends", label: "Friends", emoji: "🧑‍🤝‍🧑" },
  { value: "couple", label: "The two of us", emoji: "💑" },
  { value: "solo", label: "Just me", emoji: "🙋" },
];

/** Ages as a parent taps them: a band, read as its youngest age. */
export const AGE_BANDS: readonly {
  readonly age: number;
  readonly label: string;
}[] = [
  { age: 2, label: "Under 5" },
  { age: 5, label: "5–8" },
  { age: 9, label: "9–12" },
  { age: 13, label: "Teens" },
];

export const BUDGET_CHOICES: readonly {
  readonly value: AdventBudget;
  readonly label: string;
}[] = [
  { value: "free", label: "Free" },
  { value: "inexpensive", label: "Inexpensive" },
  { value: "any", label: "Any" },
];

export const SETTING_CHOICES: readonly {
  readonly value: Setting;
  readonly label: string;
}[] = [
  { value: "indoor", label: "Indoors" },
  { value: "outdoor", label: "Outdoors" },
  { value: "either", label: "Either" },
];

export const INTEREST_CHOICES: readonly {
  readonly value: Interest;
  readonly label: string;
  readonly emoji: string;
}[] = [
  { value: "lights", label: "Lights", emoji: "✨" },
  { value: "markets", label: "Markets", emoji: "🎪" },
  { value: "santa", label: "Santa", emoji: "🎅" },
  { value: "shows", label: "Shows & music", emoji: "🎶" },
  { value: "food", label: "Baking & treats", emoji: "🍪" },
  { value: "outdoors", label: "Snow & outdoors", emoji: "⛄" },
  { value: "crafts", label: "Crafts", emoji: "✂️" },
  { value: "movies", label: "Movies", emoji: "🎬" },
  { value: "giving", label: "Kindness", emoji: "💝" },
];

const WHO = new Set<string>(WHO_CHOICES.map((c) => c.value));
const BUDGETS = new Set<string>(BUDGET_CHOICES.map((c) => c.value));
const SETTINGS = new Set<string>(SETTING_CHOICES.map((c) => c.value));
const INTERESTS = new Set<string>(INTEREST_CHOICES.map((c) => c.value));

export const ADVENT_COOKIE = "xm-advent";

export const DEFAULT_PREFS: AdventPrefs = {
  ages: [],
  km: ADVENT_DEFAULT_KM,
  budget: "any",
  setting: "either",
  interests: [],
  seed: 0,
};

/**
 * Read the cookie, a query string (`who=family&ages=5,9&km=30…`). Anything
 * unrecognised is dropped, never guessed — a hand-edited cookie can only
 * narrow to choices the page offers.
 */
export function readPrefs(raw: string | undefined): AdventPrefs {
  if (!raw) return DEFAULT_PREFS;
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(decodeURIComponent(raw));
  } catch {
    return DEFAULT_PREFS;
  }
  const who = q.get("who") ?? "";
  const km = Number(q.get("km"));
  const budget = q.get("budget") ?? "";
  const setting = q.get("set") ?? "";
  const seed = Number(q.get("s"));
  const ages = (q.get("ages") ?? "")
    .split(",")
    .filter((s) => /^\d{1,2}$/.test(s))
    .map(Number)
    .filter((n) => n <= 17);
  const interests = (q.get("like") ?? "")
    .split(",")
    .filter((s): s is Interest => INTERESTS.has(s));
  return {
    ...(WHO.has(who) ? { who: who as Who } : {}),
    ages: [...new Set(ages)].slice(0, 4),
    km: (ADVENT_DISTANCES as readonly number[]).includes(km)
      ? km
      : ADVENT_DEFAULT_KM,
    budget: BUDGETS.has(budget) ? (budget as AdventBudget) : "any",
    setting: SETTINGS.has(setting) ? (setting as Setting) : "either",
    interests: [...new Set(interests)],
    seed: Number.isInteger(seed) && seed > 0 && seed < 1e9 ? seed : 0,
  };
}

/** Back to the cookie's query string, leaving out what was never said. */
export function writePrefs(prefs: AdventPrefs): string {
  const q = new URLSearchParams();
  if (prefs.who) q.set("who", prefs.who);
  if (prefs.ages.length) q.set("ages", prefs.ages.join(","));
  if (prefs.km !== ADVENT_DEFAULT_KM) q.set("km", String(prefs.km));
  if (prefs.budget !== "any") q.set("budget", prefs.budget);
  if (prefs.setting !== "either") q.set("set", prefs.setting);
  if (prefs.interests.length) q.set("like", prefs.interests.join(","));
  if (prefs.seed) q.set("s", String(prefs.seed));
  return q.toString();
}

/** Whether a family has said anything yet (the first visit asks, once). */
export const hasSaid = (prefs: AdventPrefs) =>
  Boolean(
    prefs.who ||
    prefs.ages.length ||
    prefs.km !== ADVENT_DEFAULT_KM ||
    prefs.budget !== "any" ||
    prefs.setting !== "either" ||
    prefs.interests.length,
  );

// ------------------------------------------------------------------- days

/** A day of the experience: a door (1–25) or a day after Christmas (26–34). */
export interface AdventDay {
  /** 1–25 are doors; 26–34 run December 26 to January 3. */
  readonly n: number;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly door: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dayOf(n: number): AdventDay {
  if (n <= 31)
    return { n, date: `${ADVENT_YEAR}-12-${pad(n)}`, door: n <= DOORS };
  return { n, date: `${ADVENT_YEAR + 1}-01-${pad(n - 31)}`, door: false };
}

export const ALL_DAYS: readonly AdventDay[] = Array.from(
  { length: DOORS + AFTER_DAYS },
  (_, i) => dayOf(i + 1),
);

/** The day numbers that are open today: every day up to and including it. */
export function openDays(today: string): AdventDay[] {
  return ALL_DAYS.filter((d) => d.date <= today);
}

/** Today's day of the experience, if today is one. */
export const todayOf = (today: string): AdventDay | undefined =>
  ALL_DAYS.find((d) => d.date === today);

/** Where the experience is: before the doors, the doors, after, or over. */
export type Stage = "before" | "doors" | "after" | "over";

export function stageOf(today: string): Stage {
  if (today < dayOf(1).date) return "before";
  if (today <= dayOf(DOORS).date) return "doors";
  if (today <= dayOf(DOORS + AFTER_DAYS).date) return "after";
  return "over";
}

// ---------------------------------------------------------------- preview

/**
 * **Advent Preview Mode** (owner brief M1074, 2026-11-23): until midnight
 * Pacific on December 1, 2026 (08:00 UTC — Pacific is UTC-8 in winter) all
 * 25 doors open so the calendar can be played with. It ends itself: after
 * that instant `previewActive` is false whatever else is set, and the doors
 * go back to opening on their own day.
 *
 * To turn it off sooner, set `ADVENT_PREVIEW=off` in the server's
 * environment (or change `PREVIEW_ENABLED`). There is no visitor control.
 */
export const PREVIEW_ENABLED = true;
export const PREVIEW_ENDS = "2026-12-01T08:00:00Z";

export function previewActive(
  now: Date = new Date(),
  flag: string | undefined = process.env.ADVENT_PREVIEW,
): boolean {
  if (!PREVIEW_ENABLED || flag === "off") return false;
  return now.getTime() < Date.parse(PREVIEW_ENDS);
}

/** All 25 doors, ignoring the date. */
export const previewDays = (): AdventDay[] => ALL_DAYS.filter((d) => d.door);

/** Whole days from `from` to `to`. */
export const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );

/** "Tuesday, December 1" — a calendar day, no zone. */
export const longDay = (date: string) =>
  new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

/** What a day after Christmas is called, where it has a name. */
export function dayName(day: AdventDay): string | undefined {
  switch (day.date.slice(5)) {
    case "12-24":
      return "Christmas Eve";
    case "12-25":
      return "Christmas Day";
    case "12-26":
      return "Boxing Day";
    case "12-31":
      return "New Year's Eve";
    case "01-01":
      return "New Year's Day";
  }
  return undefined;
}
