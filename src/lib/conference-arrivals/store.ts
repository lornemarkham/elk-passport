import type { ArrivalRecord } from "@/domain/conference-arrivals/board";

/**
 * **Where arrivals keeps the little it keeps**, keyed on `(conferenceId,
 * memberId)` like every conference module (ARCHITECTURE.md §6).
 *
 * Per member: one flight (number, date, optional departure airport), whether
 * they shared it, and what ADS-B has shown about it. No identity key, email
 * or phone. Erased when the member leaves or is removed and when the
 * conference is deleted or expires, through `arrivalsLifecycle`.
 *
 * Memory only, like the foundation's store, and for the same reason: the
 * durable store is ROADMAP decision D3. Production stays closed until
 * `CONFERENCE_STORE` is stated, so this can't ship by accident.
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

/**
 * Whether `arrivalsStore()` outlives the process and is shared between
 * instances. It does not. `enabled.ts` keeps Arrivals closed outside
 * development until this is true, which needs a table and a migration
 * (docs/products/go-have-a-conference/ARRIVALS.md, "Before Labs").
 */
export const ARRIVALS_STORE_DURABLE = false;

// Survives dev hot reload; one per server process.
const g = globalThis as unknown as { __arrivalsStore?: ArrivalsStore };
export const arrivalsStore = (): ArrivalsStore =>
  (g.__arrivalsStore ??= memoryArrivals());
