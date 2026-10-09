import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  EXPERIENCE_HEADER,
  EXPERIENCE_PATH_HEADER,
  activeExperience,
  experienceRewriteFor,
} from "@/lib/domains/experience-domains";

/**
 * **Keeps the session cookie fresh so the server can trust it.**
 *
 * A Supabase access token expires in an hour. Without something refreshing it
 * on the way past, a person who signed in yesterday is silently anonymous
 * today — their boards vanish and nothing explains why. The refresh has to
 * happen somewhere that can *write* cookies, and a Server Component cannot, so
 * it happens here.
 *
 * ## This is not route protection
 *
 * Nothing is blocked. Passport gives before it asks: Discovery, search and
 * detail pages are all fully usable signed out, and this middleware runs on
 * them purely to keep an existing session alive. Authorization lives in the
 * `/api/boards/*` handlers, which resolve the user themselves and refuse
 * anonymously — a middleware allowlist would be a second, drifting copy of
 * that decision.
 *
 * `getUser()` is called rather than skipped because it is the call that
 * triggers the refresh; discarding the result is intentional.
 */
export async function middleware(request: NextRequest) {
  // An experience domain's root is served by its experience's route; see
  // `experience-domains.ts`. The session refresh below applies either way.
  const rewriteTo = experienceRewriteFor(
    request.headers.get("host"),
    request.nextUrl.pathname,
  );
  //
  // The rewrite is also *stated*, so a server component can tell that this
  // render is a domain's front door rather than the path the browser shows.
  // The header is set or removed on every request and never merely read: an
  // incoming one is a forgery, and leaving it in place would let a caller
  // light up the wrong tab in October's navigation.
  const headers = new Headers(request.headers);
  if (rewriteTo) headers.set(EXPERIENCE_PATH_HEADER, rewriteTo);
  else headers.delete(EXPERIENCE_PATH_HEADER);

  // **And which experience the request belongs to at all**, which the shared
  // account and auth pages need before their first paint. Decided from the
  // host and, where the host is ordinary Passport, from where the page was
  // told to return to — `elk-passport.vercel.app/auth?next=/october/discover`
  // is somebody signing into October. Same forgery rule as above.
  const experience = activeExperience({
    host: request.headers.get("host"),
    next:
      request.nextUrl.searchParams.get("next") ??
      rewriteTo ??
      request.nextUrl.pathname,
  });
  if (experience) headers.set(EXPERIENCE_HEADER, experience.host);
  else headers.delete(EXPERIENCE_HEADER);

  const response = rewriteTo
    ? NextResponse.rewrite(new URL(rewriteTo, request.url), {
        request: { headers },
      })
    : NextResponse.next({ request: { headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own plumbing and static files. `_next` is
    // excluded whole rather than the usual `_next/static|_next/image` pair:
    // the dev HMR websocket lives under `_next` too, and running a cookie
    // refresh across its upgrade request silently breaks hot reload — which
    // presents as a Suspense boundary that never resolves, not as an error.
    "/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
