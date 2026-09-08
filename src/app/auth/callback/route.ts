import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safeNext";

/**
 * **Where every link from an email or an identity provider lands.**
 *
 * `@supabase/ssr` uses the PKCE flow, so a recovery email and a Google sign-in
 * both come back as `?code=...` rather than as tokens in the URL fragment. The
 * exchange has to happen somewhere that can *write* cookies, which is a route
 * handler — a Server Component cannot, and doing it in the browser would put
 * the session back in JavaScript's hands after all the work to get it into a
 * cookie the server can read.
 *
 * ## Why the redirect target is validated here and not trusted
 *
 * `next` arrives from a URL somebody may have been sent. An unvalidated one
 * turns this route into an open redirect **that fires immediately after a
 * successful sign-in**, which is the most valuable possible moment to hand
 * somebody to an attacker's page. `safeNext` allows same-site paths only.
 *
 * ## Failure is a message, not a stack trace
 *
 * An expired or reused recovery link is the ordinary case — people click them
 * twice, or a day later — so it returns to the sign-in screen with a reason,
 * never a 500.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  // Supabase reports provider-side refusals this way, e.g. a cancelled Google
  // consent screen. It is not an error worth alarming anyone about.
  const providerError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(
      new URL(`/auth?notice=${encodeURIComponent(providerError)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth?notice=link-incomplete", url.origin),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/auth?notice=link-expired", url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
