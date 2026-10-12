import { inviteState, normaliseCode } from "@/domain/conference/access";
import type {
  Conference,
  ConferenceDetails,
  IdentityKey,
  Invite,
  Membership,
} from "@/domain/conference/types";
import type { InviteState } from "@/domain/conference/access";

/**
 * **Where the foundation keeps conferences, memberships and links.**
 *
 * Modules keep their own data in their own stores. This holds only what the
 * foundation owns.
 *
 * ## Two implementations
 *
 * `memoryStore` (here): development, tests, one long-running server. On
 * Vercel every instance has its own memory, so it is not for production.
 *
 * `supabaseStore` (`supabaseStore.ts`): durable and shared. It runs as the
 * signed-in person under row level security, never with a privileged key, so
 * the database enforces who can read what. It has no guests: everybody is a
 * Passport account. Proposed tables:
 * docs/products/go-have-a-conference/migration.sql.
 *
 * `config.ts` refuses to open in production until `CONFERENCE_STORE` says
 * which one, so neither can ship by accident.
 *
 * ## Why joining is a store operation
 *
 * A stranger holding a code or link cannot read anything, which is the point.
 * So "look up the code, then add the membership" cannot be two calls from
 * the service: the second needs the first's answer, and the first is not
 * theirs to ask. The store does both at once (a SECURITY DEFINER function in
 * Postgres), and the memory store applies the identical rules.
 */
export interface ConferenceStore {
  conference(id: string): Promise<Conference | null>;
  /** Is any conference using this code? (case, spaces and dashes ignored). */
  codeTaken(code: string): Promise<boolean>;
  putConference(c: Conference): Promise<void>;
  /** The conference, its memberships and its links. */
  removeConference(id: string): Promise<void>;
  /** Ids of conferences whose `retainUntil` has passed. */
  expired(now: Date): Promise<string[]>;

  /**
   * The memberships the caller is allowed to see. A durable store shows a
   * member only the people who chose to be seen, plus themselves, and shows an
   * organiser everyone. Use `headcount` for how many are in.
   */
  memberships(conferenceId: string): Promise<Membership[]>;
  /** Everyone in it, hidden people included. Counts name nobody. */
  headcount(conferenceId: string): Promise<number>;
  membershipsOf(identity: IdentityKey): Promise<Membership[]>;
  putMembership(m: Membership): Promise<void>;
  removeMembership(conferenceId: string, memberId: string): Promise<void>;

  invite(token: string): Promise<Invite | null>;
  invites(conferenceId: string): Promise<Invite[]>;
  /** Create a link, or revoke one (`revokedAt`). Uses are spent only by `redeemInvite`. */
  putInvite(i: Invite): Promise<void>;

  /** What a link is an invitation to, for somebody who is not in yet. */
  describeInvite(
    token: string,
    now: Date,
  ): Promise<{ state: InviteState; details?: ConferenceDetails } | null>;
  /**
   * Join with a link: one atomic step. Somebody already in is let through
   * even on a dead link, and spends no use. `null`: the link does not work.
   */
  redeemInvite(
    identity: IdentityKey,
    token: string,
    memberId: string,
    now: Date,
  ): Promise<string | null>;
  /** Join with a typed code. Idempotent. `null`: no conference has it. */
  redeemCode(
    identity: IdentityKey,
    code: string,
    memberId: string,
    now: Date,
  ): Promise<string | null>;
}

export function memoryStore(): ConferenceStore {
  const conferences = new Map<string, Conference>();
  // Keyed `${conferenceId}|${memberId}`.
  const members = new Map<string, Membership>();
  const links = new Map<string, Invite>();
  const key = (c: string, m: string) => `${c}|${m}`;
  const byCode = (code: string): Conference | null => {
    const wanted = normaliseCode(code);
    if (!wanted) return null;
    for (const c of conferences.values())
      if (c.accessCode && normaliseCode(c.accessCode) === wanted) return c;
    return null;
  };
  const isIn = (conferenceId: string, identity: IdentityKey) =>
    [...members.values()].some(
      (m) => m.conferenceId === conferenceId && m.identity === identity,
    );
  const admit = (
    conferenceId: string,
    identity: IdentityKey,
    memberId: string,
    via: "code" | "link",
    now: Date,
  ) =>
    members.set(key(conferenceId, memberId), {
      conferenceId,
      identity,
      memberId,
      role: "member",
      displayName: null,
      // Private by default: in, and seen by nobody but organisers.
      visibility: "hidden",
      joinedAt: now.toISOString(),
      via,
    });

  return {
    async conference(id) {
      return conferences.get(id) ?? null;
    },
    async codeTaken(code) {
      return byCode(code) !== null;
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
    async headcount(conferenceId) {
      return [...members.values()].filter(
        (m) => m.conferenceId === conferenceId,
      ).length;
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
    async describeInvite(token, now) {
      const invite = links.get(token);
      const conference = invite && conferences.get(invite.conferenceId);
      if (!invite || !conference) return null;
      const state = inviteState(invite, now);
      return state === "valid"
        ? { state, details: conference.details }
        : { state };
    },
    async redeemInvite(identity, token, memberId, now) {
      const invite = links.get(token);
      if (!invite || !conferences.has(invite.conferenceId)) return null;
      if (isIn(invite.conferenceId, identity)) return invite.conferenceId;
      if (inviteState(invite, now) !== "valid") return null;
      links.set(token, { ...invite, uses: invite.uses + 1 });
      admit(invite.conferenceId, identity, memberId, "link", now);
      return invite.conferenceId;
    },
    async redeemCode(identity, code, memberId, now) {
      const conference = byCode(code);
      if (!conference) return null;
      if (!isIn(conference.id, identity))
        admit(conference.id, identity, memberId, "code", now);
      return conference.id;
    },
  };
}

// Survives dev hot reload; one per server process.
const g = globalThis as unknown as { __conferenceStore?: ConferenceStore };
export const store = (): ConferenceStore =>
  (g.__conferenceStore ??= memoryStore());
