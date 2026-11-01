import "server-only";
import type { PassportUser } from "@/lib/auth/currentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  findScheduled,
  nextWeekOf,
  readGame,
  readScheduled,
  readUpcoming,
  suggestedCalls,
  type NhlGame,
  type ScheduledGame,
} from "@/domain/hockey/nhl";
import { ZONE, zoneOr } from "@/domain/hockey/schedule";
import { NightError } from "./night";

/**
 * **The league's word on this night's game.**
 *
 * Read on demand from the NHL's public API, cached for seconds while a game
 * is on and minutes otherwise, so five coworkers polling cost the league one
 * request. Any failure — the league down, no matching game, a network error —
 * is `available: false`, and the page says nothing about a score. A night
 * never breaks because the league did.
 */

const BASE = process.env.NHL_API_BASE ?? "https://api-web.nhle.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface GameView {
  readonly available: boolean;
  readonly game?: NhlGame;
  /** What the league's record would fill in, keyed by question id. Hosts only. */
  readonly suggestions?: Record<string, { value: unknown; words: string }>;
}

async function getJson(path: string, revalidate: number): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`NHL ${res.status}`);
  return res.json();
}

export async function gameFor(
  user: PassportUser,
  id: string,
  now = new Date(),
): Promise<GameView> {
  if (!UUID.test(id)) throw new NightError("Not found.", 404);
  const db = await createSupabaseServerClient();
  const [{ data: occasion, error }, { data: me }] = await Promise.all([
    db
      .from("passport_occasions")
      .select("starts_at, details")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("passport_occasion_members")
      .select("role")
      .eq("occasion_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (error) throw new NightError(error.message, 500);
  if (!occasion || !me) throw new NightError("Not found.", 404);

  const startsAt = occasion.starts_at as string;
  const details = (occasion.details ?? {}) as {
    opponent?: string;
    nhlGameId?: number;
    timeZone?: string;
  };
  const opponent = String(details.opponent ?? "");
  const gameId =
    typeof details.nhlGameId === "number" ? details.nhlGameId : undefined;
  // Close to puck drop the answer changes by the minute; far from it, not at all.
  const near = now.getTime() >= new Date(startsAt).getTime() - 30 * 60_000;
  try {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: zoneOr(details.timeZone ?? ZONE),
    }).format(new Date(startsAt));
    const entry = findScheduled(
      await getJson(`/v1/schedule/${date}`, near ? 60 : 900),
      startsAt,
      opponent,
      gameId,
    ) as { id: number } | null;
    if (!entry) return { available: false };
    const raw = near
      ? await getJson(`/v1/gamecenter/${entry.id}/landing`, 10)
      : entry;
    const game = readGame(raw);
    if (!game) return { available: false };
    const suggestions = me.role === "host" ? suggestedCalls(game) : undefined;
    return {
      available: true,
      game,
      ...(suggestions && Object.keys(suggestions).length
        ? { suggestions }
        : {}),
    };
  } catch (error) {
    console.error(
      "[hockey] nhl",
      error instanceof Error ? error.message : error,
    );
    return { available: false };
  }
}

/** How far ahead the start form looks. Three weeks is a month's worth of invitations. */
const WEEKS_AHEAD = 3;

/**
 * **The games a night can be built on**: the league's schedule for the next
 * few weeks, regular season and playoffs, not yet started. Cached for a
 * quarter of an hour. The league down means an empty list and `available:
 * false`, and the form falls back to setting a game by hand.
 */
export async function upcomingGames(
  now = new Date(),
): Promise<{ available: boolean; games: ScheduledGame[] }> {
  try {
    let date: string | null = new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE,
    }).format(now);
    const games: ScheduledGame[] = [];
    const seen = new Set<number>();
    for (let week = 0; week < WEEKS_AHEAD && date; week += 1) {
      const body: unknown = await getJson(`/v1/schedule/${date}`, 900);
      for (const g of readUpcoming(body, now)) {
        if (!seen.has(g.id)) {
          seen.add(g.id);
          games.push(g);
        }
      }
      date = nextWeekOf(body);
    }
    return { available: true, games };
  } catch (error) {
    console.error(
      "[hockey] nhl schedule",
      error instanceof Error ? error.message : error,
    );
    return { available: false, games: [] };
  }
}

/** One game by the league's id, from its own record; null when the league has no such game. */
export async function scheduledGameById(
  id: number,
): Promise<ScheduledGame | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    return readScheduled(await getJson(`/v1/gamecenter/${id}/landing`, 900));
  } catch (error) {
    console.error(
      "[hockey] nhl game",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
