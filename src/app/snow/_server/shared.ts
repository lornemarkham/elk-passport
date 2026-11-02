import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Refused,
  Unavailable,
  createInvite,
  describeInvite,
  redeemInvite,
  removeMember,
  updateMe,
} from "@/lib/adventures/store";
import type { Ability, Discipline } from "@/domain/snow/ability";
import type { Action, SnowDay } from "@/domain/snow/day";
import {
  assemble,
  plan,
  type MemberRow,
  type Op,
  type SharedRows,
} from "@/domain/snow/shared";

/**
 * **Powder Day on the shared tables: one day, many phones.**
 *
 * Every function takes a database client that is *the signed-in person* (anon
 * key + their session, the way `@/lib/adventures/server` hands one out), so
 * Postgres decides what each call may see and change. There is no service
 * role here and no AI call: a change is `plan()` (pure) and some inserts.
 *
 * The kind is `snow-day`. Membership, invitations, title and date are the
 * adventure core's; everything else is `passport_snow_*`
 * (supabase/migrations/20261103000000_passport_snow.sql).
 */
type Db = SupabaseClient;

export const SNOW_KIND = "snow-day";

/** Why a change was not made, in words a person can read. */
export type Outcome =
  | {
      readonly ok: true;
      /** `null` once you have left: the day is no longer yours to see. */
      readonly view: SharedView | null;
    }
  | { readonly ok: false; readonly reason: string };

export interface SharedView {
  readonly day: SnowDay;
  /** The caller's own person id in `day`. */
  readonly me: string;
  readonly isOwner: boolean;
}

function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "P0001") throw new Declined(reasonFor(error));
  if (
    error.code === "42501" ||
    error.code === "23503" ||
    error.code === "PGRST116"
  )
    throw new Refused();
  throw new Unavailable(error.message);
}

class Declined extends Error {}

function reasonFor(error: { hint?: string | null; message: string }): string {
  if (error.hint === "rate") return "Easy — give it a few seconds.";
  if (error.hint === "full") return "This snow day is full of that already.";
  return "That wasn't allowed.";
}

/** A write that Postgres may refuse *silently* (zero rows) must say so. */
function changed(result: {
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
}) {
  check(result.error);
  if (!result.data || result.data.length === 0) throw new Refused();
}

/**
 * Set a row that is identified by `keys`: change it if it is there, add it if
 * not. Not PostgREST's merge-duplicates upsert, which would also try to
 * UPDATE the key columns — and the tables deliberately grant no UPDATE on
 * them, so that nothing can be re-homed to another day or another person.
 */
async function put(
  db: Db,
  table: string,
  keys: Record<string, string>,
  values: Record<string, unknown>,
  /** Columns written only when the row is first added. */
  onAdd: Record<string, unknown> = {},
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let q = db.from(table).update(values);
    for (const [k, v] of Object.entries(keys)) q = q.eq(k, v);
    const updated = await q.select(Object.keys(keys)[0]);
    check(updated.error);
    if (updated.data && updated.data.length > 0) return;
    const added = await db.from(table).insert({ ...keys, ...onAdd, ...values });
    // Somebody (the same person on another phone) added it between our two
    // calls: go round again and change theirs.
    if (added.error?.code === "23505") continue;
    return check(added.error);
  }
}

// ------------------------------------------------------------------ start

export interface HostInput {
  readonly title: string;
  readonly name: string;
  readonly discipline: Discipline;
  readonly ability: Ability;
  readonly ownGear: boolean;
  readonly note?: string;
}

/**
 * Start a shared day. The caller becomes its owner and first rider — the
 * adventure, the day's row and the host's level in one transaction
 * (`passport_snow_start`), so a dropped connection cannot leave half a day.
 */
export async function startDay(db: Db, host: HostInput): Promise<string> {
  const { data, error } = await db.rpc("passport_snow_start", {
    p_title: host.title,
    p_display_name: host.name,
    p_discipline: host.discipline,
    p_ability: host.ability,
    p_own_gear: host.ownGear,
    p_note: host.note?.trim() ? host.note.trim().slice(0, 80) : null,
  });
  check(error);
  if (typeof data !== "string") throw new Unavailable("no id came back");
  return data;
}

