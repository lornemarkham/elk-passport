import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adventureKind, type AdventureVisibility } from "./kinds";
import { dayWrites } from "./days";
import type {
  AdventureDetails,
  HockeyFacts,
  InviteRequest,
  ItemInput,
  ItemPatch,
  ItemStatus,
  NewAdventure,
  ResponseValue,
} from "./rules";

/**
 * **Group adventures: the one application API every kind uses.**
 *
 * Hockey Night, a conference, a day out, a birthday — each is an adventure
 * with a `kind`, and each gets membership, invitations, removal, a shared
 * plan and answers from here. None of it knows what a kind means.
 *
 * ## Postgres decides, this asks
 *
 * Every function takes the caller's own Supabase client (anon key + their
 * session) and nothing else that confers authority. Row-level security in
 * `supabase/migrations/20261021000000_passport_adventures.sql` decides what they may read
 * and change; this module only shapes requests and answers. So a bug here
 * cannot hand one group's plans to another, and a native or voice client
 * holding the same JWT gets the same rows without this code.
 *
 * Postgres refuses a write it does not allow *silently* — zero rows, no
 * error. Every write here therefore asks for the rows it changed, and none
 * is `Refused`, never success.
 *
 * ## Nobody's user id reaches a browser
 *
 * People are addressed by `member_id`, a random id per adventure. `me` is
 * passed in by the server from the verified session and used only to say
 * "this one is you".
 */

type Db = SupabaseClient;

export type AdventureRole = "owner" | "participant";

/** Not yours to see or do — or it does not exist. Deliberately the same. */
export class Refused extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "Refused";
  }
}

/** Passport could not ask (table missing, network). Never "nobody". */
export class Unavailable extends Error {
  constructor(cause: string) {
    super(`Adventures are unavailable: ${cause}`);
    this.name = "Unavailable";
  }
}

/** PostgREST / Postgres codes that mean "you may not", not "it broke". */
const REFUSAL_CODES = new Set(["42501", "PGRST116", "23503", "28000"]);

function raise(error: { code?: string; message: string }): never {
  if (error.code && REFUSAL_CODES.has(error.code)) throw new Refused();
  throw new Unavailable(error.message);
}

// ------------------------------------------------------------------ views

export interface AdventureSummary {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly role: AdventureRole;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly destinationLabel: string | null;
}

export interface MemberView {
  readonly memberId: string;
  readonly role: AdventureRole;
  readonly displayName: string;
  readonly visibility: AdventureVisibility;
  readonly isYou: boolean;
}

export interface ItemView {
  readonly id: string;
  readonly atlasRef: string | null;
  readonly label: string | null;
  readonly note: string | null;
  readonly status: ItemStatus;
  readonly onDay: string | null;
  readonly startsAt: string | null;
  readonly position: number;
  /** Who proposed it, if they are still here and you can see them. */
  readonly addedBy: string | null;
  readonly mine: boolean;
  /** Whether you may change or withdraw it (mirrors the RLS policy). */
  readonly canChange: boolean;
  readonly responses: Readonly<Record<ResponseValue, number>>;
  readonly yourResponse: ResponseValue | null;
}

export interface AdventureView extends AdventureDetails {
  readonly id: string;
  readonly kind: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly role: AdventureRole;
  readonly you: MemberView;
  /** Everyone you may see. Owners see everyone; others see who chose to be seen. */
  readonly members: readonly MemberView[];
  readonly items: readonly ItemView[];
  /** The hockey extension, for a kind that has one. */
  readonly hockey: HockeyFacts | null;
  /** Days somebody planned with Go Have a Day, and how each was asked for. */
  readonly days: readonly DayView[];
}

export interface DayView {
  readonly onDay: string;
  /** The `/go` day query without its stops (`days.ts`, `askFrom`). */
  readonly ask: string;
  readonly updatedAt: string;
}

