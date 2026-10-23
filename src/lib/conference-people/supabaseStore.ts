import type { SupabaseClient } from "@supabase/supabase-js";
import type { Location } from "@/domain/conference-people/people";
import type { PeopleStore } from "./store";

/**
 * Shared positions in Postgres, as the signed-in person. The database only
 * returns rows that haven't expired, of people who chose to be seen, to
 * members of the same conference; and refuses a share longer than 4 hours.
 */
export function supabasePeople(
  client: () => Promise<SupabaseClient>,
): PeopleStore {
  const ok = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(`people store: ${r.error.message}`);
    return r.data;
  };
  return {
    async list(c) {
      const rows = ok(
        await (
          await client()
        )
          .from("passport_conference_locations")
          .select(
            "conference_id, member_id, lat, lon, accuracy_m, note, started_at, updated_at, expires_at",
          )
          .eq("conference_id", c),
      ) as {
        conference_id: string;
        member_id: string;
        lat: number;
        lon: number;
        accuracy_m: number | null;
        note: string;
        started_at: string;
        updated_at: string;
        expires_at: string;
      }[];
      return rows.map((r) => ({
        conferenceId: r.conference_id,
        memberId: r.member_id,
        lat: r.lat,
        lon: r.lon,
        accuracyM: r.accuracy_m,
        note: r.note,
        startedAt: new Date(r.started_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),
        expiresAt: new Date(r.expires_at).toISOString(),
      }));
    },
    async put(l) {
      ok(
        await (await client()).from("passport_conference_locations").upsert(
          {
            conference_id: l.conferenceId,
            member_id: l.memberId,
            lat: l.lat,
            lon: l.lon,
            accuracy_m: l.accuracyM,
            note: l.note,
            started_at: l.startedAt,
            updated_at: l.updatedAt,
            expires_at: l.expiresAt,
          },
          { onConflict: "conference_id,user_id", defaultToNull: false },
        ),
      );
    },
    async remove(c, memberId) {
      ok(
        await (
          await client()
        )
          .from("passport_conference_locations")
          .delete()
          .eq("conference_id", c)
          .eq("member_id", memberId),
      );
    },
    async purge() {
      ok(await (await client()).rpc("passport_conference_locations_purge"));
    },
    async forgetConference() {},
  };
}
