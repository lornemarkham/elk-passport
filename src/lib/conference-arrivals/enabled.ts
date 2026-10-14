import "server-only";
import { conferenceSetup } from "@/lib/conference/config";

/**
 * **Whether Arrivals may run at all in this process.**
 *
 * Arrivals keeps each member's flight, so it needs a store that lives and dies
 * with the conference:
 *
 * - in development on the in-memory conference store, both halves are memory;
 * - on `CONFERENCE_STORE=supabase`, flights live in
 *   `passport_conference_arrivals`, which exists only once the second
 *   migration is applied. Forgetting it would turn every save into a 500, so
 *   the owner opens Arrivals explicitly with `CONFERENCE_ARRIVALS=on` after
 *   applying it. Without that it stays plainly closed ("Arrivals isn't open
 *   yet") and ADS-B is never called.
 *
 * Per-instance memory is never used in production.
 */
export function arrivalsEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
  isDev = process.env.NODE_ENV !== "production",
): boolean {
  const setup = conferenceSetup(env, isDev);
  if (!setup.open) return false;
  if (setup.config.store === "supabase")
    return env.CONFERENCE_ARRIVALS === "on";
  return isDev;
}
