/**
 * **The settings a person can actually state, and nothing else.**
 *
 * ## Why a closed list in code rather than an open one in the database
 *
 * `passport_preferences` is a key/value table, which makes it extensible
 * without a migration per product question — and would make it a junk drawer if
 * anything could write any key. This file is the constraint: a preference
 * exists because it is declared here, with a type, a default and a sentence
 * saying what it changes. A key that is not here is refused.
 *
 * That also means the whole vocabulary is greppable. Nobody has to read the
 * database to learn what Passport thinks it knows about somebody.
 *
 * ## The line this file must not cross
 *
 * Everything here is something the person **said**. Nothing here is something
 * Passport **noticed**.
 *
 * ```
 * "Keep it family-friendly while I'm browsing with the kids."   belongs here
 * "They open a lot of hiking pages."                            does not
 * ```
 *
 * The second is a real and useful thing to learn, and it has different
 * authority: an observation may shape what gets shown first, and it may never
 * override a boundary somebody set. The database enforces the split with
 * `source = 'explicit'`; this file is the other half of it. When learned
 * signals arrive they get their own store, their own weight and their own
 * vocabulary — they do not get keys in here.
 *
 * ## Deliberately small
 *
 * Six settings. This is not a taxonomy of human interests and must not grow
 * into one: an interest list long enough to describe anybody is long enough
 * that nobody fills it in. Each entry earns its place by changing something
 * Passport does, and a new one waits until it would.
 *
 * ## Nothing here is required
 *
 * Every setting has a default that makes Passport work. There is no onboarding
 * questionnaire, and answering none of these costs a person nothing — which is
 * the point. Passport gives before it asks.
 */

export type PreferenceValue = string | number | boolean | readonly string[];

interface PreferenceDefinition<T extends PreferenceValue> {
  readonly key: string;
  /** What a person sees. Their words, not the schema's. */
  readonly label: string;
  /** One line saying what this actually changes. Shown under the control. */
  readonly help: string;
  readonly fallback: T;
  /** Returns the value, or `undefined` if the stored one is not valid. */
  readonly parse: (raw: unknown) => T | undefined;
}

const bool = (
  key: string,
  label: string,
  help: string,
  fallback: boolean,
): PreferenceDefinition<boolean> => ({
  key,
  label,
  help,
  fallback,
  parse: (raw) => (typeof raw === "boolean" ? raw : undefined),
});

const choice = <T extends string>(
  key: string,
  label: string,
  help: string,
  options: readonly T[],
  fallback: T,
): PreferenceDefinition<T> & { readonly options: readonly T[] } => ({
  key,
  label,
  help,
  fallback,
  options,
  parse: (raw) =>
    typeof raw === "string" && (options as readonly string[]).includes(raw)
      ? (raw as T)
      : undefined,
});

const tags = (
  key: string,
  label: string,
  help: string,
  options: readonly string[],
): PreferenceDefinition<readonly string[]> & {
  readonly options: readonly string[];
} => ({
  key,
  label,
  help,
  fallback: [],
  options,
  parse: (raw) =>
    Array.isArray(raw) &&
    raw.every(
      (v) =>
        typeof v === "string" && (options as readonly string[]).includes(v),
    )
      ? (raw as string[])
      : undefined,
});

/**
 * Interests, kept short on purpose.
 *
 * These are the things people around here actually plan a day around. The list
 * is a starting vocabulary, not a claim to be complete, and it is short enough
 * that somebody will genuinely tick three boxes rather than abandon a form.
 */
export const INTEREST_OPTIONS = [
  "hiking",
  "water",
  "skiing",
  "food and drink",
  "arts and culture",
  "history",
  "wildlife",
  "astronomy",
  "cycling",
  "fishing",
  "live music",
  "markets",
] as const;

export const CONTENT_COMFORT_OPTIONS = [
  "family-friendly",
  "no restrictions",
] as const;

export const PACE_OPTIONS = ["gentle", "mixed", "ambitious"] as const;

