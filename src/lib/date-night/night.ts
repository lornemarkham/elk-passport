import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NightConfig } from "@/domain/date-night/adventures";
import {
  addItem,
  adventuresOf,
  createAdventure,
  Refused,
  Unavailable,
} from "@/lib/adventures/store";

/**
 * **A Date Night on the adventure core.**
 *
 * Starting one makes an ordinary adventure (owner, members, invitations and
 * Postgres' row-level security are the core's), seeds its ideas as proposed
 * items for both people to vote on, and seeds the shared packing list. All of
 * it runs as the signed-in person; no service key exists here.
 */

type Db = SupabaseClient;

/** The packing table is not there yet (migration unapplied). */
export class PackingOff extends Error {
  constructor() {
    super("The packing list isn't switched on yet.");
    this.name = "PackingOff";
  }
}

const MISSING = new Set(["PGRST205", "42P01"]);
const REFUSAL = new Set(["42501", "PGRST116", "23503", "28000"]);

function raise(error: { code?: string; message: string }): never {
  if (
    (error.code && MISSING.has(error.code)) ||
    /does not exist|could not find the table/i.test(error.message)
  )
    throw new PackingOff();
  if (error.code && REFUSAL.has(error.code)) throw new Refused();
  throw new Unavailable(error.message);
}

/**
 * Open the night this person already owns, or start it. Starting twice does
 * not make two: a double tap, or a second device, lands on the same one.
 */
export async function startNight(
  db: Db,
  me: string,
  displayName: string | null,
  config: NightConfig,
): Promise<string> {
  const mine = await adventuresOf(db, me);
  const existing = mine.find(
    (a) =>
      a.kind === "date-night-plan" &&
      a.role === "owner" &&
      a.title === config.adventureTitle,
  );
  if (existing) return existing.id;

  const id = await createAdventure(db, {
    kind: "date-night-plan",
    title: config.adventureTitle,
    displayName,
    startsOn: null,
    endsOn: null,
    timeZone: null,
    destinationLabel: null,
    destinationTownId: null,
  });
  // A night that opens on whole adventures plans one itinerary; its old
  // list of loose ideas would only repeat them (mission 487).
  for (const a of config.evenings ? [] : config.activities)
    await addItem(db, id, me, {
      atlasRef: a.atlasRef ?? null,
      label: a.title,
      note: a.line,
      status: "proposed",
      onDay: null,
      startsAt: null,
    });
  try {
    await seedPacking(db, id, me, config.packing);
  } catch (error) {
    // The adventure is good without a packing list; the page says so.
    if (!(error instanceof PackingOff)) throw error;
  }
  return id;
}

// ---------------------------------------------------------------- packing

export interface PackingView {
  readonly id: string;
  readonly label: string;
  /** Who ticked it, as the group sees them; null while unticked. */
  readonly checkedBy: string | null;
  readonly checked: boolean;
}

async function seedPacking(
  db: Db,
  id: string,
  me: string,
  labels: readonly string[],
): Promise<void> {
  const { error } = await db.from("passport_adventure_packing").insert(
    labels.map((label, position) => ({
      adventure_id: id,
      label,
      position,
      added_by: me,
    })),
  );
  if (error) raise(error);
}

export async function packingOf(db: Db, id: string): Promise<PackingView[]> {
  const [items, members] = await Promise.all([
    db
      .from("passport_adventure_packing")
      .select("id, label, checked_by, checked_at")
      .eq("adventure_id", id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("passport_adventure_members")
      .select("user_id, display_name")
      .eq("adventure_id", id),
  ]);
  if (items.error) raise(items.error);
  if (members.error) raise(members.error);
  const names = new Map(
    (
      (members.data as { user_id: string; display_name: string | null }[]) ?? []
    ).map((m) => [m.user_id, m.display_name?.trim() || "Guest"]),
  );
  return (
    (items.data as {
      id: string;
      label: string;
      checked_by: string | null;
      checked_at: string | null;
    }[]) ?? []
  ).map((row) => ({
    id: row.id,
    label: row.label,
    checked: row.checked_at !== null,
    checkedBy: row.checked_by ? (names.get(row.checked_by) ?? "Someone") : null,
  }));
}

export async function addPacking(
  db: Db,
  id: string,
  me: string,
  label: string,
): Promise<string> {
  const last = await db
    .from("passport_adventure_packing")
    .select("position")
    .eq("adventure_id", id)
    .order("position", { ascending: false })
    .limit(1);
  if (last.error) raise(last.error);
  const position =
    (((last.data as { position: number }[] | null) ?? [])[0]?.position ?? -1) +
    1;
  const { data, error } = await db
    .from("passport_adventure_packing")
    .insert({ adventure_id: id, label, position, added_by: me })
    .select("id")
    .single();
  if (error) raise(error);
  return (data as { id: string }).id;
}

export async function tickPacking(
  db: Db,
  id: string,
  itemId: string,
  me: string,
  checked: boolean,
): Promise<void> {
  const { data, error } = await db
    .from("passport_adventure_packing")
    .update(
      checked
        ? { checked_by: me, checked_at: new Date().toISOString() }
        : { checked_by: null, checked_at: null },
    )
    .eq("adventure_id", id)
    .eq("id", itemId)
    .select("id");
  if (error) raise(error);
  if (!data || data.length === 0) throw new Refused();
}

export async function removePacking(
  db: Db,
  id: string,
  itemId: string,
): Promise<void> {
  const { data, error } = await db
    .from("passport_adventure_packing")
    .delete()
    .eq("adventure_id", id)
    .eq("id", itemId)
    .select("id");
  if (error) raise(error);
  if (!data || data.length === 0) throw new Refused();
}

/** A packing label from a request body: trimmed, 1–80 characters. */
export function parsePackingLabel(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const label = (body as Record<string, unknown>).label;
  if (typeof label !== "string") return null;
  const trimmed = label.trim();
  return trimmed.length >= 1 && trimmed.length <= 80 ? trimmed : null;
}
