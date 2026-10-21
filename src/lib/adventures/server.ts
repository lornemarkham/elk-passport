import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/requireUser";
import { currentUser, type PassportUser } from "@/lib/auth/currentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Refused, Unavailable } from "./store";

/**
 * **The one way a route or page gets at adventures: as the signed-in person.**
 *
 * The client is Passport's ordinary server client — anon key plus the
 * caller's session cookie — so every query runs under row-level security as
 * that person. No service-role key exists in this path, by design.
 */
export interface AdventureSession {
  readonly user: PassportUser;
  readonly db: SupabaseClient;
}

/** For route handlers: the session, or the 401 to return instead. */
export async function requireAdventureSession(): Promise<
  AdventureSession | { response: NextResponse }
> {
  const auth = await requireUser();
  if ("response" in auth) return auth;
  return {
    user: auth.user,
    db: (await createSupabaseServerClient()) as unknown as SupabaseClient,
  };
}

/** For pages: the session, or `null` for a visitor. */
export async function adventureSession(): Promise<AdventureSession | null> {
  const user = await currentUser().catch(() => null);
  if (!user) return null;
  return {
    user,
    db: (await createSupabaseServerClient()) as unknown as SupabaseClient,
  };
}

/** A database client for a visitor: enough to describe an invite link. */
export async function visitorDb(): Promise<SupabaseClient> {
  return (await createSupabaseServerClient()) as unknown as SupabaseClient;
}

/**
 * Turn the store's two failures into HTTP.
 *
 * `Refused` is 404 whether the thing is missing or not yours, so probing ids
 * teaches nothing. `Unavailable` is 503 — Passport could not ask, which is
 * different from the answer being no.
 */
export async function answer(
  work: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Refused) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (error instanceof Unavailable) {
      return NextResponse.json(
        { error: "Adventures can't be reached right now." },
        { status: 503 },
      );
    }
    throw error;
  }
}

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

export async function bodyOf(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
