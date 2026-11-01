import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Refused, Unavailable } from "@/lib/adventures/store";
import type { Moment, MomentKind } from "@/domain/christmas/recap";
import type {
  MomentInput,
  NoticeInput,
  NoticeKind,
} from "@/domain/christmas/together";

/**
 * **Announcements and shared moments, on the adventure core.**
 *
 * Reads and writes the tables proposed in
 * `docs/product/christmas/together-migration.sql`, always as the signed-in
 * person (the core's rule: Postgres decides, this asks). Until that
 * migration is applied the tables do not exist, and every read here answers
 * `off` rather than failing — the page then says sharing isn't switched on,
 * and everything the core already does (plan, vote, invite) keeps working.
 *
 * Nobody's user id leaves the server: authors are named by the display name
 * the group already sees, or "Someone in the group" for a member who chose
 * to be unlisted.
 */

type Db = SupabaseClient;

/** The proposed tables are not there yet (PostgREST / Postgres codes). */
const MISSING = new Set(["PGRST205", "42P01", "PGRST202"]);
const REFUSAL = new Set(["42501", "PGRST116", "23503", "28000"]);

export class SharingOff extends Error {
  constructor() {
    super("Sharing is not switched on for adventures yet.");
    this.name = "SharingOff";
  }
}

function raise(error: { code?: string; message: string }): never {
  if (error.code && MISSING.has(error.code)) throw new SharingOff();
  if (/does not exist|could not find the table/i.test(error.message))
    throw new SharingOff();
  if (error.code && REFUSAL.has(error.code)) throw new Refused();
  throw new Unavailable(error.message);
}

const SOMEONE = "Someone in the group";

async function namesFor(db: Db, adventureId: string) {
  const { data, error } = await db
    .from("passport_adventure_members")
    .select("user_id, display_name")
    .eq("adventure_id", adventureId);
  if (error) raise(error);
  return new Map(
    ((data as { user_id: string; display_name: string | null }[]) ?? []).map(
      (m) => [m.user_id, m.display_name?.trim() || "Guest"],
    ),
  );
}

// ---------------------------------------------------------------- notices

export interface NoticeView {
  readonly id: string;
  readonly kind: NoticeKind;
  readonly headline: string;
  readonly body: string | null;
  readonly atlasRef: string | null;
  readonly askAck: boolean;
  readonly by: string;
  readonly createdAt: string;
  readonly ended: boolean;
  /** You have said "Got it". */
  readonly acked: boolean;
  /** Who has said it, by name — everyone in the group may see this. */
  readonly ackedBy: readonly string[];
}

interface NoticeRow {
  id: string;
  kind: string;
  headline: string;
  body: string | null;
  atlas_ref: string | null;
  ask_ack: boolean;
  user_id: string;
  created_at: string;
  ended_at: string | null;
}

