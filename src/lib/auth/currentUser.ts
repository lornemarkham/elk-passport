import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * **Who is using Passport right now.**
 *
 * This is the one function that answers that question on the server, and the
 * `id` it returns is the one identity durable user state is keyed on. Boards,
 * and whatever comes after them, hang off this and nothing else.
 *
 * ## Why one function and not a convention
 *
 * Before this existed Passport held three unconnected notions of a person:
 * Supabase's real `auth.users` (known only to the browser, because the session
 * lived in `localStorage`), a `NEXT_PUBLIC_ADMIN_EMAILS` allowlist, and the
 * string literal `"demo-user"`, which was the owner of every board anyone had
 * ever created. Three identities, no mapping between any two of them, and the
 * only one the database actually keyed on was a constant.
 *
 * Daily Passport, Guided Discovery and anything else that later wants to know
 * who it is talking to calls this. It should not grow a second way.
 *
 * ## What `null` means, and why it is ordinary
 *
 * `null` is **not** an error and not a redirect. Passport gives before it asks:
 * Discovery, search, scope, kinds and every detail page work perfectly well for
 * someone who has never signed in, and `null` is what those pages get. Only a
 * *durable* action — saving something that should still be there tomorrow —
 * needs an identity, and only those call sites treat `null` as a reason to stop.
 *
 * ## Why `getUser()` and not `getSession()`
 *
 * `getSession()` returns whatever the cookie says without checking it.
 * `getUser()` verifies the token with Supabase. On the server, where the answer
 * decides whose rows get read, the difference between "the cookie claims" and
 * "Supabase confirms" is the whole point.
 */
export interface PassportUser {
  /** The Supabase user id. The key durable user state is owned by. */
  readonly id: string;
  readonly email: string | null;
  /**
   * What to call them on screen.
   *
   * Supabase already carries `user_metadata.display_name`, so V1 needs no
   * profile table to have a name — and falls back to the local part of the
   * email rather than showing a uuid to a person.
   */
  readonly displayName: string;
}

export async function currentUser(): Promise<PassportUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: displayNameOf(
      typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : undefined,
      user.email,
    ),
  };
}

/** Exported for the tests that pin the fallback order. */
export function displayNameOf(
  metadataName: string | undefined,
  email: string | null | undefined,
): string {
  const named = metadataName?.trim();
  if (named) return named;

  const local = email?.split("@")[0]?.trim();
  if (local) return local;

  // Reached only for an account with neither, which Supabase's email flow
  // cannot produce. Still better than rendering an empty string.
  return "Traveller";
}
