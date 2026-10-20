import "server-only";
import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safeNext";
import { adminVerdict, statusFor, type AdminVerdict } from "./adminPolicy";

/**
 * **The server-side gate for the curator workbench.**
 *
 * Middleware is the first door; this is the second, and it is the one that
 * cannot be skipped by a route the matcher forgot. Every `/api/admin/*`
 * handler, every admin server action and the admin layouts call it. The token
 * Atlas wants is attached to the outgoing request *after* this passes, so a
 * person who is not an administrator never causes `ADMIN_TOKEN` to be sent
 * anywhere.
 *
 * `getUser()` and not `getSession()`: the cookie claiming an identity is not
 * Supabase confirming it, and this decides who may change the corpus.
 */
export async function adminVerdictForRequest(): Promise<AdminVerdict> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return adminVerdict(user);
}

const MESSAGE = {
  "signed-out": "Sign in to continue.",
  unverified: "Verify your email address to continue.",
  "not-approved": "Forbidden.",
  "not-configured": "Forbidden.",
} as const;

/** For route handlers: the administrator, or the response to return instead. */
export async function requireAdminApi(): Promise<
  { admin: { email: string } } | { response: NextResponse }
> {
  const verdict = await adminVerdictForRequest();
  if (verdict.ok) return { admin: { email: verdict.email } };

  return {
    response: NextResponse.json(
      { error: MESSAGE[verdict.reason], code: "ADMIN_ACCESS_DENIED" },
      {
        status: statusFor(verdict.reason),
        headers: { "Cache-Control": "no-store" },
      },
    ),
  };
}

/**
 * For server components and layouts. Signed out goes to sign-in and back;
 * anyone else gets the ordinary 404, so the workbench does not announce
 * itself to a signed-in stranger.
 */
export async function requireAdminPage(returnTo: string): Promise<void> {
  const verdict = await adminVerdictForRequest();
  if (verdict.ok) return;
  if (verdict.reason === "signed-out") {
    redirect(`/auth?next=${encodeURIComponent(safeNext(returnTo, "/admin"))}`);
  }
  notFound();
}

/** For server actions, which are public POST endpoints whatever page hosts them. */
export async function requireAdminAction(): Promise<void> {
  const verdict = await adminVerdictForRequest();
  if (!verdict.ok) throw new Error("Forbidden.");
}
