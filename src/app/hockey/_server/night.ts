import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { liveExperience } from "@/experience-lab/core/engine";
import { TOYS } from "@/experience-lab/core/toybox";
import type {
  ExperienceDefinition,
  ExperienceState,
} from "@/experience-lab/core/types";
import type { PassportUser } from "@/lib/auth/currentUser";
import { discoveryCandidates } from "@/lib/data/atlas-repo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  nearbyFood,
  walkLabel,
  type NearbyPlace,
} from "@/domain/hockey/nearby";
import { answerProblem, type Action } from "@/domain/hockey/actions";
import { cleanName, defaultLook } from "@/domain/hockey/identity";
import {
  SYCLE_HOCKEY_NIGHT,
  composeNight,
  rulesFor,
  templateRules,
  type MemberRow,
  type NightRows,
} from "@/domain/hockey/night";

/**
 * **The night, as the person asking is allowed to see it.**
 *
 * Every query here runs as the signed-in person, through the anon key and
 * their own session (`createSupabaseServerClient`) — never the service role.
 * So the database's policies are not a backstop behind this file; they are
 * what this file *sees*. A sealed pick it cannot read is a pick it cannot leak,
 * and a non-member gets the same thing as a night that does not exist: `null`.
 */

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface NightSnapshot {
  readonly definition: ExperienceDefinition;
  readonly state: ExperienceState;
  readonly role: "host" | "guest";
}

export class NightError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rowsFor(db: Db, id: string): Promise<NightRows | null> {
  if (!UUID.test(id)) return null;
  const { data: occasion, error } = await db
    .from("passport_occasions")
    .select("id, template, title, starts_at, host_id, details, brief")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new NightError(error.message, 500);
  if (!occasion) return null;

  const of = (table: string, columns: string) =>
    db.from(table).select(columns).eq("occasion_id", id);

  const [
    members,
    prompts,
    options,
    responses,
    moments,
    reactions,
    cues,
    consents,
  ] = await Promise.all([
    of(
      "passport_occasion_members",
      "user_id, role, display_name, emoji, hue, vibe, edge, joined_at",
    ),
    of(
      "passport_occasion_prompts",
      "prompt_id, reveal, lock_offset_minutes, audience_only, open_to_suggestions, asked_by, content, resolution",
    ),
    of(
      "passport_occasion_options",
      "id, prompt_id, label, detail, added_by",
    ).order("created_at"),
    of("passport_occasion_responses", "prompt_id, user_id, value, answered_at"),
    of("passport_occasion_moments", "id, actor_id, kind, text, emoji, at")
      .order("at", { ascending: false })
      .limit(200),
    of("passport_occasion_reactions", "moment_id, emoji, user_id"),
    of("passport_occasion_cues", "prompt_id, cued_by, cued_at"),
    of("passport_occasion_consents", "prompt_id, agreed"),
  ]);
  for (const r of [
    members,
    prompts,
    options,
    responses,
    moments,
    reactions,
    cues,
    consents,
  ]) {
    if (r.error) throw new NightError(r.error.message, 500);
  }

  return {
    occasion: occasion as unknown as NightRows["occasion"],
    members: members.data as unknown as NightRows["members"],
    prompts: prompts.data as unknown as NightRows["prompts"],
    options: options.data as unknown as NightRows["options"],
    responses: responses.data as unknown as NightRows["responses"],
    moments: moments.data as unknown as NightRows["moments"],
    reactions: reactions.data as unknown as NightRows["reactions"],
    cues: cues.data as unknown as NightRows["cues"],
    consents: consents.data as unknown as NightRows["consents"],
  };
}

/** The night for this person, or null if it does not exist *for them*. */
export async function loadNight(
  user: PassportUser,
  id: string,
): Promise<NightSnapshot | null> {
  const db = await createSupabaseServerClient();
  const rows = await rowsFor(db, id);
  if (!rows) return null;
  const me = rows.members.find((m) => m.user_id === user.id);
  if (!me) return null;
  return { ...composeNight(rows, user.id), role: me.role };
}

export interface NightSummary {
  readonly id: string;
  readonly title: string;
  readonly startsAt: string;
  readonly role: "host" | "guest";
  readonly members: number;
}

