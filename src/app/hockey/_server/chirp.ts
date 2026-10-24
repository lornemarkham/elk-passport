import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  chirpLevelOf,
  couchPlan,
  donePlan,
  finalPlan,
  leadPlan,
  lastCallPlan,
  picksPlan,
  switchPlan,
  libraryChirps,
  organicAllowed,
  organicPlan,
  promptPlan,
  readChatter,
  renderBotRow,
  welcomePlan,
  type BotLine,
  type BotPlan,
  type ChirpRoom,
  type BotKind,
  type BotRow,
  type DoneFamily,
  type Fan,
  type ScorePick,
} from "@/domain/hockey/chirp";
import {
  chirpsRequest,
  lineRequest,
  readChirps,
  readLine,
  type GameContext,
  type LineOccasion,
} from "@/domain/hockey/chirp-voice";
import { isTeamAbbr, teamByName } from "@/domain/hockey/fans";
import { modulesOf } from "@/domain/hockey/modules";
import { matchupOf } from "@/domain/hockey/teams";
import {
  SYCLE_HOCKEY_NIGHT,
  templatePrompts,
  type NightRows,
} from "@/domain/hockey/night";
import { askModel, modelConfigured, tell } from "./chirp-ai";

/**
 * **Chirp Bot, server side: reading its lines and writing new ones.**
 *
 * Writes run as the person whose action caused the line (their session,
 * under RLS, like every other write in Hockey Night), so `actor_id` on a bot
 * line is the member who set it off — and the host can delete it like any
 * line. What Chirp Bot decides lives in `domain/hockey/chirp.ts`; this file
 * only fetches, signs and inserts, and never lets a failure reach the
 * person: a line Chirp Bot could not post is a line nobody misses.
 */

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type { ChirpRoom };

export const NO_CHIRP_ROOM: ChirpRoom = {
  available: false,
  on: false,
  fans: {},
  lines: [],
  model: false,
};

// ---------------------------------------------------------- signature

/**
 * The key a model's line is signed with: `CHIRP_BOT_SECRET`, else the
 * OpenAI key itself — a model's line can only exist when that key does, so
 * no new configuration is needed for the signature to work. Rotating the key
 * hides older model lines (they fail to verify); library lines are unaffected.
 */
function secret(): string | null {
  return process.env.CHIRP_BOT_SECRET || process.env.OPENAI_API_KEY || null;
}

export function signLine(
  occasionId: string,
  key: string,
  text: string,
  using = secret(),
): string | null {
  if (!using) return null;
  return createHmac("sha256", `chirp-bot:${using}`)
    .update(`${occasionId}\n${key}\n${text}`)
    .digest("base64url");
}

export function verifier(occasionId: string, using = secret()) {
  return (row: BotRow): boolean => {
    if (!row.bot_sig || !row.text || !row.bot_key) return false;
    const expected = signLine(occasionId, row.bot_key, row.text, using);
    if (!expected) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(row.bot_sig);
    return a.length === b.length && timingSafeEqual(a, b);
  };
}

// --------------------------------------------------------------- read

export function botRowsOf(rows: NightRows): BotRow[] {
  return rows.moments
    .filter((m) => m.kind === "chirp")
    .map((m) => ({
      id: m.id,
      actor_id: m.actor_id,
      text: m.text,
      at: m.at,
      bot_key: m.bot_key ?? null,
      bot_line: m.bot_line ?? null,
      bot_sig: m.bot_sig ?? null,
    }));
}

export function fansOf(rows: NightRows): Fan[] {
  return rows.members.map((m) => ({
    id: m.user_id,
    name: m.display_name,
    team: isTeamAbbr(m.nhl_team) ? m.nhl_team : null,
  }));
}

const chirpOn = (rows: NightRows) => rows.occasion.details.chirp !== false;
const levelOf = (rows: NightRows) =>
  chirpLevelOf(rows.occasion.details as { chirpLevel?: unknown });