export async function noticesOf(
  db: Db,
  adventureId: string,
  me: string,
): Promise<NoticeView[]> {
  const [notices, acks, names] = await Promise.all([
    db
      .from("passport_adventure_notices")
      .select(
        "id, kind, headline, body, atlas_ref, ask_ack, user_id, created_at, ended_at",
      )
      .eq("adventure_id", adventureId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("passport_adventure_notice_acks")
      .select("notice_id, user_id")
      .eq("adventure_id", adventureId),
    namesFor(db, adventureId),
  ]);
  if (notices.error) raise(notices.error);
  if (acks.error) raise(acks.error);
  const ackRows = (acks.data as { notice_id: string; user_id: string }[]) ?? [];
  return ((notices.data as NoticeRow[]) ?? []).map((n) => {
    const mine = ackRows.filter((a) => a.notice_id === n.id);
    return {
      id: n.id,
      kind: n.kind as NoticeKind,
      headline: n.headline,
      body: n.body,
      atlasRef: n.atlas_ref,
      askAck: n.ask_ack,
      by: names.get(n.user_id) ?? SOMEONE,
      createdAt: n.created_at,
      ended: Boolean(n.ended_at),
      acked: mine.some((a) => a.user_id === me),
      ackedBy: mine.map((a) => names.get(a.user_id) ?? SOMEONE),
    };
  });
}

export async function announce(
  db: Db,
  adventureId: string,
  me: string,
  input: NoticeInput,
): Promise<string> {
  const { data, error } = await db
    .from("passport_adventure_notices")
    .insert({
      adventure_id: adventureId,
      user_id: me,
      kind: input.kind,
      headline: input.headline,
      body: input.body,
      atlas_ref: input.atlasRef,
      ask_ack: input.askAck,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) raise(error);
  if (!data) throw new Refused();
  return data.id;
}

export async function acknowledge(
  db: Db,
  adventureId: string,
  noticeId: string,
  me: string,
): Promise<void> {
  const { error } = await db
    .from("passport_adventure_notice_acks")
    .upsert(
      { notice_id: noticeId, adventure_id: adventureId, user_id: me },
      { onConflict: "notice_id,user_id", ignoreDuplicates: true },
    );
  if (error) raise(error);
}

export async function endNotice(
  db: Db,
  adventureId: string,
  noticeId: string,
): Promise<void> {
  const { data, error } = await db
    .from("passport_adventure_notices")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", noticeId)
    .eq("adventure_id", adventureId)
    .select("id");
  if (error) raise(error);
  if (!data?.length) throw new Refused();
}

// ---------------------------------------------------------------- moments

interface MomentRow {
  id: string;
  kind: string;
  body: string | null;
  has_photo: boolean;
  challenge: string | null;
  atlas_ref: string | null;
  user_id: string;
  created_at: string;
}

const KINDS: readonly MomentKind[] = ["moment", "tradition", "challenge"];

export async function momentsOf(
  db: Db,
  adventureId: string,
  me: string,
): Promise<Moment[]> {
  // The photo bytes are fetched one by one (`photoOf`); the list carries
  // whether there is one, so a page of thirty photos is not one 20 MB read.
  const [moments, names] = await Promise.all([
    db
      .from("passport_adventure_moments")
      .select(
        "id, kind, body, challenge, atlas_ref, user_id, created_at, has_photo",
      )
      .eq("adventure_id", adventureId)
      .order("created_at", { ascending: true })
      .limit(300),
    namesFor(db, adventureId),
  ]);
  if (moments.error) raise(moments.error);
  return ((moments.data as MomentRow[]) ?? []).map((m) => ({
    id: m.id,
    kind: KINDS.includes(m.kind as MomentKind)
      ? (m.kind as MomentKind)
      : "moment",
    text: m.body,
    hasPhoto: m.has_photo,
    challengeId: m.challenge,
    atlasRef: m.atlas_ref,
    by: names.get(m.user_id) ?? SOMEONE,
    mine: m.user_id === me,
    createdAt: m.created_at,
  }));
}

export async function photoOf(
  db: Db,
  adventureId: string,
  momentId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("passport_adventure_moments")
    .select("photo")
    .eq("id", momentId)
    .eq("adventure_id", adventureId)
    .maybeSingle<{ photo: string | null }>();
  if (error) raise(error);
  if (!data) throw new Refused();
  return data.photo;
}

export async function share(
  db: Db,
  adventureId: string,
  me: string,
  input: MomentInput,
): Promise<string> {
  const { data, error } = await db
    .from("passport_adventure_moments")
    .insert({
      adventure_id: adventureId,
      user_id: me,
      kind: input.kind,
      body: input.text,
      photo: input.photo,
      challenge: input.challengeId,
      atlas_ref: input.atlasRef,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) raise(error);
  if (!data) throw new Refused();
  return data.id;
}

export async function unshare(
  db: Db,
  adventureId: string,
  momentId: string,
): Promise<void> {
  const { data, error } = await db
    .from("passport_adventure_moments")
    .delete()
    .eq("id", momentId)
    .eq("adventure_id", adventureId)
    .select("id");
  if (error) raise(error);
  if (!data?.length) throw new Refused();
}

/** Whether the proposed tables are there, asked once per page. */
export async function sharingOn(db: Db, adventureId: string): Promise<boolean> {
  const { error } = await db
    .from("passport_adventure_moments")
    .select("id")
    .eq("adventure_id", adventureId)
    .limit(1);
  if (!error) return true;
  try {
    raise(error);
  } catch (e) {
    if (e instanceof SharingOff) return false;
    throw e;
  }
}