export interface InviteView {
  readonly id: string;
  readonly label: string | null;
  readonly maxUses: number | null;
  readonly uses: number;
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

export type InviteState = "valid" | "revoked" | "expired" | "used-up";

// ------------------------------------------------------------------- rows

interface AdventureRow {
  id: string;
  kind: string;
  title: string;
  owner_id: string;
  starts_on: string | null;
  ends_on: string | null;
  time_zone: string | null;
  destination_label: string | null;
  destination_town_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  user_id: string;
  member_id: string;
  role: AdventureRole;
  display_name: string | null;
  visibility: AdventureVisibility;
}

interface ItemRow {
  id: string;
  atlas_ref: string | null;
  label: string | null;
  note: string | null;
  status: ItemStatus;
  on_day: string | null;
  starts_at: string | null;
  position: number;
  added_by: string | null;
}

interface ResponseRow {
  item_id: string;
  user_id: string;
  response: ResponseValue;
}

interface HockeyRow {
  puck_drop: string | null;
  home_team: string | null;
  away_team: string | null;
  arena_atlas_ref: string | null;
  arena_label: string | null;
}

const ADVENTURE_COLUMNS =
  "id, kind, title, owner_id, starts_on, ends_on, time_zone, destination_label, destination_town_id, created_at, updated_at";

function detailsRow(details: Partial<AdventureDetails>) {
  const row: Record<string, unknown> = {};
  if (details.title !== undefined) row.title = details.title;
  if (details.startsOn !== undefined) row.starts_on = details.startsOn;
  if (details.endsOn !== undefined) row.ends_on = details.endsOn;
  if (details.timeZone !== undefined) row.time_zone = details.timeZone;
  if (details.destinationLabel !== undefined)
    row.destination_label = details.destinationLabel;
  if (details.destinationTownId !== undefined)
    row.destination_town_id = details.destinationTownId;
  return row;
}

function hockeyRow(facts: HockeyFacts) {
  return {
    puck_drop: facts.puckDrop,
    home_team: facts.homeTeam,
    away_team: facts.awayTeam,
    arena_atlas_ref: facts.arenaAtlasRef,
    arena_label: facts.arenaLabel,
  };
}

const NAMELESS = "A traveller";

function memberView(row: MemberRow, me: string): MemberView {
  return {
    memberId: row.member_id,
    role: row.role,
    displayName: row.display_name?.trim() || NAMELESS,
    visibility: row.visibility,
    isYou: row.user_id === me,
  };
}

// ------------------------------------------------------------- adventures

/** Start one. The caller becomes its owner, inside one database function. */
export async function createAdventure(
  db: Db,
  input: NewAdventure & {
    readonly displayName?: string | null;
    readonly hockey?: HockeyFacts | null;
  },
): Promise<string> {
  const { data, error } = await db.rpc("passport_create_adventure", {
    p_kind: input.kind,
    p_title: input.title,
    p_display_name: input.displayName ?? null,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_time_zone: input.timeZone,
    p_destination_label: input.destinationLabel,
    p_destination_town_id: input.destinationTownId,
  });
  if (error) raise(error);
  if (typeof data !== "string") throw new Unavailable("no id came back");

  if (input.hockey && adventureKind(input.kind)?.extension === "hockey") {
    await setHockeyFacts(db, data, input.hockey);
  }
  return data;
}

/** Every adventure this person is in — made by them or joined — newest first. */
export async function adventuresOf(
  db: Db,
  me: string,
): Promise<AdventureSummary[]> {
  const { data, error } = await db
    .from("passport_adventure_members")
    .select(
      "role, adventure:passport_adventures(id, kind, title, starts_on, ends_on, destination_label, updated_at)",
    )
    .eq("user_id", me);
  if (error) raise(error);

  type Row = {
    role: AdventureRole;
    adventure: Pick<
      AdventureRow,
      | "id"
      | "kind"
      | "title"
      | "starts_on"
      | "ends_on"
      | "destination_label"
      | "updated_at"
    > | null;
  };
  return ((data as unknown as Row[] | null) ?? [])
    .filter((r): r is Row & { adventure: NonNullable<Row["adventure"]> } =>
      Boolean(r.adventure),
    )
    .sort((a, b) =>
      b.adventure.updated_at.localeCompare(a.adventure.updated_at),
    )
    .map((r) => ({
      id: r.adventure.id,
      kind: r.adventure.kind,
      title: r.adventure.title,
      role: r.role,
      startsOn: r.adventure.starts_on,
      endsOn: r.adventure.ends_on,
      destinationLabel: r.adventure.destination_label,
    }));
}

/**
 * One adventure as this person may see it, or `null`.
 *
 * `null` covers "no such adventure" and "not yours" identically, so changing
 * an id in a URL tells the changer nothing.
 */
export async function adventureFor(
  db: Db,
  id: string,
  me: string,
): Promise<AdventureView | null> {
  const adventure = await db
    .from("passport_adventures")
    .select(ADVENTURE_COLUMNS)
    .eq("id", id)
    .maybeSingle<AdventureRow>();
  if (adventure.error) raise(adventure.error);
  if (!adventure.data) return null;
  const a = adventure.data;

  const wantsHockey = adventureKind(a.kind)?.extension === "hockey";
  const [members, items, responses, hockey, days] = await Promise.all([
    db
      .from("passport_adventure_members")
      .select("user_id, member_id, role, display_name, visibility")
      .eq("adventure_id", id),
    db
      .from("passport_adventure_items")
      .select(
        "id, atlas_ref, label, note, status, on_day, starts_at, position, added_by",
      )
      .eq("adventure_id", id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("passport_adventure_responses")
      .select("item_id, user_id, response")
      .eq("adventure_id", id),
    wantsHockey
      ? db
          .from("passport_adventure_hockey")
          .select(
            "puck_drop, home_team, away_team, arena_atlas_ref, arena_label",
          )
          .eq("adventure_id", id)
          .maybeSingle<HockeyRow>()
      : Promise.resolve({ data: null, error: null }),
    db
      .from("passport_adventure_days")
      .select("on_day, ask, updated_at")
      .eq("adventure_id", id)
      .order("on_day", { ascending: true }),
  ]);
  for (const r of [members, items, responses, hockey, days]) {
    if (r.error) raise(r.error);
  }

  const memberRows = (members.data as MemberRow[] | null) ?? [];
  const mine = memberRows.find((m) => m.user_id === me);
  // Readable but not a member cannot happen under the policies; if it ever
  // does, it is treated as not yours rather than rendered half-known.
  if (!mine) return null;

  const role = mine.role;
  const memberIdOf = new Map(memberRows.map((m) => [m.user_id, m.member_id]));

  const counts = new Map<string, Record<ResponseValue, number>>();
  const yours = new Map<string, ResponseValue>();
  for (const r of (responses.data as ResponseRow[] | null) ?? []) {
    const c = counts.get(r.item_id) ?? { in: 0, maybe: 0, out: 0 };
    c[r.response] += 1;
    counts.set(r.item_id, c);
    if (r.user_id === me) yours.set(r.item_id, r.response);
  }

  const h = hockey.data as HockeyRow | null;

  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    startsOn: a.starts_on,
    endsOn: a.ends_on,
    timeZone: a.time_zone,
    destinationLabel: a.destination_label,
    destinationTownId: a.destination_town_id,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    role,
    you: memberView(mine, me),
    members: memberRows
      .map((m) => memberView(m, me))
      .sort((x, y) => (x.role === y.role ? 0 : x.role === "owner" ? -1 : 1)),
    items: ((items.data as ItemRow[] | null) ?? []).map((item) => {
      const isMine = item.added_by === me;
      return {
        id: item.id,
        atlasRef: item.atlas_ref,
        label: item.label,
        note: item.note,
        status: item.status,
        onDay: item.on_day,
        startsAt: item.starts_at,
        position: item.position,
        addedBy: item.added_by ? (memberIdOf.get(item.added_by) ?? null) : null,
        mine: isMine,
        canChange: role === "owner" || (isMine && item.status === "proposed"),
        responses: counts.get(item.id) ?? { in: 0, maybe: 0, out: 0 },
        yourResponse: yours.get(item.id) ?? null,
      };
    }),
    hockey: wantsHockey
      ? {
          puckDrop: h?.puck_drop ?? null,
          homeTeam: h?.home_team ?? null,
          awayTeam: h?.away_team ?? null,
          arenaAtlasRef: h?.arena_atlas_ref ?? null,
          arenaLabel: h?.arena_label ?? null,
        }
      : null,
    days: (
      (days.data as
        { on_day: string; ask: string; updated_at: string }[] | null) ?? []
    ).map((d) => ({ onDay: d.on_day, ask: d.ask, updatedAt: d.updated_at })),
  };
}

/** Owner only (RLS). The kind and the owner can never be changed. */
export async function updateAdventure(
  db: Db,
  id: string,
  patch: Partial<AdventureDetails>,
): Promise<void> {
  const { data, error } = await db
    .from("passport_adventures")
    .update(detailsRow(patch))
    .eq("id", id)
    .select("id");
  if (error) raise(error);
  if (!data || data.length === 0) throw new Refused();
}

/** Owner only (RLS). Members, invites, plans and answers go with it. */
export async function deleteAdventure(db: Db, id: string): Promise<void> {
  const { data, error } = await db
    .from("passport_adventures")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) raise(error);
  if (!data || data.length === 0) throw new Refused();
}

