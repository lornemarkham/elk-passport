import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * **Supabase in the browser.**
 *
 * `createBrowserClient` rather than the plain `createClient` for one reason
 * that matters more than it sounds: it stores the session in a **cookie**
 * instead of `localStorage`. `localStorage` is invisible to the server, which
 * is why Passport could sign a person in and still have no idea who they were
 * on any page it rendered — every route was anonymous no matter who was
 * looking at it. The cookie is the same one `@/lib/supabase/server` reads: one
 * session, two readers, instead of a client that knows and a server that guesses.
 *
 * ## Why a function and not a module-scope constant
 *
 * `createBrowserClient` throws when the environment is missing, and a constant
 * throws it at **import** time. That made every module transitively importing
 * this one impossible to load without Supabase credentials — including two
 * component test suites that never touch Supabase at all, and which failed on
 * an import they did not know they had.
 *
 * The client is memoised, so this is still one client per browser session, and
 * the failure now happens where it can be handled: at the call.
 */
let client: SupabaseClient | undefined;

export function supabaseBrowser(): SupabaseClient {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
