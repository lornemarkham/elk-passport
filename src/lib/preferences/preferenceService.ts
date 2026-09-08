import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PassportUser } from "@/lib/auth/currentUser";
import { EXPLICIT } from "./vocabulary";
import {
  defaultPreferences,
  preferencesFromRows,
  validateChange,
  type Preferences,
} from "./vocabulary";

/**
 * **Reading and writing what a person has explicitly chosen.**
 *
 * Every row written here carries `source = 'explicit'`, which the database
 * constrains to that single value. That is not decoration: it means a future
 * learned-signal layer physically cannot deposit "they seem to like hiking"
 * alongside "keep it family-friendly", and the two can never be confused for
 * having the same authority. See `vocabulary` for the full reasoning.
 */
export async function preferencesFor(user: PassportUser): Promise<Preferences> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("passport_preferences")
    .select("key, value")
    .eq("user_id", user.id)
    // Explicitly `explicit`, even though a CHECK constraint currently makes
    // every row here explicit anyway.
    //
    // The constraint is the thing most likely to be relaxed the day learned
    // signals arrive — that is what it is for. On that day a read without this
    // filter silently starts mixing observations into the set of things the
    // person actually *said*, and `preferencesFromRows` keeps whichever row
    // happens to arrive last. A boundary somebody set would quietly lose to a
    // pattern a model noticed, which is the single failure this whole
    // separation exists to prevent, and it would fail without an error.
    //
    // Matching the write (which already stamps 'explicit') costs one line and
    // stays correct whether learned signals eventually live in this table or
    // in their own.
    .eq("source", EXPLICIT);

  // Defaults are a complete, working answer, so a read failure degrades to
  // "they have chosen nothing yet" rather than breaking every page that asks.
  if (error || !data) return defaultPreferences();

  return preferencesFromRows(data);
}

export interface PreferenceUpdateResult {
  readonly preferences: Preferences;
  /** Names that were refused because the vocabulary does not declare them. */
  readonly rejected: readonly string[];
}

/**
 * Apply a set of changes.
 *
 * Unrecognised names are **refused and reported**, never silently dropped and
 * never stored anyway: a setting Passport cannot name is a setting it cannot
 * honour, and writing it would create the appearance of a boundary that nothing
 * enforces.
 */
export async function savePreferences(
  user: PassportUser,
  changes: Readonly<Record<string, unknown>>,
): Promise<PreferenceUpdateResult> {
  const supabase = await createSupabaseServerClient();
  const rejected: string[] = [];
  const rows: {
    user_id: string;
    key: string;
    value: unknown;
    source: typeof EXPLICIT;
    updated_at: string;
  }[] = [];

  const now = new Date().toISOString();

  for (const [name, value] of Object.entries(changes)) {
    const valid = validateChange(name, value);
    if (!valid) {
      rejected.push(name);
      continue;
    }
    rows.push({
      user_id: user.id,
      key: valid.storageKey,
      value: valid.value,
      source: EXPLICIT,
      updated_at: now,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("passport_preferences")
      .upsert(rows, { onConflict: "user_id,key" });

    if (error) {
      throw new Error(`Could not save settings: ${error.message}`);
    }
  }

  return { preferences: await preferencesFor(user), rejected };
}
