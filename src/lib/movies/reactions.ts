import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PassportUser } from "@/lib/auth/currentUser";
import type { Fear } from "./catalogue";

/**
 * **What a person said about a film, after watching it.**
 *
 * Three taps at most, all of them stated: loved/good/meh, how frightening it
 * actually was for them, and — occasionally — one word for what did it.
 * Nothing is inferred from whether they finished it or how long a page was
 * open. Read and written through the caller's own session, so RLS is the
 * boundary.
 *
 * The catalogue's expected fear stays in code. `felt` is theirs, and the gap
 * between the two is the only interesting number here — which is why one
 * never overwrites the other.
 */
import type { MovieReaction, Verdict } from "./types";
export type { MovieReaction, Verdict } from "./types";

interface Row {
  film_id: string;
  verdict: Verdict;
  felt: Fear | null;
  got_me: string | null;
  reacted_at: string;
}

const fromRow = (r: Row): MovieReaction => ({
  filmId: r.film_id,
  verdict: r.verdict,
  felt: r.felt,
  gotMe: r.got_me,
  reactedAt: r.reacted_at,
});

export const isVerdict = (v: unknown): v is Verdict =>
  v === "loved" || v === "good" || v === "meh";

export const isFear = (v: unknown): v is Fear =>
  v === "cozy" || v === "spooky" || v === "creepy" || v === "nightmare";

export async function reactionsFor(
  user: PassportUser,
): Promise<MovieReaction[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("passport_movie_reactions")
    .select("film_id, verdict, felt, got_me, reacted_at")
    .eq("user_id", user.id);
  if (error || !data) return [];
  return (data as Row[]).map(fromRow);
}

/** Idempotent: saying it again replaces what they said, never adds a row. */
export async function react(
  user: PassportUser,
  reaction: {
    filmId: string;
    verdict: Verdict;
    felt?: Fear | null;
    gotMe?: string | null;
  },
): Promise<MovieReaction> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("passport_movie_reactions")
    .upsert(
      {
        user_id: user.id,
        film_id: reaction.filmId,
        verdict: reaction.verdict,
        felt: reaction.felt ?? null,
        got_me: reaction.gotMe ?? null,
        reacted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,film_id" },
    )
    .select("film_id, verdict, felt, got_me, reacted_at")
    .single<Row>();

  if (error || !data)
    throw new Error(`Could not save that: ${error?.message ?? "no row"}`);
  return fromRow(data);
}