/** What the game has come to, as the night's own engine reads it. */
export interface NightFacts {
  readonly gameOver: boolean;
  /** The host has called the final score. */
  readonly called: boolean;
  /** The outright Cup leader, with points. */
  readonly leader: { readonly id: string; readonly points: number } | null;
}

const NO_FACTS: NightFacts = { gameOver: false, called: false, leader: null };

/** The sealed final-score picks this member can read (all of them once locked). */
function scorePicks(
  rows: NightRows,
  members: ReadonlySet<string>,
): ScorePick[] {
  return rows.responses.flatMap((r) => {
    if (r.prompt_id !== "final-score" || !members.has(r.user_id)) return [];
    const v = r.value;
    return Array.isArray(v) &&
      v.length === 2 &&
      Number.isInteger(v[0]) &&
      Number.isInteger(v[1])
      ? [{ userId: r.user_id, home: v[0] as number, away: v[1] as number }]
      : [];
  });
}

/** A dinner option's label, from the template or what a member added. */
function dinnerLabel(
  rows: NightRows,
): (optionId: string) => string | undefined {
  const labels = new Map<string, string>();
  const details = rows.occasion.details;
  for (const p of templatePrompts(
    { ...SYCLE_HOCKEY_NIGHT.details, ...details },
    "",
    [],
  ).filter((p) => p.id === "pregame-spot"))
    for (const o of p.options ?? []) labels.set(o.id, o.label);
  for (const o of rows.options)
    if (o.prompt_id === "pregame-spot") labels.set(o.id, o.label);
  return (id) => labels.get(id);
}

/** The chat's Chirp Bot lines and everybody's team, as this member may see them. */
export function chirpRoomOf(
  rows: NightRows,
  available: boolean,
  facts: NightFacts = NO_FACTS,
): ChirpRoom {
  if (!available) return NO_CHIRP_ROOM;
  const fans = fansOf(rows);
  const byId = new Map(fans.map((f) => [f.id, f]));
  const verify = verifier(rows.occasion.id);
  const members = new Set(fans.map((f) => f.id));
  const picks = scorePicks(rows, members);
  const optionLabel = dinnerLabel(rows);
  // A line that quotes somebody's pick or crowns somebody shows only while
  // that is true of the record this member can read.
  const claimHolds = (kind: BotKind, parts: readonly string[]): boolean => {
    if (kind === "picks")
      return picks.some(
        (p) => p.userId === parts[2] && `${p.home}-${p.away}` === parts[3],
      );
    if (kind === "final" || kind === "lead")
      return facts.leader !== null && facts.leader.id === parts[2];
    return false;
  };
  const pointsOf = (id: string) =>
    facts.leader?.id === id ? facts.leader.points : undefined;

  const reactions: Record<string, Record<string, string[]>> = {};
  for (const r of rows.reactions) {
    if (!members.has(r.user_id)) continue;
    const byEmoji = (reactions[r.moment_id] ??= {});
    (byEmoji[r.emoji] ??= []).push(r.user_id);
  }

  const lines = chirpOn(rows)
    ? botRowsOf(rows)
        // A line set off by somebody since removed goes with them, as
        // their own lines do.
        .filter((row) => members.has(row.actor_id))
        .map((row) =>
          renderBotRow(row, {
            fans: byId,
            verify,
            reactions: reactions[row.id],
            optionLabel,
            claimHolds,
            pointsOf,
          }),
        )
        .filter((line): line is BotLine => line !== null)
    : [];

  return {
    available: true,
    on: chirpOn(rows),
    fans: Object.fromEntries(
      fans.filter((f) => f.team).map((f) => [f.id, f.team as string]),
    ),
    lines,
    model: modelConfigured(),
    level: levelOf(rows),
  };
}

// -------------------------------------------------------------- write

