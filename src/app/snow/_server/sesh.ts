import type { SupabaseClient } from "@supabase/supabase-js";
import type { Action } from "@/domain/snow/sesh/actions";
import type {
  Chirp,
  Clip,
  Feature,
  Rider,
  Viewer,
  World,
} from "@/domain/snow/sesh/model";

/**
 * **Sesh Wars against the database, as the caller.**
 *
 * Reads run under row-level security with Passport's ordinary client (anon
 * key + the person's session), so what comes back is already what they may
 * see. Writes are the migration's functions (docs/product/snow/
 * sesh-wars-migration.sql), which re-check every rule. No service key.
 *
 * Kept free of `server-only` so the real-stack test can call it directly.
 */

export const CLIP_BUCKET = "sesh-wars-clips";

/** How much of the world one page reads. Enough for a first season. */
const LIMIT = {
  clips: 1500,
  challenges: 1500,
  votes: 20000,
  chirps: 3000,
  reactions: 20000,
};

export class SeshRefused extends Error {}
export class SeshUnavailable extends Error {}

/** Is Sesh Wars' table there? (42501 = there, but this visitor can't read it.) */
export async function seshReady(db: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await db
      .from("passport_sesh_features")
      .select("id")
      .limit(1);
    return error === null || error.code === "42501";
  } catch {
    return false;
  }
}

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");

function fail(
  error: { message?: string; code?: string } | null,
  what: string,
): never {
  if (!error) throw new SeshUnavailable(what);
  if (error.code === "PGRST205" || error.code === "42P01")
    throw new SeshUnavailable(what);
  throw new SeshUnavailable(`${what}: ${error.message ?? error.code}`);
}

export async function loadWorld(
  db: SupabaseClient,
  userId: string | null,
): Promise<{ world: World; viewer: Viewer }> {
  const [
    features,
    riders,
    clips,
    challenges,
    votes,
    chirps,
    reactions,
    blocks,
    mods,
  ] = await Promise.all([
    db.from("passport_sesh_features").select("*"),
    db
      .from("passport_sesh_riders")
      .select("user_id,name,home_mountain,sport,division,age_group,created_at"),
    db
      .from("passport_sesh_clips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIMIT.clips),
    db
      .from("passport_sesh_challenges")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIMIT.challenges),
    db.from("passport_sesh_votes").select("*").limit(LIMIT.votes),
    db
      .from("passport_sesh_chirps")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIMIT.chirps),
    db.from("passport_sesh_reactions").select("*").limit(LIMIT.reactions),
    userId
      ? db.from("passport_sesh_blocks").select("blocker_id,blocked_id")
      : Promise.resolve({ data: [], error: null }),
    userId
      ? db.from("passport_sesh_moderators").select("user_id")
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [r, what] of [
    [features, "features"],
    [riders, "riders"],
    [clips, "clips"],
    [challenges, "challenges"],
    [votes, "votes"],
    [chirps, "chirps"],
    [reactions, "reactions"],
  ] as const)
    if (r.error) fail(r.error, what);

  const world: World = {
    features: (features.data as Row[]).map((f): Feature => ({
      id: s(f.id),
      mountainId: s(f.mountain_id),
      name: s(f.name),
      kind: f.kind as Feature["kind"],
      sizes: (f.sizes as Feature["sizes"]) ?? [],
      where: s(f.where_words),
      description: s(f.description),
      status: f.status as Feature["status"],
      opens: f.opens ? s(f.opens) : undefined,
      note: f.note ? s(f.note) : undefined,
      source: f.source_url
        ? {
            url: s(f.source_url),
            quote: s(f.source_quote),
            checked: s(f.source_checked),
          }
        : undefined,
    })),
    riders: (riders.data as Row[]).map((r): Rider => ({
      id: s(r.user_id),
      name: s(r.name),
      homeMountain: s(r.home_mountain),
      sport: r.sport as Rider["sport"],
      division: (r.division as Rider["division"]) ?? undefined,
      ageGroup: r.age_group as Rider["ageGroup"],
      since: s(r.created_at),
    })),
    clips: (clips.data as Row[]).map((c): Clip => ({
      id: s(c.id),
      featureId: s(c.feature_id),
      riderId: s(c.rider_id),
      sport: c.sport as Clip["sport"],
      division: c.division as Clip["division"],
      category: c.category as Clip["category"],
      caption: s(c.caption),
      at: s(c.created_at),
      media: {
        kind: "video",
        url: `/snow/sesh-wars/api/video/${s(c.id)}`,
        poster: c.poster_path
          ? `/snow/sesh-wars/api/video/${s(c.id)}?poster=1`
          : undefined,
      },
      status: c.status as Clip["status"],
      byGuardian: c.by_guardian === true || undefined,
    })),
    challenges: (challenges.data as Row[]).map((c) => ({
      id: s(c.id),
      featureId: s(c.feature_id),
      category: c.category as Clip["category"],
      division: c.division as Clip["division"],
      defenderClipId: s(c.defender_clip),
      challengerClipId: s(c.challenger_clip),
      at: s(c.created_at),
      closesAt: s(c.closes_at),
    })),
    votes: (votes.data as Row[]).map((v) => ({
      challengeId: s(v.challenge_id),
      voterId: s(v.voter_id),
      side: v.side as "defender" | "challenger",
      at: s(v.created_at),
    })),
    chirps: (chirps.data as Row[]).map((c): Chirp => ({
      id: s(c.id),
      thread: {
        kind: c.thread_kind as Chirp["thread"]["kind"],
        id: s(c.thread_id),
      },
      authorId: s(c.author_id),
      body: s(c.body),
      at: s(c.created_at),
      status: c.status as Chirp["status"],
    })),
    reactions: (reactions.data as Row[]).map((r) => ({
      clipId: s(r.clip_id),
      riderId: s(r.rider_id),
      kind: r.kind as World["reactions"][number]["kind"],
    })),
    blocks: ((blocks.data ?? []) as Row[]).map((b) => ({
      blockerId: s(b.blocker_id),
      blockedId: s(b.blocked_id),
    })),
  };
  const me = userId ? world.riders.find((r) => r.id === userId) : undefined;
  const viewer: Viewer = {
    signedIn: !!userId,
    riderId: me?.id,
    ageGroup: me?.ageGroup,
    moderator: ((mods.data ?? []) as Row[]).length > 0 || undefined,
  };
  return { world, viewer };
}

