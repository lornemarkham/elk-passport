import "server-only";
import type { PassportUser } from "@/lib/auth/currentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SYCLE_HOCKEY_NIGHT, type OccasionRow } from "@/domain/hockey/night";
import {
  meetupOf,
  seatColumns,
  seatOf,
  type Meetup,
  type MeetupInput,
  type Seat,
  type SeatInput,
  type SeatPerson,
  type SeatRow,
} from "@/domain/hockey/seats";
import { NightError } from "./night";

/**
 * **Our seats, as the person asking may see them.**
 *
 * As everywhere in Hockey Night: every query runs as the signed-in person,
 * so the database's policies (`seats-migration.sql`) decide what is read and
 * what may be written. The checks here exist to give a person a sentence
 * instead of a 403; they are not the security.
 */

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface SeatsView {
  /** False until the seats migration is applied. The rest of the night works. */
  readonly available: boolean;
  readonly role: "host" | "guest";
  readonly me: string;
  readonly people: readonly (SeatPerson & {
    readonly role: "host" | "guest";
  })[];
  /** Members' rows this person may read, and the group block. */
  readonly seats: readonly Seat[];
  readonly meetup?: Meetup;
  readonly venue: { readonly name: string; readonly at: [number, number] };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PostgREST's "no such table" (before the migration), in either dialect. */
const missingTable = (error: { code?: string; message: string }) =>
  error.code === "42P01" ||
  error.code === "PGRST205" ||
  /could not find the table|does not exist/i.test(error.message);

function fail(error: { message: string; code?: string } | null, what: string) {
  if (!error) return;
  const forbidden =
    error.code === "42501" || /row-level security/i.test(error.message);
  throw new NightError(
    forbidden ? `Not allowed: ${what}.` : error.message,
    forbidden ? 403 : 500,
  );
}

interface Night {
  readonly occasion: Pick<OccasionRow, "id" | "details" | "host_id">;
  readonly members: readonly {
    user_id: string;
    role: "host" | "guest";
    display_name: string;
    emoji: string;
  }[];
  readonly role: "host" | "guest";
}

async function nightFor(
  db: Db,
  user: PassportUser,
  id: string,
): Promise<Night> {
  if (!UUID.test(id)) throw new NightError("Not found.", 404);
  const [{ data: occasion, error }, { data: members, error: mErr }] =
    await Promise.all([
      db
        .from("passport_occasions")
        .select("id, details, host_id")
        .eq("id", id)
        .maybeSingle(),
      db
        .from("passport_occasion_members")
        .select("user_id, role, display_name, emoji")
        .eq("occasion_id", id),
    ]);
  if (error) throw new NightError(error.message, 500);
  if (mErr) throw new NightError(mErr.message, 500);
  const me = members?.find((m) => m.user_id === user.id);
  if (!occasion || !me) throw new NightError("Not found.", 404);
  return {
    occasion: occasion as unknown as Night["occasion"],
    members: members as Night["members"],
    role: me.role as "host" | "guest",
  };
}

export async function seatsFor(
  user: PassportUser,
  id: string,
): Promise<SeatsView> {
  const db = await createSupabaseServerClient();
  const night = await nightFor(db, user, id);
  const details = night.occasion.details ?? {};
  const base = {
    role: night.role,
    me: user.id,
    people: night.members.map((m) => ({
      id: m.user_id,
      name: m.display_name,
      emoji: m.emoji,
      role: m.role,
    })),
    ...(meetupOf((details as { meetup?: unknown }).meetup)
      ? { meetup: meetupOf((details as { meetup?: unknown }).meetup) }
      : {}),
    venue: {
      name: details.venue ?? SYCLE_HOCKEY_NIGHT.details.venue,
      at: [...(details.venueAt ?? SYCLE_HOCKEY_NIGHT.details.venueAt)] as [
        number,
        number,
      ],
    },
  };

  const { data, error } = await db
    .from("passport_occasion_seats")
    .select(
      "user_id, section, row_label, seats, gate, note, shared, updated_by, updated_at",
    )
    .eq("occasion_id", id);
  if (error) {
    if (missingTable(error)) return { ...base, available: false, seats: [] };
    throw new NightError(error.message, 500);
  }
  const members = new Set(night.members.map((m) => m.user_id));
  return {
    ...base,
    available: true,
    seats: (data as SeatRow[])
      .filter((r) => r.user_id === null || members.has(r.user_id))
      .map(seatOf),
  };
}

export async function saveSeat(
  user: PassportUser,
  id: string,
  input: SeatInput,
): Promise<SeatsView> {
  const db = await createSupabaseServerClient();
  const night = await nightFor(db, user, id);
  const target = input.for === "group" ? null : input.for;
  if (target !== user.id && night.role !== "host") {
    throw new NightError(
      target === null
        ? "Only the host sets the group's seats."
        : "You can only change your own seat.",
      403,
    );
  }
  if (target !== null && !night.members.some((m) => m.user_id === target)) {
    throw new NightError("They're not on this night.", 404);
  }

  const columns = seatColumns(input, user.id);
  const existing = db
    .from("passport_occasion_seats")
    .select("id")
    .eq("occasion_id", id);
  const { data: found, error: findError } = await (
    target === null
      ? existing.is("user_id", null)
      : existing.eq("user_id", target)
  ).maybeSingle();
  if (findError && missingTable(findError)) {
    throw new NightError("Seats aren't switched on for this night yet.", 503);
  }
  fail(findError, "reading that seat");

  if (found) {
    const { data, error } = await db
      .from("passport_occasion_seats")
      .update(columns)
      .eq("id", found.id)
      .select("id");
    fail(error, "changing that seat");
    if (!data?.length)
      throw new NightError("Not allowed: changing that seat.", 403);
  } else {
    const { error } = await db
      .from("passport_occasion_seats")
      .insert({ occasion_id: id, user_id: target, ...columns });
    // Somebody else saved the same seat first: theirs stands; read it back.
    if (error?.code !== "23505") fail(error, "saving that seat");
  }
  return seatsFor(user, id);
}

export async function clearSeat(
  user: PassportUser,
  id: string,
  forWho: string,
): Promise<SeatsView> {
  const db = await createSupabaseServerClient();
  const night = await nightFor(db, user, id);
  const target = forWho === "group" ? null : forWho;
  if (target !== user.id && night.role !== "host") {
    throw new NightError("You can only clear your own seat.", 403);
  }
  const rows = db
    .from("passport_occasion_seats")
    .delete()
    .eq("occasion_id", id);
  const { error } = await (target === null
    ? rows.is("user_id", null)
    : rows.eq("user_id", target));
  fail(error, "clearing that seat");
  return seatsFor(user, id);
}

/** The host sets where we find each other at the arena, or clears it. */
export async function setMeetup(
  user: PassportUser,
  id: string,
  input: MeetupInput | null,
): Promise<SeatsView> {
  const db = await createSupabaseServerClient();
  const night = await nightFor(db, user, id);
  if (night.role !== "host") {
    throw new NightError("The host sets the meeting point.", 403);
  }
  const { meetup: _previous, ...rest } = (night.occasion.details ??
    {}) as OccasionRow["details"] & { meetup?: unknown };
  void _previous;
  const details = input
    ? {
        ...rest,
        meetup: {
          ...(input.gate ? { gate: input.gate } : {}),
          ...(input.spot ? { spot: input.spot } : {}),
          ...(input.time ? { time: input.time } : {}),
          setBy: user.id,
        },
      }
    : rest;
  const { data, error } = await db
    .from("passport_occasions")
    .update({ details })
    .eq("id", id)
    .select("id");
  fail(error, "setting the meeting point");
  if (!data?.length)
    throw new NightError("Not allowed: setting the meeting point.", 403);
  return seatsFor(user, id);
}
