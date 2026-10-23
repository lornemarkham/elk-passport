import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Photo,
  PhotoReactionRow,
} from "@/domain/conference-memories/memories";
import type { MemoriesStore } from "./store";

/** The album in Postgres, as the signed-in person (Hockey's Memories storage). */
export function supabaseMemories(
  client: () => Promise<SupabaseClient>,
): MemoriesStore {
  const ok = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(`memories store: ${r.error.message}`);
    return r.data;
  };
  return {
    async list(c) {
      const rows = ok(
        await (
          await client()
        )
          .from("passport_conference_photos")
          .select("id, conference_id, member_id, plan_id, caption, at")
          .eq("conference_id", c)
          .order("at", { ascending: false }),
      ) as {
        id: string;
        conference_id: string;
        member_id: string;
        plan_id: string | null;
        caption: string;
        at: string;
      }[];
      return rows.map((r): Photo => ({
        id: r.id,
        conferenceId: r.conference_id,
        memberId: r.member_id,
        planId: r.plan_id,
        caption: r.caption,
        at: new Date(r.at).toISOString(),
      }));
    },
    async count(c) {
      const r = await (
        await client()
      )
        .from("passport_conference_photos")
        .select("id", { count: "exact", head: true })
        .eq("conference_id", c);
      if (r.error) throw new Error(`memories store: ${r.error.message}`);
      return r.count ?? 0;
    },
    async add(p, data) {
      ok(
        await (await client()).from("passport_conference_photos").insert({
          id: p.id,
          conference_id: p.conferenceId,
          member_id: p.memberId,
          plan_id: p.planId,
          caption: p.caption,
          data,
        }),
      );
    },
    async bytes(c, id) {
      const r = ok(
        await (
          await client()
        )
          .from("passport_conference_photos")
          .select("data")
          .eq("conference_id", c)
          .eq("id", id)
          .maybeSingle(),
      ) as { data: string } | null;
      return r?.data ?? null;
    },
    async remove(_c, id) {
      ok(
        await (
          await client()
        )
          .from("passport_conference_photos")
          .delete()
          .eq("id", id),
      );
    },
    async reactions(c) {
      const rows = ok(
        await (
          await client()
        )
          .from("passport_conference_photo_reactions")
          .select("photo_id, member_id, emoji")
          .eq("conference_id", c),
      ) as { photo_id: string; member_id: string; emoji: string }[];
      return rows.map((r) => ({
        photoId: r.photo_id,
        memberId: r.member_id,
        emoji: r.emoji as PhotoReactionRow["emoji"],
      }));
    },
    async react(c, r, on) {
      const db = await client();
      if (on)
        ok(
          await db.from("passport_conference_photo_reactions").upsert(
            {
              photo_id: r.photoId,
              conference_id: c,
              member_id: r.memberId,
              emoji: r.emoji,
            },
            { onConflict: "photo_id,user_id,emoji", ignoreDuplicates: true },
          ),
        );
      else
        ok(
          await db
            .from("passport_conference_photo_reactions")
            .delete()
            .eq("photo_id", r.photoId)
            .eq("member_id", r.memberId)
            .eq("emoji", r.emoji),
        );
    },
    async forgetMember() {},
    async forgetConference() {},
  };
}
