import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ROOM_SIZE,
  type Message,
  type MessageReaction,
} from "@/domain/conference-chat/chat";
import type { ChatStore } from "./store";

interface Row {
  id: string;
  conference_id: string;
  member_id: string;
  plan_id: string | null;
  body: string;
  at: string;
}

const message = (r: Row): Message => ({
  id: r.id,
  conferenceId: r.conference_id,
  memberId: r.member_id,
  planId: r.plan_id,
  body: r.body,
  at: new Date(r.at).toISOString(),
});

const COLUMNS = "id, conference_id, member_id, plan_id, body, at";

/** Chat in Postgres, as the signed-in person (together migration decides who reads). */
export function supabaseChat(client: () => Promise<SupabaseClient>): ChatStore {
  const ok = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(`chat store: ${r.error.message}`);
    return r.data;
  };
  return {
    async room(c, room) {
      let q = (await client())
        .from("passport_conference_messages")
        .select(COLUMNS)
        .eq("conference_id", c);
      q = room === null ? q.is("plan_id", null) : q.eq("plan_id", room);
      return (
        ok(await q.order("at", { ascending: false }).limit(ROOM_SIZE)) as Row[]
      ).map(message);
    },
    async say(m) {
      ok(
        await (await client()).from("passport_conference_messages").insert({
          id: m.id,
          conference_id: m.conferenceId,
          member_id: m.memberId,
          plan_id: m.planId,
          body: m.body,
        }),
      );
    },
    async unsay(_c, id) {
      ok(
        await (
          await client()
        )
          .from("passport_conference_messages")
          .delete()
          .eq("id", id),
      );
    },
    async reactions(c, ids) {
      if (!ids.length) return [];
      const rows = ok(
        await (
          await client()
        )
          .from("passport_conference_message_reactions")
          .select("message_id, member_id, emoji")
          .eq("conference_id", c)
          .in("message_id", [...ids]),
      ) as { message_id: string; member_id: string; emoji: string }[];
      return rows.map((r) => ({
        messageId: r.message_id,
        memberId: r.member_id,
        emoji: r.emoji as MessageReaction["emoji"],
      }));
    },
    async react(c, r, on) {
      const db = await client();
      if (on)
        ok(
          await db.from("passport_conference_message_reactions").upsert(
            {
              message_id: r.messageId,
              conference_id: c,
              member_id: r.memberId,
              emoji: r.emoji,
            },
            { onConflict: "message_id,user_id,emoji", ignoreDuplicates: true },
          ),
        );
      else
        ok(
          await db
            .from("passport_conference_message_reactions")
            .delete()
            .eq("message_id", r.messageId)
            .eq("member_id", r.memberId)
            .eq("emoji", r.emoji),
        );
    },
    async latest(c, limit) {
      return (
        ok(
          await (
            await client()
          )
            .from("passport_conference_messages")
            .select(COLUMNS)
            .eq("conference_id", c)
            .order("at", { ascending: false })
            .limit(limit),
        ) as Row[]
      ).map(message);
    },
    async forgetMember() {},
    async forgetConference() {},
  };
}