/** Owner only (RLS), and only on an adventure whose kind has this extension. */
export async function setHockeyFacts(
  db: Db,
  id: string,
  facts: HockeyFacts,
): Promise<void> {
  const { data, error } = await db
    .from("passport_adventure_hockey")
    .upsert({ adventure_id: id, ...hockeyRow(facts) })
    .select("adventure_id");
  if (error) raise(error);
  if (!data || data.length === 0) throw new Refused();
}

// ---------------------------------------------------------------- invites

export function newInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database stores instead of the token. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * A link into one adventure. Owner only (RLS). The token is returned here,
 * once, and only its hash is stored — so it cannot be read back later, by
 * anyone, including the owner.
 */
export async function createInvite(
  db: Db,
  id: string,
  me: string,
  request: InviteRequest,
): Promise<{ readonly token: string; readonly invite: InviteView }> {
  const token = newInviteToken();
  const expiresAt =
    request.expiresInDays == null
      ? null
      : new Date(
          Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000,
        ).toISOString();

  const { data, error } = await db
    .from("passport_adventure_invites")
    .insert({
      adventure_id: id,
      token_hash: hashInviteToken(token),
      label: request.label,
      max_uses: request.maxUses,
      expires_at: expiresAt,
      created_by: me,
    })
    .select("id, label, max_uses, uses, expires_at, created_at")
    .single();
  if (error) raise(error);

  return { token, invite: inviteView(data as InviteRow) };
}

