import { normaliseCode } from "@/domain/conference/access";
import type {
  Conference,
  IdentityKey,
  Invite,
  Membership,
} from "@/domain/conference/types";

/**
 * **Where the foundation keeps conferences, memberships and links.**
 *
 * Modules keep their own data in their own stores. This holds only what the
 * foundation owns.
 *
 * ## Only memory exists yet, and that is a deployment blocker
 *
 * On Vercel every serverless instance has its own memory, so this store would
 * show people different conferences and lose memberships on a cold start. It
 * is correct for development, tests and a single long-running server.
 * Production needs a durable implementation. The proposed tables are in
 * docs/products/go-have-a-conference/proposed-schema.sql, deliberately not in
 * supabase/migrations/ (a shared contract nobody has approved a change to).
 * `config.ts` refuses to open in production until `CONFERENCE_STORE=memory`
 * is stated, so this cannot ship by accident.
 */
export interface ConferenceStore {
  conference(id: string): Promise<Conference | null>;
  /** By a code as typed: case, spaces and dashes ignored. */
  conferenceByCode(code: string): Promise<Conference | null>;
  putConference(c: Conference): Promise<void>;
  /** The conference, its memberships and its links. */
  removeConference(id: string): Promise<void>;
  /** Ids of conferences whose `retainUntil` has passed. */
  expired(now: Date): Promise<string[]>;

  memberships(conferenceId: string): Promise<Membership[]>;
  membershipsOf(identity: IdentityKey): Promise<Membership[]>;
  putMembership(m: Membership): Promise<void>;
  removeMembership(conferenceId: string, memberId: string): Promise<void>;

  invite(token: string): Promise<Invite | null>;
  invites(conferenceId: string): Promise<Invite[]>;
  putInvite(i: Invite): Promise<void>;
}

export function memoryStore(): ConferenceStore {
  const conferences = new Map<string, Conference>();
  // Keyed `${conferenceId}|${memberId}`.
  const members = new Map<string, Membership>();
  const links = new Map<string, Invite>();
  const key = (c: string, m: string) => `${c}|${m}`;

  return {
    async conference(id) {
      return conferences.get(id) ?? null;
    },
    async conferenceByCode(code) {
      const wanted = normaliseCode(code);
      if (!wanted) return null;
      for (const c of conferences.values())
        if (c.accessCode && normaliseCode(c.accessCode) === wanted) return c;
      return null;
    },
    async putConference(c) {
      conferences.set(c.id, c);
    },
    async removeConference(id) {
      conferences.delete(id);
      for (const [k, m] of members)
        if (m.conferenceId === id) members.delete(k);
      for (const [t, i] of links) if (i.conferenceId === id) links.delete(t);
    },
    async expired(now) {
      return [...conferences.values()]
        .filter((c) => now.getTime() >= Date.parse(c.retainUntil))
        .map((c) => c.id);
    },
    async memberships(conferenceId) {
      return [...members.values()].filter(
        (m) => m.conferenceId === conferenceId,
      );
    },
    async membershipsOf(identity) {
      return [...members.values()].filter((m) => m.identity === identity);
    },
    async putMembership(m) {
      members.set(key(m.conferenceId, m.memberId), m);
    },
    async removeMembership(conferenceId, memberId) {
      members.delete(key(conferenceId, memberId));
    },
    async invite(token) {
      return links.get(token) ?? null;
    },
    async invites(conferenceId) {
      return [...links.values()].filter((i) => i.conferenceId === conferenceId);
    },
    async putInvite(i) {
      links.set(i.token, i);
    },
  };
}

// Survives dev hot reload; one per server process.
const g = globalThis as unknown as { __conferenceStore?: ConferenceStore };
export const store = (): ConferenceStore =>
  (g.__conferenceStore ??= memoryStore());