async function saveProfile(
  db: Db,
  id: string,
  me: string,
  p: {
    readonly discipline: Discipline;
    readonly ability: Ability;
    readonly ownGear: boolean;
    readonly note?: string;
  },
  /** Joining again through the same link must not undo what you changed. */
  keepExisting = false,
) {
  const values = {
    discipline: p.discipline,
    ability: p.ability,
    own_gear: p.ownGear,
    note: p.note?.trim() ? p.note.trim().slice(0, 80) : null,
  };
  if (keepExisting) {
    return check(
      (
        await db
          .from("passport_snow_people")
          .upsert(
            { adventure_id: id, ...values },
            { onConflict: "adventure_id,user_id", ignoreDuplicates: true },
          )
      ).error,
    );
  }
  await put(
    db,
    "passport_snow_people",
    { adventure_id: id, user_id: me },
    values,
  );
}

// ------------------------------------------------------------------- read

const TABLES = {
  proposals: "id, user_id, topic, label, detail, source, created_at",
  votes: "user_id, proposal_id",
  decisions: "topic, proposal_id",
  posts: "id, user_id, kind, body, created_at",
  challenges: "id, user_id, title, created_at",
  completions: "user_id, challenge_id, completed_at",
  // Not `photo`: a poll must not carry every picture. Photos have a route.
  moments: "id, user_id, kind, body, created_at",
  predictions: "id, user_id, body, outcome, created_at",
  guesses: "prediction_id, user_id, says",
  checkins: "user_id, spot, checked_in_at",
  packed: "user_id, item_id",
  ideas: "id, user_id, body, created_at",
  idea_votes: "idea_id, user_id",
  songs: "id, user_id, title, created_at",
} as const;

/** The day as the caller sees it, or `Refused` if they are not in it. */
export async function loadDay(
  db: Db,
  id: string,
  me: string,
): Promise<SharedView> {
  const [adventure, members, day, people, ...rest] = await Promise.all([
    db
      .from("passport_adventures")
      .select("id, kind, title, starts_on, created_at")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("passport_adventure_members")
      .select("user_id, member_id, role, display_name, joined_at")
      .eq("adventure_id", id),
    db
      .from("passport_snow_days")
      .select("meet_time, challenges_on")
      .eq("adventure_id", id)
      .maybeSingle(),
    db
      .from("passport_snow_people")
      .select("user_id, discipline, ability, own_gear, note")
      .eq("adventure_id", id),
    ...Object.entries(TABLES).map(([table, columns]) =>
      db.from(`passport_snow_${table}`).select(columns).eq("adventure_id", id),
    ),
  ]);
  for (const r of [adventure, members, day, people, ...rest]) check(r.error);

  const row = adventure.data as { kind: string } | null;
  // Not yours, not there, or not a snow day: the same answer.
  if (!row || row.kind !== SNOW_KIND) throw new Refused();
  const memberRows = (members.data ?? []) as unknown as MemberRow[];
  const mine = memberRows.find((m) => m.user_id === me);
  if (!mine) throw new Refused();

  const names = Object.keys(TABLES);
  const rows = {
    adventure: adventure.data,
    members: memberRows,
    day: day.data,
    people: people.data ?? [],
    ...Object.fromEntries(names.map((n, i) => [n, rest[i].data ?? []])),
  } as unknown as SharedRows;

  return {
    day: assemble(rows),
    me: mine.member_id,
    isOwner: mine.role === "owner",
  };
}

/** One picture, as a data URL — members only, because Postgres asks as them. */
export async function photoOf(
  db: Db,
  id: string,
  photoId: string,
): Promise<string> {
  const { data, error } = await db
    .from("passport_snow_moments")
    .select("photo")
    .eq("adventure_id", id)
    .eq("id", photoId)
    .eq("kind", "photo")
    .maybeSingle();
  check(error);
  const photo = (data as { photo: string | null } | null)?.photo;
  if (!photo) throw new Refused();
  return photo;
}

// ------------------------------------------------------------------ write

/**
 * Make a change as the caller. The same `applyAction` the screen ran decides
 * whether it makes sense; `plan` decides whether this person may; Postgres
 * has the last word on both.
 */
