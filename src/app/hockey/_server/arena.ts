import "server-only";
import type { PassportUser } from "@/lib/auth/currentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SYCLE_HOCKEY_NIGHT, type OccasionRow } from "@/domain/hockey/night";
import { meetupOf } from "@/domain/hockey/seats";
import { levelOfSection } from "@/domain/hockey/concourse";
import {
  arenaWindow,
  placeOf,
  questKind,
  windowState,
  type ArenaAction,
  type ArenaView,
  type CheckIn,
  type Ping,
  type PingKind,
  type Quest,
} from "@/domain/hockey/arena-mode";
import {
  NO_CREW,
  hintFromReading,
  type CrewView,
  type GpsZone,
  type SnackRunStatus,
  type SummonResponse,
} from "@/domain/hockey/crew";
import { spotById } from "@/domain/hockey/concourse";
import { NightError } from "./night";

/**
 * **Arena Mode, as the person asking may see it.**
 *
 * Same discipline as the rest of Hockey Night: every query runs as the
 * signed-in person, so `arena-migration.sql`'s policies decide what is read
 * and written — members only, own rows only, inside the event window. The
 * checks here turn a refusal into a sentence; they are not the security.
 */

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  readonly occasion: Pick<
    OccasionRow,
    "id" | "title" | "starts_at" | "details" | "host_id"
  >;
  readonly members: readonly {
    user_id: string;
    role: "host" | "guest";
    display_name: string;
    emoji: string;
    hue: number;
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
        .select("id, title, starts_at, details, host_id")
        .eq("id", id)
        .maybeSingle(),
      db
        .from("passport_occasion_members")
        .select("user_id, role, display_name, emoji, hue")
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

/** Members' seat sections they let the night see (Our Seats), if that table exists. */
async function sectionsOf(db: Db, id: string): Promise<Map<string, string>> {
  const { data, error } = await db
    .from("passport_occasion_seats")
    .select("user_id, section")
    .eq("occasion_id", id);
  const out = new Map<string, string>();
  if (error) return out;
  let block: string | undefined;
  for (const r of data as { user_id: string | null; section: string }[]) {
    const s = r.section
      .trim()
      .toUpperCase()
      .replace(/^SECTION\s*/, "");
    if (!levelOfSection(s)) continue;
    if (r.user_id) out.set(r.user_id, s);
    else block = s;
  }
  if (block) out.set("group", block);
  return out;
}

export async function arenaFor(
  user: PassportUser,
  id: string,
): Promise<ArenaView> {
  const db = await createSupabaseServerClient();
  const night = await nightFor(db, user, id);
  return viewOf(db, user, night);
}

async function viewOf(
  db: Db,
  user: PassportUser,
  night: Night,
): Promise<ArenaView> {
  const id = night.occasion.id;
  const details = (night.occasion.details ?? {}) as OccasionRow["details"] & {
    meetup?: unknown;
  };
  const window = arenaWindow(night.occasion.starts_at);
  const now = new Date();
  const meetup = meetupOf(details.meetup);
  const sections = await sectionsOf(db, id);
  const base = {
    nightId: id,
    title: night.occasion.title,
    venue: details.venue ?? SYCLE_HOCKEY_NIGHT.details.venue,
    startsAt: new Date(night.occasion.starts_at).toISOString(),
    opensAt: window.opensAt.toISOString(),
    closesAt: window.closesAt.toISOString(),
    me: user.id,
    role: night.role,
    people: night.members.map((m) => ({
      id: m.user_id,
      name: m.display_name,
      emoji: m.emoji,
      hue: m.hue,
      role: m.role,
      // Their own seat only: nobody is assumed to be in the group's block.
      ...(sections.get(m.user_id) ? { section: sections.get(m.user_id) } : {}),
    })),
    ...(sections.get("group") ? { block: sections.get("group") } : {}),
    ...(meetup
      ? {
          meetup: {
            ...(meetup.gate ? { gate: meetup.gate } : {}),
            ...(meetup.spot ? { spot: meetup.spot } : {}),
            ...(meetup.time ? { time: meetup.time } : {}),
          },
        }
      : {}),
    now: now.toISOString(),
  };

  // Expired rows are already invisible (RLS); once the night is over, whoever
  // looks first also deletes them for good.
  if (windowState(window, now) === "closed") {
    await db.rpc("passport_arena_purge");
    await db.rpc("passport_crew_purge");
  }

  const [checkins, pings, quests, crew] = await Promise.all([
    db
      .from("passport_occasion_checkins")
      .select("user_id, place, status, updated_at")
      .eq("occasion_id", id),
    db
      .from("passport_occasion_pings")
      .select("id, from_user, to_user, kind, place, reply_to, note, created_at")
      .eq("occasion_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    db
      .from("passport_occasion_quests")
      .select(
        "id, kind, started_by, subject_user, place, note, status, closed_by, closed_note, created_at",
      )
      .eq("occasion_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("passport_occasion_quest_crew")
      .select("quest_id, user_id, note, place, price_cents, updated_at")
      .eq("occasion_id", id),
  ]);
  const first = checkins.error ?? pings.error ?? quests.error ?? crew.error;
  if (first) {
    if (missingTable(first))
      return {
        ...base,
        available: false,
        checkins: [],
        pings: [],
        quests: [],
        crew: NO_CREW,
      };
    throw new NightError(first.message, 500);
  }

  const members = new Set(night.members.map((m) => m.user_id));
  const crewView = await tonightsCrew(db, id, members);
  type CrewRow = {
    quest_id: string;
    user_id: string;
    note: string;
    place: string | null;
    price_cents: number | null;
    updated_at: string;
  };
  const crewOf = (questId: string) =>
    (crew.data as CrewRow[])
      .filter((c) => c.quest_id === questId && members.has(c.user_id))
      .map((c) => ({
        user: c.user_id,
        note: c.note,
        place: c.place,
        priceCents: c.price_cents,
        at: c.updated_at,
      }));

  return {
    ...base,
    available: true,
    crew: crewView,
    checkins: (
      checkins.data as {
        user_id: string;
        place: string;
        status: string;
        updated_at: string;
      }[]
    )
      .filter((c) => members.has(c.user_id))
      .map((c): CheckIn => ({
        user: c.user_id,
        place: c.place,
        status: c.status,
        at: c.updated_at,
      })),
    pings: (
      pings.data as {
        id: string;
        from_user: string;
        to_user: string | null;
        kind: PingKind;
        place: string | null;
        reply_to: string | null;
        note: string;
        created_at: string;
      }[]
    ).map((p): Ping => ({
      id: p.id,
      from: p.from_user,
      to: p.to_user,
      kind: p.kind,
      place: p.place,
      replyTo: p.reply_to,
      note: p.note,
      at: p.created_at,
    })),
    quests: (
      quests.data as {
        id: string;
        kind: string;
        started_by: string;
        subject_user: string | null;
        place: string | null;
        note: string;
        status: Quest["status"];
        closed_by: string | null;
        closed_note: string;
        created_at: string;
      }[]
    ).map((q): Quest => ({
      id: q.id,
      kind: q.kind,
      startedBy: q.started_by,
      subject: q.subject_user,
      place: q.place,
      note: q.note,
      status: q.status,
      closedBy: q.closed_by,
      closedNote: q.closed_note,
      at: q.created_at,
      crew: crewOf(q.id),
    })),
  };
}

/**
 * The Crew tables are a separate migration: without them everything else in
 * Arena Mode still works and `crew.available` is false.
 */
async function tonightsCrew(
  db: Db,
  id: string,
  members: ReadonlySet<string>,
): Promise<CrewView> {
  const [gps, summons, replies, runs, items] = await Promise.all([
    db
      .from("passport_occasion_gps_hints")
      .select("user_id, zone, distance_m, accuracy_m, updated_at")
      .eq("occasion_id", id),
    db
      .from("passport_occasion_summons")
      .select("id, from_user, place, note, created_at")
      .eq("occasion_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("passport_occasion_summon_replies")
      .select("summon_id, user_id, response, updated_at")
      .eq("occasion_id", id),
    db
      .from("passport_occasion_snack_runs")
      .select("id, runner, stand, note, status, created_at")
      .eq("occasion_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("passport_occasion_snack_items")
      .select("run_id, user_id, item, updated_at")
      .eq("occasion_id", id),
  ]);
  const first =
    gps.error ?? summons.error ?? replies.error ?? runs.error ?? items.error;
  if (first) {
    if (missingTable(first)) return NO_CREW;
    throw new NightError(first.message, 500);
  }
  const replyRows = replies.data as {
    summon_id: string;
    user_id: string;
    response: SummonResponse;
    updated_at: string;
  }[];
  const itemRows = items.data as {
    run_id: string;
    user_id: string;
    item: string;
    updated_at: string;
  }[];
  return {
    available: true,
    gps: (
      gps.data as {
        user_id: string;
        zone: GpsZone;
        distance_m: number;
        accuracy_m: number;
        updated_at: string;
      }[]
    )
      .filter((g) => members.has(g.user_id))
      .map((g) => ({
        user: g.user_id,
        zone: g.zone,
        distanceM: g.distance_m,
        accuracyM: g.accuracy_m,
        at: g.updated_at,
      })),
    summons: (
      summons.data as {
        id: string;
        from_user: string;
        place: string;
        note: string;
        created_at: string;
      }[]
    )
      .filter((x) => members.has(x.from_user))
      .map((x) => ({
        id: x.id,
        from: x.from_user,
        place: x.place,
        note: x.note,
        at: x.created_at,
        replies: replyRows
          .filter((r) => r.summon_id === x.id && members.has(r.user_id))
          .map((r) => ({
            user: r.user_id,
            response: r.response,
            at: r.updated_at,
          })),
      })),
    runs: (
      runs.data as {
        id: string;
        runner: string;
        stand: string | null;
        note: string;
        status: SnackRunStatus;
        created_at: string;
      }[]
    )
      .filter((r) => members.has(r.runner))
      .map((r) => ({
        id: r.id,
        runner: r.runner,
        stand: r.stand,
        note: r.note,
        status: r.status,
        at: r.created_at,
        items: itemRows
          .filter((i) => i.run_id === r.id && members.has(i.user_id))
          .map((i) => ({ user: i.user_id, item: i.item, at: i.updated_at })),
      })),
  };
}

/** Pings of one kind to one person (or everyone) this soon after the last are refused. */
const PING_COOLDOWN_MS = 20_000;

export async function arenaAct(
  user: PassportUser,
  id: string,
  action: ArenaAction,
): Promise<ArenaView> {
  const db = await createSupabaseServerClient();
  const night = await nightFor(db, user, id);
  const state = windowState(arenaWindow(night.occasion.starts_at), new Date());
  if (
    action.type !== "vanish" &&
    action.type !== "stopSharing" &&
    state !== "open"
  ) {
    throw new NightError(
      state === "before"
        ? "Arena Mode opens three hours before puck drop."
        : "The night's over. Everybody's dot has gone home.",
      409,
    );
  }
  const details = (night.occasion.details ?? {}) as { meetup?: unknown };
  const meetup = meetupOf(details.meetup);
  const knownPlace = (place: string | undefined) => {
    if (place && !placeOf(place, meetup)) {
      throw new NightError("Passport doesn't know that place.", 400);
    }
  };
  const isMember = (uid: string) =>
    night.members.some((m) => m.user_id === uid);

  switch (action.type) {
    case "checkin": {
      knownPlace(action.place);
      const columns = { place: action.place, status: action.status };
      const { data, error } = await db
        .from("passport_occasion_checkins")
        .update(columns)
        .eq("occasion_id", id)
        .eq("user_id", user.id)
        .select("user_id");
      if (error && missingTable(error)) throw switchedOff();
      fail(error, "checking in");
      if (!data?.length) {
        const { error: insError } = await db
          .from("passport_occasion_checkins")
          .insert({ occasion_id: id, user_id: user.id, ...columns });
        if (insError?.code !== "23505") fail(insError, "checking in");
      }
      break;
    }
    case "vanish": {
      const { error } = await db
        .from("passport_occasion_checkins")
        .delete()
        .eq("occasion_id", id)
        .eq("user_id", user.id);
      if (error && missingTable(error)) throw switchedOff();
      fail(error, "vanishing");
      await dropHint(db, id, user.id);
      break;
    }
    case "ping": {
      knownPlace(action.place);
      if (action.to && !isMember(action.to)) {
        throw new NightError("They're not on this night.", 404);
      }
      if (action.to === user.id) {
        throw new NightError(
          "You can't find yourself. Spiritually, maybe.",
          400,
        );
      }
      if ((action.kind === "where" || action.kind === "cant") && !action.to) {
        throw new NightError("Who's that for?", 400);
      }
      if ((action.kind === "herd" || action.kind === "meet") && !action.place) {
        throw new NightError("Meet where?", 400);
      }
      const since = new Date(Date.now() - PING_COOLDOWN_MS).toISOString();
      const recent = db
        .from("passport_occasion_pings")
        .select("id")
        .eq("occasion_id", id)
        .eq("from_user", user.id)
        .eq("kind", action.kind)
        .gte("created_at", since);
      const { data: again, error: againError } = await (action.to
        ? recent.eq("to_user", action.to)
        : recent.is("to_user", null));
      if (againError && missingTable(againError)) throw switchedOff();
      if (again?.length) {
        throw new NightError("Easy. Give them twenty seconds.", 429);
      }
      const { error } = await db.from("passport_occasion_pings").insert({
        occasion_id: id,
        from_user: user.id,
        to_user: action.to ?? null,
        kind: action.kind,
        place: action.place ?? null,
        reply_to: action.replyTo ?? null,
        note: action.note,
      });
      fail(error, "sending that");
      break;
    }
    case "questStart": {
      const kind = questKind(action.kind);
      if (!kind) throw new NightError("That isn't a quest.", 400);
      knownPlace(action.place);
      if (kind.needsPlace && !action.place) {
        throw new NightError("Pick where the herd meets.", 400);
      }
      if (kind.needsSubject && (!action.subject || !isMember(action.subject))) {
        throw new NightError("Who's missing?", 400);
      }
      const { data: open, error: openError } = await db
        .from("passport_occasion_quests")
        .select("id")
        .eq("occasion_id", id)
        .eq("kind", kind.id)
        .eq("status", "open");
      if (openError && missingTable(openError)) throw switchedOff();
      fail(openError, "reading quests");
      if (open?.length) {
        throw new NightError(
          `There's already a ${kind.name} on. Join it.`,
          409,
        );
      }
      const { data, error } = await db
        .from("passport_occasion_quests")
        .insert({
          occasion_id: id,
          kind: kind.id,
          started_by: user.id,
          subject_user: kind.needsSubject ? action.subject : null,
          place: action.place ?? null,
          note: action.note,
        })
        .select("id")
        .single();
      fail(error, "starting that quest");
      // Whoever starts it is on it.
      const { error: crewError } = await db
        .from("passport_occasion_quest_crew")
        .insert({ quest_id: data!.id, occasion_id: id, user_id: user.id });
      fail(crewError, "joining that quest");
      break;
    }
    case "questJoin": {
      knownPlace(action.place);
      const columns = {
        note: action.note,
        ...(action.place !== undefined ? { place: action.place } : {}),
        ...(action.priceCents !== undefined
          ? { price_cents: action.priceCents }
          : {}),
      };
      const { data, error } = await db
        .from("passport_occasion_quest_crew")
        .update(columns)
        .eq("quest_id", action.quest)
        .eq("user_id", user.id)
        .select("user_id");
      fail(error, "updating that");
      if (!data?.length) {
        const { error: insError } = await db
          .from("passport_occasion_quest_crew")
          .insert({
            quest_id: action.quest,
            occasion_id: id,
            user_id: user.id,
            ...columns,
          });
        if (insError?.code !== "23505") fail(insError, "joining that quest");
      }
      break;
    }
    case "questLeave": {
      const { error } = await db
        .from("passport_occasion_quest_crew")
        .delete()
        .eq("quest_id", action.quest)
        .eq("user_id", user.id);
      fail(error, "leaving that quest");
      break;
    }
    case "questClose": {
      const { data, error } = await db
        .from("passport_occasion_quests")
        .update({
          status: action.outcome,
          closed_by: user.id,
          closed_note: action.note,
        })
        .eq("id", action.quest)
        .eq("occasion_id", id)
        .select("id");
      fail(error, "finishing that quest");
      if (!data?.length) {
        throw new NightError(
          "Only the crew can finish that one — join it first.",
          403,
        );
      }
      break;
    }
    case "stopSharing": {
      const { error } = await db
        .from("passport_occasion_checkins")
        .delete()
        .eq("occasion_id", id)
        .eq("user_id", user.id);
      if (error && missingTable(error)) throw switchedOff();
      fail(error, "stopping");
      await dropHint(db, id, user.id);
      break;
    }
    case "gpsShare": {
      const hint = hintFromReading(action.reading);
      if (!hint) {
        throw new NightError(
          "Your phone's GPS is too rough right now to say anything useful. Say where you are on the map instead.",
          422,
        );
      }
      const columns = {
        zone: hint.zone,
        distance_m: hint.distanceM,
        accuracy_m: hint.accuracyM,
      };
      const { data, error } = await db
        .from("passport_occasion_gps_hints")
        .update(columns)
        .eq("occasion_id", id)
        .eq("user_id", user.id)
        .select("user_id");
      if (error && missingTable(error)) throw crewOff();
      fail(error, "sharing a GPS hint");
      if (!data?.length) {
        const { error: insError } = await db
          .from("passport_occasion_gps_hints")
          .insert({ occasion_id: id, user_id: user.id, ...columns });
        if (insError?.code !== "23505") fail(insError, "sharing a GPS hint");
      }
      break;
    }
    case "summon": {
      knownPlace(action.place);
      const since = new Date(Date.now() - PING_COOLDOWN_MS).toISOString();
      const { data: again, error: againError } = await db
        .from("passport_occasion_summons")
        .select("id")
        .eq("occasion_id", id)
        .eq("from_user", user.id)
        .gte("created_at", since);
      if (againError && missingTable(againError)) throw crewOff();
      if (again?.length) {
        throw new NightError("Easy. Give the squad twenty seconds.", 429);
      }
      const { error } = await db.from("passport_occasion_summons").insert({
        occasion_id: id,
        from_user: user.id,
        place: action.place,
        note: action.note,
      });
      fail(error, "summoning the squad");
      break;
    }
    case "summonReply": {
      const { data: summon, error: readError } = await db
        .from("passport_occasion_summons")
        .select("id, from_user")
        .eq("id", action.summon)
        .eq("occasion_id", id)
        .maybeSingle();
      if (readError && missingTable(readError)) throw crewOff();
      fail(readError, "reading that summons");
      if (!summon) throw new NightError("That summons is gone.", 404);
      if (summon.from_user === user.id) {
        throw new NightError("You summoned them. You're already there.", 400);
      }
      const { data, error } = await db
        .from("passport_occasion_summon_replies")
        .update({ response: action.response })
        .eq("summon_id", action.summon)
        .eq("user_id", user.id)
        .select("user_id");
      fail(error, "answering");
      if (!data?.length) {
        const { error: insError } = await db
          .from("passport_occasion_summon_replies")
          .insert({
            summon_id: action.summon,
            occasion_id: id,
            user_id: user.id,
            response: action.response,
          });
        if (insError?.code !== "23505") fail(insError, "answering");
      }
      break;
    }
    case "runStart": {
      if (action.stand) {
        const spot = spotById(action.stand);
        if (
          !spot ||
          !(
            spot.kind === "food" ||
            spot.kind === "drink" ||
            spot.kind === "snackCart"
          )
        ) {
          throw new NightError("That isn't a concession on the map.", 400);
        }
      }
      const { data: mine, error: mineError } = await db
        .from("passport_occasion_snack_runs")
        .select("id")
        .eq("occasion_id", id)
        .eq("runner", user.id)
        .eq("status", "open");
      if (mineError && missingTable(mineError)) throw crewOff();
      fail(mineError, "reading your runs");
      if (mine?.length) {
        throw new NightError(
          "You already have a run on. Finish it or cancel it first.",
          409,
        );
      }
      const { error } = await db.from("passport_occasion_snack_runs").insert({
        occasion_id: id,
        runner: user.id,
        stand: action.stand ?? null,
        note: action.note,
      });
      fail(error, "announcing that run");
      break;
    }
    case "runRequest": {
      const columns = { item: action.item };
      const { data, error } = await db
        .from("passport_occasion_snack_items")
        .update(columns)
        .eq("run_id", action.run)
        .eq("user_id", user.id)
        .select("user_id");
      if (error && missingTable(error)) throw crewOff();
      fail(error, "changing your request");
      if (!data?.length) {
        const { error: insError } = await db
          .from("passport_occasion_snack_items")
          .insert({
            run_id: action.run,
            occasion_id: id,
            user_id: user.id,
            ...columns,
          });
        if (insError?.code === "23505") break;
        if (insError) {
          throw new NightError(
            insError.code === "42501" ||
              /row-level security/i.test(insError.message)
              ? "That run has left. Ask for the next one."
              : insError.message,
            insError.code === "42501" ? 409 : 500,
          );
        }
      }
      break;
    }
    case "runUnrequest": {
      const { error } = await db
        .from("passport_occasion_snack_items")
        .delete()
        .eq("run_id", action.run)
        .eq("user_id", user.id);
      if (error && missingTable(error)) throw crewOff();
      fail(error, "taking that back");
      break;
    }
    case "runClose": {
      const { data, error } = await db
        .from("passport_occasion_snack_runs")
        .update({ status: action.outcome })
        .eq("id", action.run)
        .eq("occasion_id", id)
        .select("id");
      if (error && missingTable(error)) throw crewOff();
      fail(error, "closing that run");
      if (!data?.length) {
        throw new NightError("Only the person going can close their run.", 403);
      }
      break;
    }
  }
  return viewOf(db, user, night);
}

/** Removing your GPS hint is part of vanishing; a night without the Crew has none. */
async function dropHint(db: Db, id: string, userId: string) {
  const { error } = await db
    .from("passport_occasion_gps_hints")
    .delete()
    .eq("occasion_id", id)
    .eq("user_id", userId);
  if (error && !missingTable(error)) fail(error, "stopping your GPS hint");
}

const crewOff = () =>
  new NightError("The Crew isn't switched on for this night yet.", 503);

const switchedOff = () =>
  new NightError("Arena Mode isn't switched on for this night yet.", 503);
