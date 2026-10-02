import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PassportUser } from "@/lib/auth/currentUser";

/**
 * **The Things a person means to do this October, and the ones they say they did.**
 *
 * Two states, and the line between them is the only rule that matters:
 *
 *   ahead   they said "want to do"
 *   lived   they said "did this"
 *
 * `lived` is set by one explicit act and by nothing else. Not by opening a
 * page, saving to a board, being near a place, or any signal a device could
 * produce. Passport never pretends to have tracked anyone, so the record of
 * a lived October can only ever be the person's own word (bible §23 #14).
 *
 * Reads and writes go through the caller's own session, so RLS is the
 * boundary — another person's rows do not exist as far as this module can
 * see. Same pattern as `preferenceService`.
 */
import type { OctoberKind, OctoberState, OctoberThing } from "./types";
export type { OctoberKind, OctoberState, OctoberThing } from "./types";

interface Row {
  entity_id: string;
  entity_kind: OctoberKind;
  name: string;
  starts_at: string | null;
  state: OctoberState;
  wanted_at: string;
  lived_at: string | null;
}

const fromRow = (r: Row): OctoberThing => ({
  entityId: r.entity_id,
  entityKind: r.entity_kind,
  name: r.name,
  startsAt: r.starts_at,
  state: r.state,
  wantedAt: r.wanted_at,
  livedAt: r.lived_at,
});

export { isOctoberKind } from "./types";

export async function octoberThingsFor(
  user: PassportUser,
): Promise<OctoberThing[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("passport_october_things")
    .select(
      "entity_id, entity_kind, name, starts_at, state, wanted_at, lived_at",
    )
    .eq("user_id", user.id);

  // No October yet is a complete answer, and a read failure must not take the
  // page down — an empty October is what the page is designed to show.
  if (error || !data) return [];
  return (data as Row[]).map(fromRow);
}

/**
 * "Want to do." Idempotent: wanting a Thing twice is one row, and wanting a
 * Thing already lived leaves it lived — nobody un-does something by wanting
 * it again.
 */
export async function wantThing(
  user: PassportUser,
  thing: {
    entityId: string;
    entityKind: OctoberKind;
    name: string;
    startsAt?: string | null;
  },
): Promise<OctoberThing> {
  const supabase = await createSupabaseServerClient();

  const existing = await supabase
    .from("passport_october_things")
    .select(
      "entity_id, entity_kind, name, starts_at, state, wanted_at, lived_at",
    )
    .eq("user_id", user.id)
    .eq("entity_id", thing.entityId)
    .maybeSingle<Row>();
  if (existing.data) return fromRow(existing.data);

  const { data, error } = await supabase
    .from("passport_october_things")
    .insert({
      user_id: user.id,
      entity_id: thing.entityId,
      entity_kind: thing.entityKind,
      name: thing.name,
      starts_at: thing.startsAt ?? null,
      state: "ahead",
    })
    .select(
      "entity_id, entity_kind, name, starts_at, state, wanted_at, lived_at",
    )
    .single<Row>();

  if (error || !data)
    throw new Error(`Could not keep that: ${error?.message ?? "no row"}`);
  return fromRow(data);
}

/**
 * "Did this." The one act that makes a Thing lived. Idempotent: saying it
 * twice keeps the first time it was said.
 */
export async function livedThing(
  user: PassportUser,
  entityId: string,
): Promise<OctoberThing | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("passport_october_things")
    .update({ state: "lived", lived_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("entity_id", entityId)
    .eq("state", "ahead")
    .select(
      "entity_id, entity_kind, name, starts_at, state, wanted_at, lived_at",
    )
    .maybeSingle<Row>();

  if (error) throw new Error(`Could not record that: ${error.message}`);
  if (data) return fromRow(data);

  // Already lived, or never wanted. Return what is there, or nothing.
  const current = await supabase
    .from("passport_october_things")
    .select(
      "entity_id, entity_kind, name, starts_at, state, wanted_at, lived_at",
    )
    .eq("user_id", user.id)
    .eq("entity_id", entityId)
    .maybeSingle<Row>();
  return current.data ? fromRow(current.data) : null;
}

/** Changed their mind. Removes the row whatever its state. */
export async function forgetThing(
  user: PassportUser,
  entityId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("passport_october_things")
    .delete()
    .eq("user_id", user.id)
    .eq("entity_id", entityId);
  if (error) throw new Error(`Could not remove that: ${error.message}`);
}

/**
 * **Give something a day.**
 *
 * The one interaction that turns *carve pumpkins* into *carve pumpkins,
 * Saturday* — which is the difference between a wish and a plan, and the
 * thing this experiment exists to test.
 *
 * Only the day is stored, anchored at local midday. The column is an instant
 * and a date-only value written at UTC midnight reads as the previous evening
 * in Vancouver — the bug already recorded in `anticipation.ts` for Atlas
 * snapshots. Writing midday means `localDay` returns the day somebody picked.
 *
 * Owner-scoped like everything else here: the update is filtered on the
 * caller's own id *and* runs through their session, so row-level security is
 * the boundary rather than this filter being the only thing standing between
 * two people's Octobers.
 */
export async function planThing(
  user: PassportUser,
  entityId: string,
  /** `YYYY-MM-DD`, or null to take the day back off. */
  day: string | null,
): Promise<OctoberThing | null> {
  const supabase = await createSupabaseServerClient();
  const startsAt = day ? `${day}T12:00:00-07:00` : null;

  const { data, error } = await supabase
    .from("passport_october_things")
    .update({ starts_at: startsAt })
    .eq("user_id", user.id)
    .eq("entity_id", entityId)
    .select(
      "entity_id, entity_kind, name, starts_at, state, wanted_at, lived_at",
    )
    .maybeSingle<Row>();

  if (error) throw new Error(`Could not plan that: ${error.message}`);
  return data ? fromRow(data) : null;
}