export async function myNights(user: PassportUser): Promise<NightSummary[]> {
  const db = await createSupabaseServerClient();
  const { data: mine, error } = await db
    .from("passport_occasion_members")
    .select("occasion_id, role")
    .eq("user_id", user.id);
  if (error) throw new NightError(error.message, 500);
  if (!mine?.length) return [];
  const ids = mine.map((m) => m.occasion_id as string);
  const [{ data: occasions }, { data: everyone }] = await Promise.all([
    db
      .from("passport_occasions")
      .select("id, title, starts_at")
      .in("id", ids)
      .order("starts_at"),
    db
      .from("passport_occasion_members")
      .select("occasion_id")
      .in("occasion_id", ids),
  ]);
  return (occasions ?? []).map((o) => ({
    id: o.id as string,
    title: o.title as string,
    startsAt: o.starts_at as string,
    role: mine.find((m) => m.occasion_id === o.id)?.role as "host" | "guest",
    members: (everyone ?? []).filter((m) => m.occasion_id === o.id).length,
  }));
}

/** Start Sycle Hockey Night. The caller becomes its host. */
export async function createSycleNight(
  user: PassportUser,
  name: string | undefined,
): Promise<string> {
  const db = await createSupabaseServerClient();
  const look = defaultLook(user.id);
  const { data, error } = await db.rpc("passport_create_occasion", {
    p_template: SYCLE_HOCKEY_NIGHT.template,
    p_title: SYCLE_HOCKEY_NIGHT.title,
    p_starts_at: SYCLE_HOCKEY_NIGHT.startsAt,
    p_details: SYCLE_HOCKEY_NIGHT.details,
    p_display_name: cleanName(name, cleanName(user.displayName, "Host")),
    p_emoji: look.emoji,
    p_hue: look.hue,
    p_prompts: templateRules(),
  });
  if (error || typeof data !== "string") {
    throw new NightError(error?.message ?? "Could not start the night.", 500);
  }
  return data;
}

// ------------------------------------------------------------- actions

function fail(error: { message: string; code?: string } | null, what: string) {
  if (!error) return;
  // 42501 is RLS saying no. To the person, that is "you can't", not a crash.
  const forbidden =
    error.code === "42501" || /row-level security/i.test(error.message);
  throw new NightError(
    forbidden ? `Not allowed: ${what}.` : error.message,
    forbidden ? 403 : 500,
  );
}