export async function act(
  db: Db,
  id: string,
  me: string,
  action: Action,
  now = new Date().toISOString(),
): Promise<Outcome> {
  const before = await loadDay(db, id, me);
  const decided = plan(
    before.day,
    action,
    { me: before.me, isOwner: before.isOwner },
    now,
  );
  if (!decided.ok) return { ok: false, reason: decided.reason };

  try {
    // Locking a choice, moving the date and telling the crew go together.
    const together = decided.ops.filter(settles);
    if (together.length > 0) await settle(db, id, together);
    for (const op of decided.ops)
      if (!settles(op)) await write(db, id, me, before, op);
  } catch (error) {
    if (error instanceof Declined) return { ok: false, reason: error.message };
    if (error instanceof Refused)
      return { ok: false, reason: "You can't change that in this snow day." };
    throw error;
  }
  const left = decided.ops.some(
    (op) => op.k === "leave" && op.personId === before.me,
  );
  if (left) return { ok: true, view: null };
  return { ok: true, view: await loadDay(db, id, me) };
}

/** The host's plan changes that must land together or not at all. */
function settles(op: Op): boolean {
  return (
    op.k === "decide" ||
    op.k === "when" ||
    (op.k === "post" && op.kind === "change")
  );
}

/** One transaction: `passport_snow_decide` (supabase/migrations/20261103000000_passport_snow.sql). */
async function settle(db: Db, id: string, ops: readonly Op[]) {
  let topic: string | null = null;
  let proposal: string | null = null;
  let setWhen = false;
  let startsOn: string | null = null;
  let meetTime: string | null = null;
  let notice: string | null = null;
  for (const op of ops) {
    if (op.k === "decide") {
      topic = op.topic;
      proposal = op.proposalId;
    } else if (op.k === "when") {
      setWhen = true;
      startsOn = op.date;
      meetTime = op.meetTime;
    } else if (op.k === "post") notice = op.text;
  }
  check(
    (
      await db.rpc("passport_snow_decide", {
        p_adventure: id,
        p_topic: topic,
        p_proposal: proposal,
        p_set_when: setWhen,
        p_starts_on: startsOn,
        p_meet_time: meetTime,
        p_notice: notice,
      })
    ).error,
  );
}

