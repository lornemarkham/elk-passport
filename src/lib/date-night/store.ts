import "server-only";
import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DateNightAnswer } from "@/domain/date-night/answer";

/**
 * **Date Night in Postgres**, through `passport_date_night_*`
 * (supabase/migrations/20261102000000_passport_date_nights.sql).
 *
 * Answering uses the public anon key with no session — the invited person is
 * not signed in, and must not need to be. Reading uses the signed-in
 * person's own session, and Postgres decides: only the night's owner gets
 * rows back. No service-role key, here or anywhere in the app.
 */

/** The migration has not been applied, or Supabase is not configured. */
export class NotReady extends Error {}

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function missing(error: PostgrestError): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42883" ||
    error.code === "42P01" ||
    /does not exist|Could not find the (function|table)/i.test(error.message)
  );
}

export type AnswerOutcome =
  | { readonly kind: "saved"; readonly id: string }
  | { readonly kind: "closed" }
  | { readonly kind: "slow-down" }
  | { readonly kind: "full" };

export async function answerDateNight(
  slug: string,
  answer: DateNightAnswer,
): Promise<AnswerOutcome> {
  const u = url();
  const k = anon();
  if (!u || !k) throw new NotReady("Supabase is not configured");
  const db = createClient(u, k, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("passport_date_night_answer", {
    p_slug: slug,
    p_answer: answer,
  });
  if (error) {
    if (missing(error)) throw new NotReady(error.message);
    if (error.code === "P0002") return { kind: "closed" };
    if (error.code === "P0001" && error.hint === "full")
      return { kind: "full" };
    if (error.code === "P0001") return { kind: "slow-down" };
    throw new Error(`date night answer: ${error.code} ${error.message}`);
  }
  return { kind: "saved", id: String(data) };
}

export interface StoredAnswer {
  readonly id: string;
  readonly at: string;
  /** As stored. Read through `parseAnswer` before trusting its shape. */
  readonly answer: unknown;
}

export type OwnerView =
  | { readonly state: "signed-out" }
  /** Not this person's night, or not set up yet — Postgres does not say which. */
  | { readonly state: "not-yours"; readonly open: boolean }
  | {
      readonly state: "owner";
      readonly open: boolean;
      readonly answers: readonly StoredAnswer[];
    };

export async function ownerView(slug: string): Promise<OwnerView> {
  if (!url() || !anon()) throw new NotReady("Supabase is not configured");
  const db = await createSupabaseServerClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { state: "signed-out" };

  const night = await db
    .from("passport_date_nights")
    .select("slug, open")
    .eq("slug", slug)
    .maybeSingle();
  if (night.error) {
    if (missing(night.error)) throw new NotReady(night.error.message);
    throw new Error(`date night: ${night.error.message}`);
  }
  if (!night.data) {
    const open = await db.rpc("passport_date_night_open", { p_slug: slug });
    return { state: "not-yours", open: open.data === true };
  }

  const rows = await db
    .from("passport_date_night_answers")
    .select("id, answer, created_at")
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(200);
  if (rows.error) throw new Error(`date night answers: ${rows.error.message}`);
  return {
    state: "owner",
    open: night.data.open === true,
    answers: (rows.data ?? []).map((r) => ({
      id: String(r.id),
      at: String(r.created_at),
      answer: r.answer,
    })),
  };
}
