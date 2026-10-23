import "server-only";
import type { PassportUser } from "@/lib/auth/currentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PHOTOS_PER_NIGHT,
  type Memory,
  type MemoriesView,
  type PhotoInput,
} from "@/domain/hockey/memories";
import { NightError } from "./night";

/**
 * **The night's photographs, as the person asking may see them.**
 *
 * As everywhere in Hockey Night, every query runs as the signed-in person, so
 * the database's policies (`memories-migration.sql`) decide what is read and
 * removed. The checks here give a person a sentence instead of a 403.
 */

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const missingTable = (error: { code?: string; message: string }) =>
  error.code === "42P01" ||
  error.code === "PGRST205" ||
  /could not find the table|does not exist/i.test(error.message);

async function membersOf(db: Db, user: PassportUser, id: string) {
  if (!UUID.test(id)) throw new NightError("Not found.", 404);
  const { data, error } = await db
    .from("passport_occasion_members")
    .select("user_id, role, display_name, emoji")
    .eq("occasion_id", id);
  if (error) throw new NightError(error.message, 500);
  const me = data?.find((m) => m.user_id === user.id);
  if (!me) throw new NightError("Not found.", 404);
  return { members: data ?? [], role: me.role as "host" | "guest" };
}

export async function memoriesFor(
  user: PassportUser,
  id: string,
): Promise<MemoriesView> {
  const db = await createSupabaseServerClient();
  const { members, role } = await membersOf(db, user, id);
  const { data, error } = await db
    .from("passport_occasion_photos")
    .select("id, user_id, caption, created_at")
    .eq("occasion_id", id)
    .order("created_at", { ascending: false })
    .limit(PHOTOS_PER_NIGHT);
  if (error) {
    if (missingTable(error)) return { available: false, photos: [] };
    throw new NightError(error.message, 500);
  }
  const who = new Map(members.map((m) => [m.user_id, m]));
  const photos: Memory[] = [];
  for (const row of data ?? []) {
    const m = who.get(row.user_id as string);
    if (!m) continue; // removed from the night: their pictures go with them
    photos.push({
      id: row.id as string,
      by: row.user_id as string,
      byName: m.display_name,
      byEmoji: m.emoji,
      caption: (row.caption as string | null) ?? "",
      at: row.created_at as string,
      mine: row.user_id === user.id,
      canRemove: row.user_id === user.id || role === "host",
    });
  }
  return { available: true, photos };
}

export async function addPhoto(
  user: PassportUser,
  id: string,
  input: PhotoInput,
): Promise<{ id: string }> {
  const db = await createSupabaseServerClient();
  await membersOf(db, user, id);
  // A HEAD count carries no error body, so a missing table cannot be told
  // from here; the insert below says it properly. The count only enforces the
  // album's size.
  const { count } = await db
    .from("passport_occasion_photos")
    .select("id", { count: "exact", head: true })
    .eq("occasion_id", id);
  if ((count ?? 0) >= PHOTOS_PER_NIGHT)
    throw new NightError("This night's album is full.", 409);
  const { data, error } = await db
    .from("passport_occasion_photos")
    .insert({
      occasion_id: id,
      user_id: user.id,
      caption: input.caption || null,
      data: input.data,
    })
    .select("id")
    .single();
  if (error && missingTable(error))
    throw new NightError("Photos aren't switched on yet.", 409);
  if (error || !data) {
    const forbidden =
      error?.code === "42501" ||
      /row-level security/i.test(error?.message ?? "");
    throw new NightError(
      forbidden ? "Not allowed: add a photo." : (error?.message ?? "Failed."),
      forbidden ? 403 : 500,
    );
  }
  return { id: data.id as string };
}

/** The picture itself, base64, or null when this person cannot see one. */
export async function photoBytes(
  user: PassportUser,
  id: string,
  photoId: string,
): Promise<Buffer | null> {
  if (!UUID.test(photoId)) return null;
  const db = await createSupabaseServerClient();
  await membersOf(db, user, id);
  const { data, error } = await db
    .from("passport_occasion_photos")
    .select("data")
    .eq("id", photoId)
    .eq("occasion_id", id)
    .maybeSingle();
  if (error || !data) return null;
  return Buffer.from(data.data as string, "base64");
}

export async function removePhoto(
  user: PassportUser,
  id: string,
  photoId: string,
): Promise<void> {
  if (!UUID.test(photoId)) throw new NightError("Not found.", 404);
  const db = await createSupabaseServerClient();
  await membersOf(db, user, id);
  const { data, error } = await db
    .from("passport_occasion_photos")
    .delete()
    .eq("id", photoId)
    .eq("occasion_id", id)
    .select("id");
  if (error) throw new NightError(error.message, 500);
  if (!data || data.length === 0)
    throw new NightError("That isn't yours to take down.", 403);
}