interface InviteRow {
  id: string;
  label: string | null;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  created_at: string;
}

function inviteView(row: InviteRow): InviteView {
  return {
    id: row.id,
    label: row.label,
    maxUses: row.max_uses,
    uses: row.uses,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/** Links still standing. Owner only (RLS); anyone else gets an empty list. */
export async function invitesOf(db: Db, id: string): Promise<InviteView[]> {
  const { data, error } = await db
    .from("passport_adventure_invites")
    .select("id, label, max_uses, uses, expires_at, created_at")
    .eq("adventure_id", id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) raise(error);
  return ((data as InviteRow[] | null) ?? []).map(inviteView);
}

/** Stop a link working. People already in through it stay. */
export async function revokeInvite(
  db: Db,
  id: string,
  inviteId: string,
): Promise<void> {
  const { data, error } = await db
    .from("passport_adventure_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("adventure_id", id)
    .eq("id", inviteId)
    .select("id");
  if (error) raise(error);
  if (!data || data.length === 0) throw new Refused();
}

/**
 * What a link says to whoever holds it, signed in or not: whether it works,
 * and what kind of thing it is for. Never the title, the owner or who's in.
 */
export async function describeInvite(
  db: Db,
  token: string,
): Promise<{ readonly state: InviteState; readonly kind: string } | null> {
  const { data, error } = await db.rpc("passport_describe_adventure_invite", {
    p_token: token,
  });
  if (error) raise(error);
  const row = Array.isArray(data) ? data[0] : null;
  return row ? { state: row.state, kind: row.kind } : null;
}

/**
 * Accept a link. Returns the adventure joined, or `null` for a dead link —
 * used up, revoked, expired, or made before the owner removed you.
 * Following a link into something you are already in changes nothing.
 */
export async function redeemInvite(
  db: Db,
  token: string,
  joining: {
    readonly displayName: string | null;
    readonly visibility: AdventureVisibility;
  },
): Promise<string | null> {
  const { data, error } = await db.rpc("passport_redeem_adventure_invite", {
    p_token: token,
    p_display_name: joining.displayName,
    p_visibility: joining.visibility,
  });
  if (error) raise(error);
  return typeof data === "string" ? data : null;
}

// ---------------------------------------------------------------- members

/**
 * Take somebody off. The owner removes participants; anyone but the owner
 * may remove themselves (leave). Postgres enforces both; nobody removes the
 * owner. A removed person cannot come back through a link made before.
 */
export async function removeMember(
  db: Db,
  id: string,
  memberId: string,
): Promise<void> {
  const { data, error } = await db
    .from("passport_adventure_members")
    .delete()
    .eq("adventure_id", id)
    .eq("member_id", memberId)
    .select("member_id");
  if (error) raise(error);
  if (!data || data.length === 0) throw new Refused();
}

/** How you appear: your name here, and whether other members see you. */
export async function updateMe(
  db: Db,
  id: string,
  me: string,
  change: {
    readonly displayName?: string | null;
    readonly visibility?: AdventureVisibility;
  },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (change.displayName !== undefined) row.display_name = change.displayName;
  if (change.visibility !== undefined) row.visibility = change.visibility;
  const { data, error } = await db
    .from("passport_adventure_members")
    .update(row)
    .eq("adventure_id", id)
    .eq("user_id", me)
    .select("member_id");
  if (error) raise(error);
  if (!data || data.length === 0) throw new Refused();
}

// ------------------------------------------------------------------ items

function itemRow(input: ItemPatch) {
  const row: Record<string, unknown> = {};
  if (input.position !== undefined) row.position = input.position;
  if (input.atlasRef !== undefined) row.atlas_ref = input.atlasRef;
  if (input.label !== undefined) row.label = input.label;
  if (input.note !== undefined) row.note = input.note;
  if (input.status !== undefined) row.status = input.status;
  if (input.onDay !== undefined) row.on_day = input.onDay;
  if (input.startsAt !== undefined) row.starts_at = input.startsAt;
  return row;
}

/**
 * Put something on the shared plan. Any member may propose; only the owner
 * may add something already confirmed (RLS). Returns the new item's id.
 */
export async function addItem(
  db: Db,
  id: string,
  me: string,
  input: ItemInput,
): Promise<string> {
  const last = await db
    .from("passport_adventure_items")
    .select("position")
    .eq("adventure_id", id)
    .order("position", { ascending: false })
    .limit(1);
  if (last.error) raise(last.error);
  const position =
    (((last.data as { position: number }[] | null) ?? [])[0]?.position ?? -1) +
    1;

  const { data, error } = await db
    .from("passport_adventure_items")
    .insert({ adventure_id: id, added_by: me, position, ...itemRow(input) })
    .select("id")
    .single();
  if (error) raise(error);
  return (data as { id: string }).id;
}

/** The owner changes anything; a proposer changes their own proposal. */
export async function updateItem(
  db: Db,
  id: string,
  itemId: string,
  patch: ItemPatch,
): Promise<void> {
  const { data, error } = await db
    .from("passport_adventure_items")
    .update(itemRow(patch))
    .eq("adventure_id", id)
    .eq("id", itemId)
    .select("id");
  if (error) raise(error);
  if (!data || data.length === 0) throw new Refused();
}

export async function removeItem(
  db: Db,
  id: string,
  itemId: string,
): Promise<void> {
  const { data, error } = await db
    .from("passport_adventure_items")
    .delete()
    .eq("adventure_id", id)
    .eq("id", itemId)
    .select("id");
  if (error) raise(error);
  if (!data || data.length === 0) throw new Refused();
}

/**
 * Your answer on one item: in, maybe, out — or `null` to take it back.
 *
 * Update first, insert if there was nothing to update: an upsert would ask
 * Postgres to rewrite the key columns too, and members may only change the
 * answer itself.
 */
export async function respond(
  db: Db,
  id: string,
  itemId: string,
  me: string,
  response: ResponseValue | null,
): Promise<void> {
  if (response === null) {
    const { error } = await db
      .from("passport_adventure_responses")
      .delete()
      .eq("adventure_id", id)
      .eq("item_id", itemId)
      .eq("user_id", me);
    if (error) raise(error);
    return;
  }

  const answeredAt = new Date().toISOString();
  const updated = await db
    .from("passport_adventure_responses")
    .update({ response, answered_at: answeredAt })
    .eq("adventure_id", id)
    .eq("item_id", itemId)
    .eq("user_id", me)
    .select("item_id");
  if (updated.error) raise(updated.error);
  if (updated.data && updated.data.length > 0) return;

  const { error } = await db.from("passport_adventure_responses").insert({
    item_id: itemId,
    adventure_id: id,
    user_id: me,
    response,
    answered_at: answeredAt,
  });
  if (error) raise(error);
}

// ------------------------------------------------------------------- days

async function nextPosition(db: Db, id: string): Promise<number> {
  const last = await db
    .from("passport_adventure_items")
    .select("position")
    .eq("adventure_id", id)
    .order("position", { ascending: false })
    .limit(1);
  if (last.error) raise(last.error);
  return (
    (((last.data as { position: number }[] | null) ?? [])[0]?.position ?? -1) +
    1
  );
}

/**
 * Saved things become ideas on the adventure: Atlas ids not on a day yet.
 * Ones the adventure already holds are skipped, so adding twice is harmless.
 * An idea is a proposal, whoever adds it; it is confirmed when the owner
 * puts it on a day (`saveDay`). Returns how many were new.
 */
export async function addIdeas(
  db: Db,
  id: string,
  me: string,
  atlasRefs: readonly string[],
): Promise<number> {
  const held = await db
    .from("passport_adventure_items")
    .select("atlas_ref")
    .eq("adventure_id", id)
    .in("atlas_ref", [...atlasRefs]);
  if (held.error) raise(held.error);
  const have = new Set(
    ((held.data as { atlas_ref: string }[] | null) ?? []).map(
      (r) => r.atlas_ref,
    ),
  );
  const fresh = atlasRefs.filter((ref) => !have.has(ref));
  if (fresh.length === 0) return 0;
  const start = await nextPosition(db, id);
  const { error } = await db.from("passport_adventure_items").insert(
    fresh.map((atlasRef, i) => ({
      adventure_id: id,
      added_by: me,
      atlas_ref: atlasRef,
      status: "proposed",
      position: start + i,
    })),
  );
  if (error) raise(error);
  return fresh.length;
}

/**
 * **Save a day Go Have a Day built** onto the adventure. Owner only: it sets
 * every stop's day and order, and keeps how the day was asked for so it can
 * be reopened and refined (`passport_adventure_days`).
 *
 * Several requests, not one transaction: a failure part-way leaves some
 * stops placed, and saving again finishes the job (every step is
 * idempotent). Nothing is ever deleted — a stop the new day left out goes
 * back to the ideas (`dayWrites`).
 */
export async function saveDay(
  db: Db,
  id: string,
  me: string,
  input: {
    readonly onDay: string;
    readonly ask: string;
    readonly stops: readonly string[];
  },
): Promise<void> {
  const current = await db
    .from("passport_adventure_items")
    .select("id, atlas_ref, on_day, position")
    .eq("adventure_id", id);
  if (current.error) raise(current.error);
  const items = (
    (current.data as
      | {
          id: string;
          atlas_ref: string | null;
          on_day: string | null;
          position: number;
        }[]
      | null) ?? []
  ).map((r) => ({
    id: r.id,
    atlasRef: r.atlas_ref,
    onDay: r.on_day,
    position: r.position,
  }));
  const writes = dayWrites(items, input.onDay, input.stops);

  // The day row first: it is the owner check. A participant is refused here,
  // before any item moves.
  const updated = await db
    .from("passport_adventure_days")
    .update({ ask: input.ask, updated_by: me })
    .eq("adventure_id", id)
    .eq("on_day", input.onDay)
    .select("on_day");
  if (updated.error) raise(updated.error);
  if (!updated.data || updated.data.length === 0) {
    const { error } = await db.from("passport_adventure_days").insert({
      adventure_id: id,
      on_day: input.onDay,
      ask: input.ask,
      updated_by: me,
    });
    if (error) raise(error);
  }

  for (const itemId of writes.release) {
    await updateItem(db, id, itemId, { onDay: null });
  }
  for (const { id: itemId, position } of writes.place) {
    await updateItem(db, id, itemId, {
      onDay: input.onDay,
      position,
      status: "confirmed",
    });
  }
  if (writes.add.length > 0) {
    const { error } = await db.from("passport_adventure_items").insert(
      writes.add.map(({ atlasRef, position }) => ({
        adventure_id: id,
        added_by: me,
        atlas_ref: atlasRef,
        status: "confirmed",
        on_day: input.onDay,
        position,
      })),
    );
    if (error) raise(error);
  }
}

/** The caller's role in an adventure, or `null` when it is not theirs. */
export async function roleIn(
  db: Db,
  id: string,
): Promise<AdventureRole | null> {
  const { data, error } = await db.rpc("passport_adventure_role", {
    p_adventure: id,
  });
  if (error) raise(error);
  return data === "owner" || data === "participant" ? data : null;
}
