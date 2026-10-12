import type { SupabaseClient } from "@supabase/supabase-js";
import type { InviteState } from "@/domain/conference/access";
import { parseDetails } from "@/domain/conference/details";
import type {
  Conference,
  ConferenceDetails,
  IdentityKey,
  Invite,
  Membership,
} from "@/domain/conference/types";
import type { ConferenceStore } from "./store";

/**
 * **The durable, shared `ConferenceStore`: Postgres under row level security.**
 *
 * Every call runs as the signed-in person (their session, the anon key),
 * never a privileged key. So what a request can read or change is decided by
 * the database's policies (docs/products/go-have-a-conference/migration.sql),
 * and a bug in a route handler cannot hand anyone another conference's rows.
 *
 * ## No guests
 *
 * A guest has no `auth.users` row, so row level security cannot know them.
 * This store holds only `user:<uuid>` identities and refuses anything else.
 * (Which means: in this mode joining needs a Passport account. ROADMAP D2.)
 *
 * ## Reads are already filtered
 *
 * `memberships` returns what the caller may see: themselves, every person who
 * chose to be seen, and for an organiser everyone. A non-member reads
 * nothing at all, which is why "not found" and "not yours" are the same
 * answer.
 */
export function supabaseStore(
  client: () => Promise<SupabaseClient>,
): ConferenceStore {
  const userOf = (identity: IdentityKey): string => {
    if (!identity.startsWith("user:"))
      throw new Error("The durable conference store has no guests.");
    return identity.slice("user:".length);
  };
  const ok = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(`conference store: ${r.error.message}`);
    return r.data;
  };

  type ConferenceRow = {
    id: string;
    details: unknown;
    retain_until: string;
    created_at: string;
    updated_at: string;
  };
  type MemberRow = {
    conference_id: string;
    user_id: string;
    member_id: string;
    role: "organiser" | "member";
    display_name: string | null;
    visibility: "hidden" | "members";
    joined_at: string;
    via: "created" | "code" | "link";
  };
  type InviteRow = {
    token: string;
    conference_id: string;
    created_at: string;
    expires_at: string | null;
    revoked_at: string | null;
    max_uses: number | null;
    uses: number;
  };

  const detailsOf = (raw: unknown): ConferenceDetails | null => {
    const parsed = parseDetails(raw);
    return parsed.ok ? parsed.details : null;
  };
  const memberOf = (r: MemberRow): Membership => ({
    conferenceId: r.conference_id,
    identity: `user:${r.user_id}`,
    memberId: r.member_id,
    role: r.role,
    displayName: r.display_name,
    visibility: r.visibility,
    joinedAt: r.joined_at,
    via: r.via,
  });
  const inviteOf = (r: InviteRow): Invite => ({
    token: r.token,
    conferenceId: r.conference_id,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    maxUses: r.max_uses,
    uses: r.uses,
  });

  /** A conference row plus its code (which only an organiser can read). */
  async function load(rows: ConferenceRow[]): Promise<Conference[]> {
    if (!rows.length) return [];
    const db = await client();
    const codes = ok(
      await db
        .from("passport_conference_codes")
        .select("conference_id, code")
        .in(
          "conference_id",
          rows.map((r) => r.id),
        ),
    ) as { conference_id: string; code: string }[];
    const byId = new Map(codes.map((c) => [c.conference_id, c.code]));
    return rows.flatMap((r) => {
      const details = detailsOf(r.details);
      return details
        ? [
            {
              id: r.id,
              details,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
              accessCode: byId.get(r.id) ?? null,
              retainUntil: r.retain_until,
            },
          ]
        : [];
    });
  }

  return {
    async conference(id) {
      const db = await client();
      const rows = ok(
        await db.from("passport_conferences").select("*").eq("id", id),
      ) as ConferenceRow[];
      return (await load(rows))[0] ?? null;
    },

    async codeTaken(code) {
      const db = await client();
      return ok(
        await db.rpc("passport_conference_code_taken", { p_code: code }),
      ) as boolean;
    },

    async putConference(c) {
      const db = await client();
      const existing = ok(
        await db.from("passport_conferences").select("id").eq("id", c.id),
      ) as { id: string }[];
      if (existing.length) {
        ok(
          await db
            .from("passport_conferences")
            .update({
              details: c.details,
              retain_until: c.retainUntil,
              updated_at: c.updatedAt,
            })
            .eq("id", c.id),
        );
      } else {
        // `created_by` defaults to auth.uid(); the policy insists on it.
        ok(
          await db.from("passport_conferences").insert({
            id: c.id,
            details: c.details,
            retain_until: c.retainUntil,
            created_at: c.createdAt,
            updated_at: c.updatedAt,
          }),
        );
      }
      if (c.accessCode === null) {
        ok(
          await db
            .from("passport_conference_codes")
            .delete()
            .eq("conference_id", c.id),
        );
      } else {
        ok(
          await db
            .from("passport_conference_codes")
            .delete()
            .eq("conference_id", c.id),
        );
        ok(
          await db.from("passport_conference_codes").insert({
            conference_id: c.id,
            code: c.accessCode,
            code_key: c.accessCode.toUpperCase().replace(/[^A-Z0-9]/g, ""),
          }),
        );
      }
    },

    async removeConference(id) {
      const db = await client();
      ok(await db.rpc("passport_conference_remove", { p_conference: id }));
    },

    async expired() {
      const db = await client();
      return (
        (ok(await db.rpc("passport_conference_expired")) as string[]) ?? []
      );
    },

    async memberships(conferenceId) {
      const db = await client();
      return (
        ok(
          await db
            .from("passport_conference_members")
            .select("*")
            .eq("conference_id", conferenceId),
        ) as MemberRow[]
      ).map(memberOf);
    },

    async headcount(conferenceId) {
      const db = await client();
      return (
        (ok(
          await db.rpc("passport_conference_headcount", {
            p_conference: conferenceId,
          }),
        ) as number | null) ?? 0
      );
    },

    async membershipsOf(identity) {
      if (!identity.startsWith("user:")) return [];
      const db = await client();
      return (
        ok(
          await db
            .from("passport_conference_members")
            .select("*")
            .eq("user_id", userOf(identity)),
        ) as MemberRow[]
      ).map(memberOf);
    },

    async putMembership(m) {
      const db = await client();
      const updated = ok(
        await db
          .from("passport_conference_members")
          .update({ display_name: m.displayName, visibility: m.visibility })
          .eq("conference_id", m.conferenceId)
          .eq("member_id", m.memberId)
          .select("member_id"),
      ) as unknown[];
      if (updated.length) return;
      // Only the founder can insert directly; everyone else comes in through
      // the redeem functions, and the policy refuses anything else.
      ok(
        await db.from("passport_conference_members").insert({
          conference_id: m.conferenceId,
          user_id: userOf(m.identity),
          member_id: m.memberId,
          role: m.role,
          display_name: m.displayName,
          visibility: m.visibility,
          joined_at: m.joinedAt,
          via: m.via,
        }),
      );
    },

    async removeMembership(conferenceId, memberId) {
      const db = await client();
      ok(
        await db
          .from("passport_conference_members")
          .delete()
          .eq("conference_id", conferenceId)
          .eq("member_id", memberId),
      );
    },

    async invite(token) {
      const db = await client();
      const rows = ok(
        await db
          .from("passport_conference_invites")
          .select("*")
          .eq("token", token),
      ) as InviteRow[];
      return rows[0] ? inviteOf(rows[0]) : null;
    },

    async invites(conferenceId) {
      const db = await client();
      return (
        ok(
          await db
            .from("passport_conference_invites")
            .select("*")
            .eq("conference_id", conferenceId),
        ) as InviteRow[]
      ).map(inviteOf);
    },

    async putInvite(i) {
      const db = await client();
      const existing = ok(
        await db
          .from("passport_conference_invites")
          .select("token")
          .eq("token", i.token),
      ) as unknown[];
      if (existing.length) {
        ok(
          await db
            .from("passport_conference_invites")
            .update({ revoked_at: i.revokedAt })
            .eq("token", i.token),
        );
        return;
      }
      ok(
        await db.from("passport_conference_invites").insert({
          token: i.token,
          conference_id: i.conferenceId,
          created_at: i.createdAt,
          expires_at: i.expiresAt,
          revoked_at: i.revokedAt,
          max_uses: i.maxUses,
        }),
      );
    },

    async describeInvite(token) {
      const db = await client();
      const rows = ok(
        await db.rpc("passport_conference_describe_invite", { p_token: token }),
      ) as { state: InviteState; details: unknown }[];
      const row = rows[0];
      if (!row) return null;
      const details = row.details ? detailsOf(row.details) : null;
      return details ? { state: row.state, details } : { state: row.state };
    },

    async redeemInvite(identity, token, memberId) {
      userOf(identity);
      const db = await client();
      return ok(
        await db.rpc("passport_conference_redeem_invite", {
          p_token: token,
          p_member_id: memberId,
        }),
      ) as string | null;
    },

    async redeemCode(identity, code, memberId) {
      userOf(identity);
      const db = await client();
      return ok(
        await db.rpc("passport_conference_redeem_code", {
          p_code: code,
          p_member_id: memberId,
        }),
      ) as string | null;
    },
  };
}