/** Postgres' own refusals become a sentence; anything else is unavailability. */
function rpcFail(error: { message?: string; code?: string }): never {
  const human = ["22023", "23505", "42501", "P0002", "28000", "23514", "23503"];
  if (error.code && human.includes(error.code)) {
    const m = error.message ?? "Not possible.";
    if (error.code === "23505")
      throw new SeshRefused("Already done — that's locked in.");
    throw new SeshRefused(m.charAt(0).toUpperCase() + m.slice(1) + ".");
  }
  throw new SeshUnavailable(error.message ?? "unavailable");
}

/**
 * Write one action as the caller. The route has already run the shared
 * check; this is the database's turn. Returns the new clip or challenge id.
 */
export async function perform(
  db: SupabaseClient,
  action: Action,
  extra: { videoPath?: string; posterPath?: string } = {},
): Promise<{ clip?: string; challenge?: string; id?: string }> {
  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) rpcFail(error);
    return data as unknown;
  };
  switch (action.type) {
    case "profile":
      await call("passport_sesh_profile", {
        p_name: action.name,
        p_home: action.homeMountain,
        p_sport: action.sport,
        p_division: action.division ?? "",
        p_age: action.ageGroup,
      });
      return {};
    case "post": {
      if (!extra.videoPath) throw new SeshRefused("Upload the video first.");
      const out = (await call("passport_sesh_post", {
        p_feature: action.featureId,
        p_sport: action.sport,
        p_division: action.division,
        p_category: action.category,
        p_caption: action.caption,
        p_video: extra.videoPath,
        p_poster: extra.posterPath ?? null,
        p_by_guardian: !!action.byGuardian,
        p_rights: action.rights,
        p_open_terrain: action.openTerrain,
        p_answer_to: action.answerTo ?? null,
      })) as { clip: string; challenge: string | null };
      return { clip: out.clip, challenge: out.challenge ?? undefined };
    }
    case "vote":
      await call("passport_sesh_vote", {
        p_challenge: action.challengeId,
        p_side: action.side,
      });
      return {};
    case "chirp":
      return {
        id: (await call("passport_sesh_chirp", {
          p_kind: action.thread.kind,
          p_thread: action.thread.id,
          p_body: action.body,
        })) as string,
      };
    case "react":
      await call("passport_sesh_react", {
        p_clip: action.clipId,
        p_kind: action.kind,
      });
      return {};
    case "report":
      await call("passport_sesh_report", {
        p_kind: action.target.kind,
        p_target: action.target.id,
        p_reason: action.reason,
      });
      return {};
    case "block":
      await call("passport_sesh_block", { p_rider: action.riderId });
      return {};
  }
}

/** A short-lived link to a clip's file, if the caller may see the clip. */
export async function signedVideo(
  db: SupabaseClient,
  clipId: string,
  poster = false,
): Promise<string | null> {
  const { data, error } = await db
    .from("passport_sesh_clips")
    .select("video_path,poster_path")
    .eq("id", clipId)
    .maybeSingle();
  if (error || !data) return null;
  const file = poster ? (data as Row).poster_path : (data as Row).video_path;
  if (typeof file !== "string") return null;
  const signed = await db.storage.from(CLIP_BUCKET).createSignedUrl(file, 3600);
  return signed.data?.signedUrl ?? null;
}

export const VIDEO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|mov|webm)$/;
export const POSTER_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
