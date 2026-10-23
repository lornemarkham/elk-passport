import type { Location } from "@/domain/conference-people/people";
import { conferenceSetup } from "@/lib/conference/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabasePeople } from "./supabaseStore";

/**
 * **Where shared positions live, briefly.** One row per person per
 * conference. `purge` removes everything past its end; every read runs it
 * first, so an expired position cannot be read even by its owner.
 */
export interface PeopleStore {
  list(conferenceId: string): Promise<Location[]>;
  put(location: Location): Promise<void>;
  remove(conferenceId: string, memberId: string): Promise<void>;
  purge(now: Date): Promise<void>;
  forgetConference(conferenceId: string): Promise<void>;
}

export function memoryPeople(): PeopleStore {
  const rows = new Map<string, Map<string, Location>>();
  return {
    async list(c) {
      return [...(rows.get(c)?.values() ?? [])];
    },
    async put(l) {
      const m = rows.get(l.conferenceId) ?? new Map();
      m.set(l.memberId, l);
      rows.set(l.conferenceId, m);
    },
    async remove(c, memberId) {
      rows.get(c)?.delete(memberId);
    },
    async purge(now) {
      for (const m of rows.values())
        for (const [k, l] of m)
          if (Date.parse(l.expiresAt) <= now.getTime()) m.delete(k);
    },
    async forgetConference(c) {
      rows.delete(c);
    },
  };
}

const g = globalThis as unknown as { __peopleStore?: PeopleStore };

export const peopleStore = (): PeopleStore => {
  const setup = conferenceSetup();
  if (setup.open && setup.config.store === "supabase")
    return supabasePeople(createSupabaseServerClient);
  return (g.__peopleStore ??= memoryPeople());
};
