import type { ArrivalRecord } from "@/domain/conference-arrivals/board";
import { conferenceSetup } from "@/lib/conference/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseArrivals } from "./supabaseStore";

/**
 * **Where arrivals keeps the little it keeps**, keyed on `(conferenceId,
 * memberId)` like every conference module (ARCHITECTURE.md §6).
 *
 * Per member: one flight (number, date, optional departure airport), whether
 * they shared it, and what ADS-B has shown about it. No identity key, email
 * or phone. Erased when the member leaves or is removed and when the
 * conference is deleted or expires, through `arrivalsLifecycle`.
 *
 * Two implementations, like the foundation's: memory (development, tests)
 * and `supabaseArrivals` (durable, shared, under row level security).
 */
export interface ArrivalsStore {
  list(conferenceId: string): Promise<ArrivalRecord[]>;
  get(conferenceId: string, memberId: string): Promise<ArrivalRecord | null>;
  put(record: ArrivalRecord): Promise<void>;
  remove(conferenceId: string, memberId: string): Promise<void>;
  removeConference(conferenceId: string): Promise<void>;
}

export function memoryArrivals(): ArrivalsStore {
  const byConference = new Map<string, Map<string, ArrivalRecord>>();
  return {
    async list(conferenceId) {
      return [...(byConference.get(conferenceId)?.values() ?? [])];
    },
    async get(conferenceId, memberId) {
      return byConference.get(conferenceId)?.get(memberId) ?? null;
    },
    async put(record) {
      const m = byConference.get(record.conferenceId) ?? new Map();
      m.set(record.memberId, record);
      byConference.set(record.conferenceId, m);
    },
    async remove(conferenceId, memberId) {
      byConference.get(conferenceId)?.delete(memberId);
    },
    async removeConference(conferenceId) {
      byConference.delete(conferenceId);
    },
  };
}

// Survives dev hot reload; one per server process. Only the memory store.
const g = globalThis as unknown as { __arrivalsStore?: ArrivalsStore };

/**
 * The store for this request: Postgres (as the signed-in person) when the
 * conference store is `supabase`, so flights are as durable and as shared as
 * the conference; per-process memory otherwise.
 */
export const arrivalsStore = (): ArrivalsStore => {
  const setup = conferenceSetup();
  if (setup.open && setup.config.store === "supabase")
    return supabaseArrivals(createSupabaseServerClient);
  return (g.__arrivalsStore ??= memoryArrivals());
};
