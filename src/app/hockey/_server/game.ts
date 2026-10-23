import "server-only";
import type { PassportUser } from "@/lib/auth/currentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  findScheduled,
  readGame,
  suggestedCalls,
  type NhlGame,
} from "@/domain/hockey/nhl";
import { ZONE } from "@/domain/hockey/schedule";
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
  const opponent = String(
    (occasion.details as { opponent?: string } | null)?.opponent ?? "",
  );
  // Close to puck drop the answer changes by the minute; far from it, not at all.
  const near = now.getTime() >= new Date(startsAt).getTime() - 30 * 60_000;
  try {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(
      new Date(startsAt),
    );
    const entry = findScheduled(
      await getJson(`/v1/schedule/${date}`, near ? 60 : 900),
      startsAt,
      opponent,
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