export const PREFERENCES = {
  interests: tags(
    "interests",
    "What you're into",
    "Nothing is hidden because of this — it only affects what Passport leads with.",
    INTEREST_OPTIONS,
  ),

  /**
   * The one setting here with real authority.
   *
   * A person browsing with their kids in the car is stating a boundary, not a
   * taste, and no amount of learned enthusiasm may talk Passport out of it.
   * That is exactly why it is an explicit preference and could never be an
   * inferred one.
   */
  contentComfort: choice(
    "content_comfort",
    "Content",
    "Family-friendly leaves out late-night and adult-oriented suggestions.",
    CONTENT_COMFORT_OPTIONS,
    "no restrictions",
  ),

  pace: choice(
    "pace",
    "Pace",
    "How much effort a suggested day should assume.",
    PACE_OPTIONS,
    "mixed",
  ),

  /**
   * Kilometres, because this is Canada and Atlas holds one valley.
   * `0` means "don't filter on distance", which is the honest default while
   * Passport cannot reliably measure it.
   */
  maxDriveKm: {
    key: "max_drive_km",
    label: "How far you'll drive",
    help: "0 means no limit. Passport does not filter on this yet — it is stored so it can.",
    fallback: 0,
    parse: (raw: unknown) =>
      typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 2000
        ? raw
        : undefined,
  } satisfies PreferenceDefinition<number>,

  /**
   * The default a newly created board gets. Not a per-board setting — that
   * lives on the board itself; this is only what the checkbox starts at.
   */
  shareBoardsByDefault: bool(
    "share_boards_by_default",
    "New boards start shareable",
    "Off means a new board is private until you share it.",
    false,
  ),

  reduceMotion: bool(
    "reduce_motion",
    "Reduce motion",
    "Turns down animation across Passport. Your device setting is respected regardless.",
    false,
  ),
} as const;

export type PreferenceKey = keyof typeof PREFERENCES;

/** The stored key for a definition, e.g. `interests` → `"interests"`. */
export const storageKey = (key: PreferenceKey): string => PREFERENCES[key].key;

/** Every declared key, by its stored name. */
export const KEYS_BY_STORAGE: ReadonlyMap<string, PreferenceKey> = new Map(
  (Object.keys(PREFERENCES) as PreferenceKey[]).map((k) => [
    PREFERENCES[k].key,
    k,
  ]),
);

/**
 * Everything Passport knows a person has chosen, with defaults filled in.
 *
 * Always complete, so no consumer has to handle "unset" — a person who has
 * never opened settings gets a working Passport, which is the whole contract.
 */
export interface Preferences {
  readonly interests: readonly string[];
  readonly contentComfort: (typeof CONTENT_COMFORT_OPTIONS)[number];
  readonly pace: (typeof PACE_OPTIONS)[number];
  readonly maxDriveKm: number;
  readonly shareBoardsByDefault: boolean;
  readonly reduceMotion: boolean;
}

export function defaultPreferences(): Preferences {
  return {
    interests: PREFERENCES.interests.fallback,
    contentComfort: PREFERENCES.contentComfort.fallback,
    pace: PREFERENCES.pace.fallback,
    maxDriveKm: PREFERENCES.maxDriveKm.fallback,
    shareBoardsByDefault: PREFERENCES.shareBoardsByDefault.fallback,
    reduceMotion: PREFERENCES.reduceMotion.fallback,
  };
}

/**
 * Build the complete set from whatever rows exist.
 *
 * A stored value that no longer parses — a removed interest, a renamed option,
 * a hand-edited row — falls back to the default rather than throwing. Settings
 * are not the place to take the app down, and a person should never be locked
 * out of the page that would let them fix it.
 */
export function preferencesFromRows(
  rows: readonly { key: string; value: unknown }[],
): Preferences {
  const result = { ...defaultPreferences() } as Record<string, PreferenceValue>;

  for (const row of rows) {
    const name = KEYS_BY_STORAGE.get(row.key);
    if (!name) continue; // A key nobody declares is not a preference.

    const parsed = PREFERENCES[name].parse(row.value as never);
    if (parsed !== undefined) result[name] = parsed;
  }

  return result as unknown as Preferences;
}

/**
 * Validate one incoming change.
 *
 * Returns the storage key and value to write, or `undefined` for anything this
 * vocabulary does not recognise. Callers refuse rather than guessing — a
 * setting Passport cannot name is a setting it cannot honour.
 */
export function validateChange(
  name: string,
  value: unknown,
): { storageKey: string; value: PreferenceValue } | undefined {
  // `Object.hasOwn` and not `in`: `"__proto__" in PREFERENCES` is true through
  // the prototype chain, and `PREFERENCES["__proto__"]` then hands back
  // Object.prototype — an object with no `parse`, reached from request data.
  if (!Object.hasOwn(PREFERENCES, name)) return undefined;

  const definition = PREFERENCES[name as PreferenceKey];
  const parsed = definition.parse(value as never);
  if (parsed === undefined) return undefined;

  return { storageKey: definition.key, value: parsed };
}
