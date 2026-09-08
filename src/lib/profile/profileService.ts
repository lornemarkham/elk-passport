import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PassportUser } from "@/lib/auth/currentUser";

/**
 * **Account facts about a person, kept deliberately few.**
 *
 * Three editable fields, each of which changes something Passport does and none
 * of which Passport could work out on its own:
 *
 * ```
 * displayName  what the account control renders, and what a board's other
 *              members see instead of a uuid
 * homeArea     a general area in their own words — never coordinates, and
 *              never the device's location
 * timezone     "this weekend" is a different pair of instants in Vernon and
 *              in Berlin, and Passport resolves it before asking Atlas
 * ```
 *
 * ## Why a row can be missing, and why that is fine
 *
 * A profile is created the first time somebody saves one, not on signup. There
 * is no onboarding step and no trigger, so a brand-new account has no row here
 * at all — and `profileFor` returns the Supabase-derived defaults rather than
 * `null`. Passport gives before it asks, which includes not making an empty
 * form the price of admission.
 *
 * ## What is not here
 *
 * Preferences. An account fact is what somebody *is*; a preference is what they
 * *want*. Collapsing the two is how a settings page becomes a schema, and it is
 * also why `passport_preferences` is a separate table with a separate
 * `source` constraint — see `lib/preferences/vocabulary`.
 */
export interface PassportProfile {
  readonly userId: string;
  readonly displayName: string;
  readonly homeArea: string | null;
  readonly timezone: string | null;
  readonly email: string | null;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  home_area: string | null;
  timezone: string | null;
}

/**
 * The person's profile, with Supabase's own account data filling any gap.
 *
 * Never throws for a missing row. A read failure is reported as "no stored
 * profile" rather than an error, because the fallback is a complete, usable
 * answer and a settings page that 500s is worse than one showing defaults.
 */
export async function profileFor(user: PassportUser): Promise<PassportProfile> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("passport_profiles")
    .select("user_id, display_name, home_area, timezone")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  return {
    userId: user.id,
    email: user.email,
    // The stored name wins, then whatever Supabase already knew. `currentUser`
    // owns that fallback chain so there is one definition of what to call
    // somebody rather than two that can disagree.
    displayName: data?.display_name?.trim() || user.displayName,
    homeArea: data?.home_area ?? null,
    timezone: data?.timezone ?? null,
  };
}

export interface ProfileChanges {
  readonly displayName?: string;
  readonly homeArea?: string;
  readonly timezone?: string;
}

/**
 * Write the fields that were supplied, leaving the rest alone.
 *
 * An empty string is a real instruction — "remove what I put here" — and is
 * stored as `null` rather than as `""`, so a cleared home area reads as absent
 * everywhere instead of as a place with no name.
 *
 * The `user_id` written is always `user.id`. It is never read from the request,
 * and RLS would refuse it if it were.
 */
export async function saveProfile(
  user: PassportUser,
  changes: ProfileChanges,
): Promise<PassportProfile> {
  const supabase = await createSupabaseServerClient();

  const blankToNull = (value: string | undefined) =>
    value === undefined ? undefined : value.trim() === "" ? null : value.trim();

  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (changes.displayName !== undefined)
    row.display_name = blankToNull(changes.displayName);
  if (changes.homeArea !== undefined)
    row.home_area = blankToNull(changes.homeArea);
  if (changes.timezone !== undefined)
    row.timezone = blankToNull(changes.timezone);

  const { error } = await supabase
    .from("passport_profiles")
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    throw new Error(`Could not save profile: ${error.message}`);
  }

  return profileFor(user);
}

/** Longest sensible display name. Enough for a real name, short enough to render. */
export const MAX_DISPLAY_NAME = 60;
export const MAX_HOME_AREA = 120;
