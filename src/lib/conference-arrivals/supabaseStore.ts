import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArrivalRecord } from "@/domain/conference-arrivals/board";
import type { ArrivalsStore } from "./store";

/**
 * **The durable, shared `ArrivalsStore`: Postgres under row level security.**
 *
 * Like the conference's own `supabaseStore`, every call runs as the signed-in
 * person, never a privileged key. What they may read, write or refresh is
 * decided by supabase/migrations/20261014000000_passport_conference_arrivals.sql:
 * reads are your own row plus shared rows of people who chose to be seen;
 * writes go through `passport_conference_arrivals_save`, which lets you write
 * your own flight and lets any member refresh the `tracking` of a shared one.
 *
 * Erasure is the database's: rows cascade away with the member and the
 * conference, so `remove`/`removeConference` here are belt only.
 */
export function supabaseArrivals(
  client: () => Promise<SupabaseClient>,
): ArrivalsStore {
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(`arrivals store: ${error.message}`);
  };
  // Anyone in the conference can write `tracking`, so a row isn't trusted:
  // one that doesn't look like a record is skipped, not allowed to break the
  // board for everybody.
  const usable = (r: unknown): r is ArrivalRecord => {
    const x = r as Partial<ArrivalRecord> | null;
    return (
      !!x &&
      typeof x.memberId === "string" &&
      typeof x.conferenceId === "string" &&
      typeof x.updatedAt === "string" &&
      !!x.flight?.ident &&
      typeof x.flight.date === "string" &&
      typeof x.tracking?.phase === "string" &&
      Array.isArray(x.tracking.trail) &&
      x.tracking.trail.every(
        (f) => typeof f?.lat === "number" && typeof f?.lon === "number",
      )
    );
  };

  return {
    async list(conferenceId) {
      const r = await (
        await client()
      )
        .from("passport_conference_arrivals")
        .select("record")
        .eq("conference_id", conferenceId);
      fail(r.error);
      return (r.data ?? []).map((row) => row.record).filter(usable);
    },
    async get(conferenceId, memberId) {
      const r = await (
        await client()
      )
        .from("passport_conference_arrivals")
        .select("record")
        .eq("conference_id", conferenceId)
        .eq("member_id", memberId)
        .maybeSingle();
      fail(r.error);
      return usable(r.data?.record) ? r.data.record : null;
    },
    async put(record) {
      const r = await (
        await client()
      ).rpc("passport_conference_arrivals_save", {
        p_conference: record.conferenceId,
        p_record: record,
      });
      fail(r.error);
    },
    async remove(conferenceId, memberId) {
      const r = await (
        await client()
      )
        .from("passport_conference_arrivals")
        .delete()
        .eq("conference_id", conferenceId)
        .eq("member_id", memberId);
      fail(r.error);
    },
    async removeConference() {
      // Cascades from passport_conferences; the caller may not own the rows.
    },
  };
}