async function post(
  db: Db,
  occasionId: string,
  actorId: string,
  plan: BotPlan,
): Promise<void> {
  const text = plan.text ?? null;
  const sig = text ? signLine(occasionId, plan.key, text) : null;
  // A model's line that cannot be signed would never be shown: don't store it.
  if (text && !sig) return;
  const { error } = await db.from("passport_occasion_moments").insert({
    occasion_id: occasionId,
    actor_id: actorId,
    kind: "chirp",
    text,
    bot_key: plan.key,
    bot_line: plan.line,
    bot_sig: sig,
  });
  // 23505: somebody else's phone said it first. That is the point of the key.
  if (error && error.code !== "23505")
    console.warn("[hockey] chirp bot line not posted:", error.message);
}

function gameOf(rows: NightRows): GameContext {
  const opponent = rows.occasion.details.opponent;
  const subtitle = `Canucks vs ${typeof opponent === "string" ? opponent : "Away"}`;
  return matchupOf(subtitle);
}

/** Try the model for a line; keep the library plan if it has nothing usable. */
async function voiced(
  plan: BotPlan,
  rows: NightRows,
  who: string,
  occasion: LineOccasion,
  now: Date,
): Promise<BotPlan> {
  if (!modelConfigured()) return plan;
  const raw = await askModel(
    lineRequest({
      occasion,
      game: gameOf(rows),
      fans: fansOf(rows),
      today: now.toISOString().slice(0, 10),
    }),
    who,
    now.getTime(),
  );
  const text = readLine(raw);
  // The model answered, but not with a line Chirp Bot may say.
  if (raw && !text) tell("rejected");
  return text ? { key: plan.key, line: "ai", text } : plan;
}

const seed = () => Math.floor(Math.random() * 2 ** 31);

/** Someone declared (or changed) their team. */
export async function chirpOnTeam(
  db: Db,
  rows: NightRows,
  userId: string,
  team: string,
  previous: string | null,
  now = new Date(),
): Promise<void> {
  try {
    if (!chirpOn(rows)) return;
    const plan = welcomePlan({
      userId,
      team,
      previous,
      rows: botRowsOf(rows),
      seed: seed(),
      today: now.toISOString().slice(0, 10),
    });
    if (!plan) return;
    const fan = fansOf(rows).find((f) => f.id === userId);
    const occasion: LineOccasion = {
      kind: "welcome",
      fan: { id: userId, name: fan?.name ?? "Someone", team },
      previous,
    };
    await post(
      db,
      rows.occasion.id,
      userId,
      await voiced(plan, rows, userId, occasion, now),
    );
  } catch (error) {
    console.warn("[hockey] chirp bot (team):", error);
  }
}

/**
 * Someone arrived: welcome their team if they brought one from another night.
 * Somebody without a team is asked by the page's welcome, so Chirp Bot does
 * not also ask in the chat — a heckle seconds before their welcome line was
 * two lines where one does the job (2026-10-23: four people joining made
 * eight Chirp Bot lines against three people's).
 */
export async function chirpOnArrival(
  db: Db,
  rows: NightRows,
  userId: string,
  now = new Date(),
): Promise<void> {
  try {
    if (!chirpOn(rows)) return;
    const fan = fansOf(rows).find((f) => f.id === userId);
    if (fan?.team) return chirpOnTeam(db, rows, userId, fan.team, null, now);
  } catch (error) {
    console.warn("[hockey] chirp bot (arrival):", error);
  }
}

