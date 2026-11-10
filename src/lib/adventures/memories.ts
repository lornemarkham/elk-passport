import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Memory, MemoryKind } from "./companion";
import { Refused, Unavailable } from "./store";

/**
 * **A person's own memories of an adventure, kept against their account.**
 *
 * Reads and writes `passport_adventure_memories`
 * (`supabase/migrations/20261112000000_passport_adventure_memories.sql`) as the
 * signed-in person. The table's only policies are "yours", so what this
 * returns is what Postgres says is theirs; nothing here can widen it. Until
 * the migration is applied every call answers `MemoriesOff` and the phone
 * keeps the memories on its own, as it always has.
 */
type Db = SupabaseClient;

const MISSING = new Set(["PGRST205", "42P01", "PGRST202"]);
const REFUSAL = new Set(["42501", "PGRST116", "23503", "28000"]);

export class MemoriesOff extends Error {
  constructor() {
    super("Memories aren't kept on accounts yet.");
    this.name = "MemoriesOff";
  }
}

function raise(error: { code?: string; message: string }): never {
  if (
    (error.code && MISSING.has(error.code)) ||
    /does not exist|could not find the table/i.test(error.message)
  )
    throw new MemoriesOff();
  if (error.code && REFUSAL.has(error.code)) throw new Refused();
  throw new Unavailable(error.message);
}

interface Row {
  id: string;
  kind: string;
  item_id: string | null;
  body: string | null;
  photo: string | null;
  taken_at: string;
}

const JPEG = "data:image/jpeg;base64,";

/** Everything this person kept of the adventure, oldest first. */
export async function memoriesOf(
  db: Db,
  adventureId: string,
): Promise<readonly Memory[]> {
  const { data, error } = await db
    .from("passport_adventure_memories")
    .select("id, kind, item_id, body, photo, taken_at")
    .eq("adventure_id", adventureId)
    .order("taken_at", { ascending: true })
    .limit(200);
  if (error) raise(error);
  return ((data as Row[]) ?? []).map((r) => ({
    id: r.id,
    kind: r.kind as MemoryKind,
    at: r.taken_at,
    itemId: r.item_id,
    text: r.body,
    photo: r.photo ? `${JPEG}${r.photo}` : null,
  }));
}

/** Keep one. The same id twice is the same memory (a retry), not a second. */
export async function keepMemory(
  db: Db,
  adventureId: string,
  m: Memory,
): Promise<void> {
  const { error } = await db.from("passport_adventure_memories").upsert(
    {
      id: m.id,
      adventure_id: adventureId,
      kind: m.kind,
      item_id: m.itemId,
      body: m.text,
      photo: m.photo ? m.photo.slice(JPEG.length) : null,
      taken_at: m.at,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) raise(error);
}

export async function dropMemory(db: Db, id: string): Promise<void> {
  const { error } = await db
    .from("passport_adventure_memories")
    .delete()
    .eq("id", id);
  if (error) raise(error);
}