export async function act(
  user: PassportUser,
  id: string,
  action: Action,
): Promise<NightSnapshot> {
  const db = await createSupabaseServerClient();
  const rows = await rowsFor(db, id);
  const me = rows?.members.find((m) => m.user_id === user.id);
  if (!rows || !me) throw new NightError("Not found.", 404);

  const { definition, state } = composeNight(rows, user.id);
  const live = liveExperience(definition, state, new Date());

  switch (action.type) {
    case "respond": {
      const prompt = live.prompts.find((p) => p.prompt.id === action.promptId);
      const problem = answerProblem(prompt, action.value, live.participants);
      if (problem) throw new NightError(problem, 422);
      const { error } = await db.from("passport_occasion_responses").upsert(
        {
          occasion_id: id,
          prompt_id: action.promptId,
          user_id: user.id,
          value: action.value,
          answered_at: new Date().toISOString(),
        },
        { onConflict: "occasion_id,prompt_id,user_id" },
      );
      fail(error, "answering that");
      break;
    }

    case "say": {
      const { error } = await db.from("passport_occasion_moments").insert({
        occasion_id: id,
        actor_id: user.id,
        kind: "note",
        text: action.text,
      });
      fail(error, "posting");
      break;
    }

    case "react": {
      const mine = rows.reactions.some(
        (r) =>
          r.moment_id === action.momentId &&
          r.emoji === action.emoji &&
          r.user_id === user.id,
      );
      const { error } = mine
        ? await db
            .from("passport_occasion_reactions")
            .delete()
            .eq("moment_id", action.momentId)
            .eq("emoji", action.emoji)
            .eq("user_id", user.id)
        : await db.from("passport_occasion_reactions").insert({
            occasion_id: id,
            moment_id: action.momentId,
            emoji: action.emoji,
            user_id: user.id,
          });
      fail(error, "reacting");
      break;
    }

    case "addOption": {
      const prompt = live.prompts.find((p) => p.prompt.id === action.promptId);
      if (!prompt?.prompt.openToSuggestions || !prompt.open) {
        throw new NightError("That question isn't taking suggestions.", 422);
      }
      const { error } = await db.from("passport_occasion_options").insert({
        occasion_id: id,
        prompt_id: action.promptId,
        label: action.label,
        detail: action.detail || null,
        added_by: user.id,
      });
      fail(error, "suggesting that");
      break;
    }

    case "addToy": {
      const { input, family } = action;
      if (
        input.targetId &&
        !live.participants.some((p) => p.id === input.targetId)
      ) {
        throw new NightError("Aim it at somebody who is actually here.", 422);
      }
      if (!definition.phases.some((p) => p.id === input.phaseId)) {
        throw new NightError("No such moment in this night.", 422);
      }
      const toyId = `toy-${family}-${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
      const built = TOYS[family].build({
        ...input,
        id: toyId,
        askedBy: user.id,
      });
      for (const prompt of built) {
        // Who asked and what it is called are columns, not content.
        // JSON drops the undefined keys, so neither is stored twice.
        const content = { ...prompt, id: undefined, askedBy: undefined };
        const { error } = await db.from("passport_occasion_prompts").insert({
          occasion_id: id,
          ...rulesFor(prompt),
          asked_by: user.id,
          content,
        });
        fail(error, "adding that");
      }
      // Same rule as the lab: the feed says something happened, never what,
      // when the thing is a secret.
      const secret = built.some((p) => p.audience?.only);
      const { error } = await db.from("passport_occasion_moments").insert({
        occasion_id: id,
        actor_id: user.id,
        kind: "note",
        text: secret
          ? `slipped somebody a ${TOYS[family].label.toLowerCase()}. Nobody else needs to know what.`
          : `added ${TOYS[family].label.toLowerCase()}: “${input.text.split("|")[0].trim()}”`.slice(
              0,
              500,
            ),
      });
      fail(error, "announcing that");
      break;
    }

    case "nominate": {
      const prompt = live.prompts.find((p) => p.prompt.id === action.promptId);
      if (!prompt?.prompt.openToSuggestions || !prompt.open) {
        throw new NightError("That question isn't taking suggestions.", 422);
      }
      const { places } = await placesNear(rows.occasion);
      const place = places.find((p) => p.atlasId === action.atlasId);
      if (!place)
        throw new NightError(
          "Passport can't find that place near the arena.",
          422,
        );
      if (
        rows.options.some(
          (o) => o.prompt_id === action.promptId && o.label === place.name,
        )
      ) {
        throw new NightError(`${place.name} is already on the ballot.`, 409);
      }
      const { error } = await db.from("passport_occasion_options").insert({
        occasion_id: id,
        prompt_id: action.promptId,
        label: place.name.slice(0, 80),
        detail: walkLabel(place),
        place,
        added_by: user.id,
      });
      fail(error, "nominating that");
      break;
    }

    case "cue": {
      const base = action.promptId.split("::")[0];
      if (rows.cues.some((c) => c.prompt_id === base)) break;
      const { error } = await db.from("passport_occasion_cues").insert({
        occasion_id: id,
        prompt_id: base,
        cued_by: user.id,
      });
      if (error && error.code !== "23505") fail(error, "opening that");
      break;
    }

    case "consent": {
      const { error } = await db.from("passport_occasion_consents").upsert(
        {
          occasion_id: id,
          prompt_id: action.promptId,
          user_id: user.id,
          agreed: action.agreed,
        },
        { onConflict: "occasion_id,prompt_id,user_id" },
      );
      fail(error, "that");
      break;
    }

    case "setBrief": {
      if (me.role !== "host")
        throw new NightError("The host sets the tone.", 403);
      const { error } = await db
        .from("passport_occasions")
        .update({ brief: action.brief })
        .eq("id", id);
      fail(error, "setting the brief");
      break;
    }

    case "setMyEdge":
    case "setMe": {
      const patch: Partial<MemberRow> =
        action.type === "setMyEdge"
          ? { edge: action.edge }
          : {
              display_name: action.name,
              emoji: action.emoji,
              vibe: action.vibe || null,
            };
      const { error } = await db
        .from("passport_occasion_members")
        .update(patch)
        .eq("occasion_id", id)
        .eq("user_id", user.id);
      fail(error, "updating you");
      break;
    }

    case "callIt": {
      const rule = rows.prompts.find((p) => p.prompt_id === action.promptId);
      if (!rule || (me.role !== "host" && rule.asked_by !== user.id)) {
        throw new NightError(
          "Only the host, or whoever asked it, calls that.",
          403,
        );
      }
      const { data, error } = await db
        .from("passport_occasion_prompts")
        .update({ resolution: action.value })
        .eq("occasion_id", id)
        .eq("prompt_id", action.promptId)
        .select("prompt_id");
      fail(error, "calling that");
      if (!data?.length)
        throw new NightError("Not allowed: calling that.", 403);
      break;
    }
  }

  const fresh = await loadNight(user, id);
  if (!fresh) throw new NightError("Not found.", 404);
  return fresh;
}

// ------------------------------------------------------------ places

/**
 * Food and drink near the venue, from Discovery's own Atlas candidates.
 * `outage` says Atlas could not be asked — different from "nothing nearby".
 */
async function placesNear(
  occasion: NightRows["occasion"],
): Promise<{ places: NearbyPlace[]; outage?: string }> {
  const venue = occasion.details.venueAt ?? SYCLE_HOCKEY_NIGHT.details.venueAt;
  const { candidates, outage } = await discoveryCandidates();
  return { places: nearbyFood(candidates, venue), outage };
}

export async function nearbyFor(
  user: PassportUser,
  id: string,
): Promise<{ places: NearbyPlace[]; outage?: string }> {
  const db = await createSupabaseServerClient();
  const rows = await rowsFor(db, id);
  if (!rows?.members.some((m) => m.user_id === user.id)) {
    throw new NightError("Not found.", 404);
  }
  return placesNear(rows.occasion);
}

// ------------------------------------------------------- invitations

export interface InviteView {
  readonly id: string;
  readonly label: string | null;
  readonly uses: number;
  readonly maxUses: number;
  readonly expiresAt: string | null;
  readonly revoked: boolean;
  readonly createdAt: string;
}

export async function listInvites(
  user: PassportUser,
  id: string,
): Promise<InviteView[]> {
  const db = await createSupabaseServerClient();
  const night = await loadNight(user, id);
  if (night?.role !== "host") throw new NightError("Not found.", 404);
  const { data, error } = await db
    .from("passport_occasion_invites")
    .select("id, label, uses, max_uses, expires_at, revoked_at, created_at")
    .eq("occasion_id", id)
    .order("created_at", { ascending: false });
  fail(error, "listing invitations");
  return (data ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    uses: r.uses,
    maxUses: r.max_uses,
    expiresAt: r.expires_at,
    revoked: r.revoked_at !== null,
    createdAt: r.created_at,
  }));
}

/**
 * A new invitation link. The token exists in exactly two places: the response
 * to this call, and the URL the host pastes. The database keeps its hash.
 */
export async function createInvite(
  user: PassportUser,
  id: string,
  label: string | undefined,
): Promise<{ token: string }> {
  const db = await createSupabaseServerClient();
  const night = await loadNight(user, id);
  if (night?.role !== "host") throw new NightError("Not found.", 404);
  const token = randomBytes(24).toString("base64url");
  // Good until the morning after; a link found in a chat log next spring opens nothing.
  const expires = new Date(
    new Date(night.definition.anchorAt).getTime() + 24 * 3600e3,
  );
  const { error } = await db.from("passport_occasion_invites").insert({
    occasion_id: id,
    token_hash: hashToken(token),
    label: label?.trim().slice(0, 60) || null,
    max_uses: 1,
    expires_at: expires.toISOString(),
    created_by: user.id,
  });
  fail(error, "inviting");
  return { token };
}

export async function revokeInvite(
  user: PassportUser,
  id: string,
  inviteId: string,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("passport_occasion_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("occasion_id", id)
    .eq("id", inviteId)
    .select("id");
  fail(error, "revoking");
  if (!data?.length) throw new NightError("Not found.", 404);
}

export async function removeMember(
  user: PassportUser,
  id: string,
  memberId: string,
): Promise<void> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("passport_occasion_members")
    .delete()
    .eq("occasion_id", id)
    .eq("user_id", memberId)
    .eq("role", "guest")
    .select("user_id");
  fail(error, "removing them");
  if (!data?.length) throw new NightError("Not found.", 404);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Signed-out safe: is this link any good? Nothing else. */
export async function inviteIsValid(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return false;
  const db = await createSupabaseServerClient();
  const { data } = await db.rpc("passport_describe_occasion_invite", {
    p_token: token,
  });
  return data === true;
}

export async function redeemInvite(
  user: PassportUser,
  token: string,
  name: string | undefined,
): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return null;
  const db = await createSupabaseServerClient();
  const look = defaultLook(user.id);
  const { data, error } = await db.rpc("passport_redeem_occasion_invite", {
    p_token: token,
    p_display_name: cleanName(name, cleanName(user.displayName, "Guest")),
    p_emoji: look.emoji,
    p_hue: look.hue,
  });
  if (error) throw new NightError(error.message, 500);
  return typeof data === "string" ? data : null;
}