/** Somebody said something. Usually Chirp Bot lets it go. */
export async function chirpOnSay(
  db: Db,
  rows: NightRows,
  userId: string,
  text: string,
  momentId: string,
  now = new Date(),
): Promise<void> {
  try {
    if (!chirpOn(rows)) return;
    const fans = fansOf(rows);
    const speaker = fans.find((f) => f.id === userId);
    if (!speaker) return;
    const chatter = readChatter(text, speaker, fans);
    if (!chatter) return;
    const bots = botRowsOf(rows);
    // A person just spoke, so the newest line is theirs, not Chirp Bot's.
    if (!organicAllowed(bots, false, now, levelOf(rows))) return;
    const plan = organicPlan({
      chatter,
      momentId,
      rows: bots,
      now,
      seed: seed(),
    });
    if (!plan) return;
    let occasion: LineOccasion;
    if (chatter.kind === "rivalry") {
      const other = fans.find(
        (f) =>
          f.id !== userId &&
          f.team &&
          chatter.pair.split("-").includes(f.team) &&
          f.team !== speaker.team,
      );
      occasion = {
        kind: "rivalry",
        a: speaker,
        b: other ?? speaker,
        said: text,
      };
    } else {
      occasion = { kind: chatter.kind, fan: speaker, said: text };
    }
    await post(
      db,
      rows.occasion.id,
      userId,
      await voiced(plan, rows, userId, occasion, now),
    );
  } catch (error) {
    console.warn("[hockey] chirp bot (say):", error);
  }
}

/**
 * Somebody opened the chat before the game: the last call for picks, or a
 * fresh question, if one is due. Library only — a question may lean on a
 * current fact, and those come from `STORYLINES`, never from a model.
 */
export async function chirpOnLook(
  db: Db,
  rows: NightRows,
  userId: string,
  now = new Date(),
): Promise<void> {
  try {
    if (!chirpOn(rows)) return;
    const bots = botRowsOf(rows);
    const members = rows.members.length;
    const startsAt = rows.occasion.starts_at;
    const last = lastCallPlan({
      now,
      startsAt,
      members,
      picksOn: modulesOf(rows.occasion.details).has("picks"),
      rows: bots,
      seed: seed(),
    });
    if (last) return post(db, rows.occasion.id, userId, last);
    // Quiet: the moments only, no questions.
    if (levelOf(rows) === "quiet") return;

    const lastHumanNoteAt =
      rows.moments
        .filter((m) => m.kind === "note")
        .map((m) => m.at)
        .sort()
        .at(-1) ?? null;
    const game = gameOf(rows);
    const teams = [
      ...fansOf(rows).map((f) => f.team),
      ...[game.home, game.away].map((name) => teamByName(name)?.abbr),
    ].filter((t): t is string => Boolean(t));
    const plan = promptPlan({
      now,
      startsAt,
      members,
      rows: bots,
      lastHumanNoteAt,
      teams,
      seed: seed(),
    });
    if (plan) await post(db, rows.occasion.id, userId, plan);
  } catch (error) {
    console.warn("[hockey] chirp bot (look):", error);
  }
}

/**
 * Three chirps `userId` might send about `targetId`. Never posts anything:
 * the person picks one, and it goes out as their own message, if at all.
 */
export async function chirpsAbout(
  rows: NightRows,
  userId: string,
  targetId: string,
  now = new Date(),
): Promise<{ chirps: string[]; by: "model" | "library" } | null> {
  const fans = fansOf(rows);
  const sender = fans.find((f) => f.id === userId);
  const target = fans.find((f) => f.id === targetId);
  if (!sender || !target || target.id === sender.id) return null;
  const today = now.toISOString().slice(0, 10);

  const fallback = libraryChirps({ sender, target, seed: seed(), today });
  if (!modelConfigured()) return { chirps: fallback, by: "library" };

  const raw = await askModel(
    chirpsRequest({ sender, target, game: gameOf(rows), today }),
    userId,
    now.getTime(),
  );
  const fromModel = readChirps(raw);
  if (raw && fromModel.length === 0) tell("rejected");
  if (fromModel.length === 0) return { chirps: fallback, by: "library" };
  const chirps = [...fromModel];
  for (const line of fallback) {
    if (chirps.length >= 3) break;
    if (!chirps.includes(line)) chirps.push(line);
  }
  return { chirps, by: "model" };
}

