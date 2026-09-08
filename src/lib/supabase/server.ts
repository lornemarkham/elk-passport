import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * **Supabase on the server, reading the session cookie the browser client set.**
 *
 * Only ever the **anon** key. The service-role key is not used here and must
 * not be: the anon key plus the caller's own session is exactly the authority
 * that caller already has, so a bug in a route handler cannot escalate into
 * reading somebody else's rows. Privileged Atlas work goes through the
 * `ADMIN_TOKEN` proxy routes, which is a separate, already-established gate.
 *
 * `setAll` no-ops when Next refuses the write — a Server Component may not set
 * cookies, and the middleware refreshes the session on every request anyway, so
 * the failure is genuinely nothing rather than swallowed.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component render — the middleware owns cookie writes.
          }
        },
      },
    },
  );
}
