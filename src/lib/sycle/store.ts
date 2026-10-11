import { flightKey, type Participant } from "@/domain/sycle/board";
import type { FlightRecord } from "@/domain/sycle/flight";

/**
 * **Where the board keeps the little it keeps.**
 *
 * Per participant: a random id, an optional display name, a visibility, one
 * flight number and date, and the Atlas ids they said "I'm in" to. No email,
 * no employee id, no phone, no home city, no location. Per flight: the
 * provider's record, shared by everyone on that flight.
 *
 * ## Expiry is enforced on read, not by a cron
 *
 * `purge` runs before every read. Past `SYCLE_DATA_EXPIRES_AT` every
 * participant is gone; flight records go when nobody references them or seven
 * days after they were fetched (AeroDataBox's caching limit, Terms §5.5).
 * A scheduled job would be a second thing to deploy and a second thing to
 * forget; this cannot be forgotten, because the board cannot be read without
 * running it.
 *
 * ## Only memory exists yet, and that is a deployment blocker
 *
 * On Vercel each serverless instance has its own memory, so this store would
 * show different people different boards and lose everything on a cold
 * start. It is correct for development, tests and a single long-running
 * server. Production needs a durable implementation of `SycleStore` — the
 * proposed Supabase table is in `docs/sycle/proposed-schema.sql` and is
 * deliberately **not** in `supabase/migrations/` (a shared contract, and
 * nobody has approved it). `config.ts` refuses to open in production unless
 * `SYCLE_STORE=memory` is stated, so the limitation cannot ship by accident.
 */
export interface SycleStore {
  participants(): Promise<Participant[]>;
  participant(id: string): Promise<Participant | null>;
  putParticipant(p: Participant): Promise<void>;
  removeParticipant(id: string): Promise<void>;
  flight(key: string): Promise<FlightRecord | null>;
  putFlight(key: string, f: FlightRecord): Promise<void>;
  purge(now: Date, expiresAt: Date): Promise<void>;
}

const FLIGHT_TTL_MS = 7 * 24 * 60 * 60_000;

export function memoryStore(): SycleStore {
  const people = new Map<string, Participant>();
  const flights = new Map<string, FlightRecord>();
  return {
    async participants() {
      return [...people.values()];
    },
    async participant(id) {
      return people.get(id) ?? null;
    },
    async putParticipant(p) {
      people.set(p.id, p);
    },
    async removeParticipant(id) {
      people.delete(id);
    },
    async flight(key) {
      return flights.get(key) ?? null;
    },
    async putFlight(key, f) {
      flights.set(key, f);
    },
    async purge(now, expiresAt) {
      if (now >= expiresAt) people.clear();
      const referenced = new Set(
        [...people.values()]
          .filter((p) => p.flight)
          .map((p) => flightKey(p.flight!.flightNumber, p.flight!.date)),
      );
      for (const [key, f] of flights) {
        if (
          !referenced.has(key) ||
          now.getTime() - Date.parse(f.fetchedAt) > FLIGHT_TTL_MS
        )
          flights.delete(key);
      }
    },
  };
}

// Survives dev hot reload; one per server process.
const g = globalThis as unknown as { __sycleStore?: SycleStore };
export const store = (): SycleStore => (g.__sycleStore ??= memoryStore());