/** Someone said they're watching from the couch. */
export async function chirpOnCouch(
  db: Db,
  rows: NightRows,
  userId: string,
  now = new Date(),
): Promise<void> {
  try {
    if (!chirpOn(rows)) return;
    const plan = couchPlan({
      userId,
      rows: botRowsOf(rows),
      seed: seed(),
      today: now.toISOString().slice(0, 10),
    });
    if (plan) await post(db, rows.occasion.id, userId, plan);
  } catch (error) {
    console.warn("[hockey] chirp bot (couch):", error);
  }
}

/** Somebody moved their dinner vote. A heckle, so rate-limited like one. */
export async function chirpOnSwitch(
  db: Db,
  rows: NightRows,
  userId: string,
  from: string,
  to: string,
  now = new Date(),
): Promise<void> {
  try {
    if (!chirpOn(rows)) return;
    const label = dinnerLabel(rows);
    if (!label(from) || !label(to)) return;
    const newest = [...rows.moments].sort((a, b) =>
      b.at.localeCompare(a.at),
    )[0];
    const plan = switchPlan({
      userId,
      from,
      to,
      rows: botRowsOf(rows),
      newestIsBot: newest?.kind === "chirp",
      now,
      level: levelOf(rows),
      seed: seed(),
    });
    if (plan) await post(db, rows.occasion.id, userId, plan);
  } catch (error) {
    console.warn("[hockey] chirp bot (switch):", error);
  }
}

/**
 * The moments that arrive with the clock: picks sealed at puck drop, and
 * the final verdict once the game is over and called. Asked on every read
 * of the night, so whoever looks first sets it off; the per-night key keeps
 * it to one line however many phones ask at once. Library only.
 */
export async function chirpTick(
  db: Db,
  rows: NightRows,
  userId: string,
  facts: NightFacts,
  now = new Date(),
): Promise<void> {
  try {
    if (!chirpOn(rows)) return;
    const bots = botRowsOf(rows);
    const members = new Set(rows.members.map((m) => m.user_id));
    const startsAt = rows.occasion.starts_at;
    const picks = picksPlan({
      now,
      startsAt,
      members: members.size,
      picks: scorePicks(rows, members),
      rows: bots,
      seed: seed(),
    });
    if (picks) await post(db, rows.occasion.id, userId, picks);
    const verdict = finalPlan({
      now,
      startsAt,
      gameOver: facts.gameOver,
      called: facts.called,
      leader: facts.leader,
      rows: bots,
      seed: seed(),
    });
    if (verdict) await post(db, rows.occasion.id, userId, verdict);
    // A lead change during the night (the verdict has the last word).
    const lead = leadPlan({
      now,
      startsAt,
      gameOver: facts.gameOver,
      called: facts.called,
      leader: facts.leader,
      rows: bots,
      seed: seed(),
    });
    if (lead && !verdict) await post(db, rows.occasion.id, userId, lead);
  } catch (error) {
    console.warn("[hockey] chirp bot (tick):", error);
  }
}

/**
 * Somebody said "yes, I did it" to their own secret mission, dare or side
 * quest. Library only, and the line never says what it was.
 */
export async function chirpOnDone(
  db: Db,
  rows: NightRows,
  userId: string,
  promptId: string,
  family: DoneFamily,
  now = new Date(),
): Promise<void> {
  try {
    if (!chirpOn(rows)) return;
    const newest = [...rows.moments].sort((a, b) =>
      b.at.localeCompare(a.at),
    )[0];
    const plan = donePlan({
      userId,
      promptId,
      family,
      rows: botRowsOf(rows),
      newestIsBot: newest?.kind === "chirp",
      now,
      level: levelOf(rows),
      seed: seed(),
    });
    if (plan) await post(db, rows.occasion.id, userId, plan);
  } catch (error) {
    console.warn("[hockey] chirp bot (done):", error);
  }
}
