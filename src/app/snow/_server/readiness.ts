import "server-only";
import { visitorDb } from "@/lib/adventures/server";

/**
 * **Are shared snow days switched on in this database?**
 *
 * They are once `20261103000000_passport_snow.sql` has been applied, and not
 * before. Rather than a code edit (or an environment variable) that someone
 * must remember to flip after the SQL, the page asks the database itself:
 * the caller's own client reads `passport_snow_days`. A table that exists
 * answers either cleanly (a signed-in person may select, and row-level
 * security shows them nothing) or "permission denied" (42501, for a visitor
 * `anon` holds no grant). A table that does not exist answers "not in the
 * schema cache" (PGRST205). Anything else
 * — no network, no Supabase configured, a surprise — is "not ready", which is
 * the safe answer: the one-phone day, which needs nothing, is always there.
 *
 * Remembered for a short while so a busy start page is not a probe storm.
 */
const TTL_READY_MS = 60_000;
const TTL_NOT_READY_MS = 15_000;

let remembered: { at: number; ready: boolean } | null = null;

export function readinessFrom(error: { code?: string } | null): boolean {
  // A signed-in caller holds SELECT, so a table that exists answers with no
  // error (and, under row-level security, no rows). A visitor holds nothing,
  // so the same table answers permission denied. Either proves it is there.
  return error === null || error.code === "42501";
}

export async function sharedDaysReady(
  now: () => number = Date.now,
): Promise<boolean> {
  const t = now();
  if (remembered) {
    const ttl = remembered.ready ? TTL_READY_MS : TTL_NOT_READY_MS;
    if (t - remembered.at < ttl) return remembered.ready;
  }
  let ready = false;
  try {
    const db = await visitorDb();
    const { data, error } = await db
      .from("passport_snow_days")
      .select("adventure_id")
      .limit(1);
    void data;
    ready = readinessFrom(error);
  } catch {
    ready = false;
  }
  remembered = { at: t, ready };
  return ready;
}

/** For tests: forget what was remembered. */
export function forgetReadiness() {
  remembered = null;
}
