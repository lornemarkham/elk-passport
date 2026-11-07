import type { SupabaseClient } from "@supabase/supabase-js";
import { Refused, Unavailable } from "@/lib/adventures/store";
import {
  MAX_SHARE_MINUTES,
  type CrewPosition,
  type Fix,
  type ShareMinutes,
  type Sharing,
} from "@/domain/snow/location";

/**
 * **Find your crew: the server half.**
 *
 * Same stance as the rest of Snow's shared code: the client here is the
 * signed-in person, so Postgres decides who may see and change what
 * (docs/product/snow/location-migration.sql). Nothing in this file is a
 * permission; it only asks and translates. A position is never logged and
 * never returned with an account id: people are the core's random member id.
 *
 * If the migration has not been applied the table does not exist, and every
 * call says so (`Off`) instead of pretending: the screen then says location
 * sharing is not switched on yet.
 */
type Db = SupabaseClient;

/** The location table is not in this database yet. */
export class Off extends Error {}

type Err = { code?: string; message: string } | null;

function check(error: Err) {
  if (!error) return;
  // PostgREST: relation not in the schema cache / Postgres: undefined table.
  if (error.code === "PGRST205" || error.code === "42P01") throw new Off();
  if (error.code === "P0001") throw new Declined();
  if (error.code === "42501" || error.code === "23503") throw new Refused();
  throw new Unavailable(error.message);
}

/** Too soon after the last update: not an error worth showing anyone. */
class Declined extends Error {}

type Row = {
  user_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  updated_at: string;
  expires_at: string;
};

export async function readCrew(
  db: Db,
  adventureId: string,
  me: string,
): Promise<Sharing> {
  // Finished shares are removed whenever anyone asks (and are unreadable
  // before that). Harmless if it cannot run; the policy is the wall.
  const purged = await db.rpc("passport_snow_locations_purge", {
    p_adventure: adventureId,
  });
  if (purged.error?.code === "PGRST202" || purged.error?.code === "42883")
    throw new Off();

  const [rows, members] = await Promise.all([
    db
      .from("passport_snow_locations")
      .select("user_id, lat, lng, accuracy_m, updated_at, expires_at")
      .eq("adventure_id", adventureId),
    db
      .from("passport_adventure_members")
      .select("user_id, member_id")
      .eq("adventure_id", adventureId),
  ]);
  check(rows.error);
  check(members.error);
  const memberOf = new Map(
    ((members.data ?? []) as { user_id: string; member_id: string }[]).map(
      (m) => [m.user_id, m.member_id],
    ),
  );
  if (!memberOf.has(me)) throw new Refused();

  const all = (rows.data ?? []) as Row[];
  const mine = all.find((r) => r.user_id === me);
  const others: CrewPosition[] = all
    .filter((r) => r.user_id !== me && memberOf.has(r.user_id))
    .map((r) => ({
      memberId: memberOf.get(r.user_id)!,
      lat: r.lat,
      lng: r.lng,
      accuracyM: r.accuracy_m,
      updatedAt: r.updated_at,
      expiresAt: r.expires_at,
    }));
  return { sharing: mine ? { expiresAt: mine.expires_at } : null, others };
}

/**
 * Begin sharing (with `minutes`) or move the dot (without). Beginning always
 * replaces whatever was there, so a share can never be lengthened in place.
 */
export async function share(
  db: Db,
  adventureId: string,
  fix: Fix,
  minutes: ShareMinutes | null,
  now: Date = new Date(),
): Promise<void> {
  if (minutes === null) {
    const moved = await db
      .from("passport_snow_locations")
      .update({ lat: fix.lat, lng: fix.lng, accuracy_m: fix.accuracyM })
      .eq("adventure_id", adventureId)
      .select("adventure_id");
    try {
      check(moved.error);
    } catch (e) {
      if (e instanceof Declined) return; // moved a moment ago; the next one counts
      throw e;
    }
    // Nothing to move: the share ended (or was stopped on another phone).
    // Never start a new one without being asked to.
    if (!moved.data || moved.data.length === 0) throw new Refused();
    return;
  }
  if (minutes > MAX_SHARE_MINUTES) throw new Refused();
  const gone = await db
    .from("passport_snow_locations")
    .delete()
    .eq("adventure_id", adventureId);
  check(gone.error);
  const made = await db.from("passport_snow_locations").insert({
    adventure_id: adventureId,
    lat: fix.lat,
    lng: fix.lng,
    accuracy_m: fix.accuracyM,
    started_at: now.toISOString(),
    expires_at: new Date(now.getTime() + minutes * 60_000).toISOString(),
  });
  check(made.error);
}

/** Stop sharing: the row is deleted, not hidden. */
export async function stop(db: Db, adventureId: string): Promise<void> {
  const gone = await db
    .from("passport_snow_locations")
    .delete()
    .eq("adventure_id", adventureId);
  check(gone.error);
}