async function write(
  db: Db,
  id: string,
  me: string,
  before: SharedView,
  op: Op,
) {
  const mine = { adventure_id: id, user_id: me };
  switch (op.k) {
    case "title":
      return changed(
        await db
          .from("passport_adventures")
          .update({ title: op.title })
          .eq("id", id)
          .select("id"),
      );
    case "when":
      return settle(db, id, [op]);
    case "challengesOn":
      return put(
        db,
        "passport_snow_days",
        { adventure_id: id },
        { challenges_on: op.on },
      );
    case "profile": {
      const self = before.day.people.find((p) => p.id === before.me)!;
      const merged = { ...self, ...op.patch };
      if (op.patch.name !== undefined)
        await updateMe(db, id, me, { displayName: op.patch.name });
      return saveProfile(db, id, me, merged);
    }
    case "leave":
      return removeMember(db, id, op.personId);
    case "propose":
      return check(
        (
          await db.from("passport_snow_proposals").insert({
            adventure_id: id,
            topic: op.proposal.topic,
            label: op.proposal.label,
            detail: op.proposal.detail ?? null,
            source: op.proposal.source ?? null,
          })
        ).error,
      );
    case "unpropose":
      return check(
        (
          await db
            .from("passport_snow_proposals")
            .delete()
            .eq("adventure_id", id)
            .eq("id", op.id)
        ).error,
      );
    case "vote":
      if (op.proposalId !== null)
        return put(
          db,
          "passport_snow_votes",
          { ...mine, topic: op.topic },
          { proposal_id: op.proposalId, voted_at: new Date().toISOString() },
        );
      return check(
        (
          await db
            .from("passport_snow_votes")
            .delete()
            .eq("adventure_id", id)
            .eq("user_id", me)
            .eq("topic", op.topic)
        ).error,
      );
    case "decide":
      return settle(db, id, [op]);
    case "post":
      return check(
        (
          await db
            .from("passport_snow_posts")
            .insert({ adventure_id: id, kind: op.kind, body: op.text })
        ).error,
      );
    case "unpost":
      return check(
        (
          await db
            .from("passport_snow_posts")
            .delete()
            .eq("adventure_id", id)
            .eq("id", op.id)
        ).error,
      );
    case "challenge":
      return check(
        (
          await db
            .from("passport_snow_challenges")
            .insert({ adventure_id: id, title: op.title })
        ).error,
      );
    case "complete":
      return check(
        (op.on
          ? await db.from("passport_snow_completions").upsert(
              { ...mine, challenge_id: op.challengeId },
              {
                onConflict: "adventure_id,user_id,challenge_id",
                ignoreDuplicates: true,
              },
            )
          : await db
              .from("passport_snow_completions")
              .delete()
              .eq("adventure_id", id)
              .eq("user_id", me)
              .eq("challenge_id", op.challengeId)
        ).error,
      );
    case "photo":
      return check(
        (
          await db.from("passport_snow_moments").insert({
            adventure_id: id,
            kind: "photo",
            body: op.caption,
            photo: op.src,
          })
        ).error,
      );
    case "moment":
      return check(
        (
          await db
            .from("passport_snow_moments")
            .insert({ adventure_id: id, kind: "moment", body: op.text })
        ).error,
      );
    case "unmoment":
      return check(
        (
          await db
            .from("passport_snow_moments")
            .delete()
            .eq("adventure_id", id)
            .eq("id", op.id)
        ).error,
      );
    case "checkin":
      if (op.spot !== null)
        return put(
          db,
          "passport_snow_checkins",
          { ...mine },
          { spot: op.spot, checked_in_at: new Date().toISOString() },
        );
      return check(
        (
          await db
            .from("passport_snow_checkins")
            .delete()
            .eq("adventure_id", id)
            .eq("user_id", me)
        ).error,
      );
    case "pack":
      return check(
        (op.on
          ? await db.from("passport_snow_packed").upsert(
              { ...mine, item_id: op.itemId },
              {
                onConflict: "adventure_id,user_id,item_id",
                ignoreDuplicates: true,
              },
            )
          : await db
              .from("passport_snow_packed")
              .delete()
              .eq("adventure_id", id)
              .eq("user_id", me)
              .eq("item_id", op.itemId)
        ).error,
      );
    case "song":
      return check(
        (
          await db
            .from("passport_snow_songs")
            .insert({ adventure_id: id, title: op.title })
        ).error,
      );
    case "unsong":
      return check(
        (
          await db
            .from("passport_snow_songs")
            .delete()
            .eq("adventure_id", id)
            .eq("id", op.id)
        ).error,
      );
    case "idea":
      return check(
        (
          await db
            .from("passport_snow_ideas")
            .insert({ adventure_id: id, body: op.text })
        ).error,
      );
    case "ideaVote":
      return check(
        (op.on
          ? await db
              .from("passport_snow_idea_votes")
              .upsert(
                { ...mine, idea_id: op.id },
                { onConflict: "idea_id,user_id", ignoreDuplicates: true },
              )
          : await db
              .from("passport_snow_idea_votes")
              .delete()
              .eq("idea_id", op.id)
              .eq("user_id", me)
        ).error,
      );
    case "predict":
      return check(
        (
          await db
            .from("passport_snow_predictions")
            .insert({ adventure_id: id, body: op.text })
        ).error,
      );
    case "unpredict":
      return check(
        (
          await db
            .from("passport_snow_predictions")
            .delete()
            .eq("adventure_id", id)
            .eq("id", op.id)
        ).error,
      );
    case "guess":
      if (op.says !== null)
        return put(
          db,
          "passport_snow_guesses",
          { prediction_id: op.id, user_id: me },
          { says: op.says },
          { adventure_id: id },
        );
      return check(
        (
          await db
            .from("passport_snow_guesses")
            .delete()
            .eq("prediction_id", op.id)
            .eq("user_id", me)
        ).error,
      );
    case "settle":
      return changed(
        await db
          .from("passport_snow_predictions")
          .update({ outcome: op.outcome })
          .eq("adventure_id", id)
          .eq("id", op.id)
          .select("id"),
      );
  }
}

// ------------------------------------------------------------ invitations

/** A link into the day. Owner only (Postgres). The token is shown once. */
export async function inviteLink(
  db: Db,
  id: string,
  me: string,
): Promise<string> {
  const { token } = await createInvite(db, id, me, {
    label: null,
    maxUses: 24,
    expiresInDays: 14,
  });
  return token;
}

/**
 * Join from a link as yourself. A second tap on the same link changes
 * nothing. Returns the day joined, or `null` for a dead link.
 */
export async function joinDay(
  db: Db,
  me: string,
  token: string,
  rider: Omit<HostInput, "title">,
): Promise<string | null> {
  // A link into a Hockey Night is not a way into a snow day, or the reverse.
  const described = await describeInvite(db, token);
  if (!described || described.kind !== SNOW_KIND) return null;
  const id = await redeemInvite(db, token, {
    displayName: rider.name,
    visibility: "members",
  });
  if (!id) return null;
  await saveProfile(db, id, me, rider, true);
  return id;
}
