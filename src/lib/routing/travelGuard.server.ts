import "server-only";
import { currentUser } from "@/lib/auth/currentUser";
import {
  clientKey,
  rateLimiter,
  tooManyRequests,
  type RateLimiter,
} from "@/lib/server/rateLimit";
import { crossSiteRefused, isSameOrigin } from "@/lib/server/sameOrigin";

/**
 * **Who may make Passport ask Atlas for travel, and how often.**
 *
 * Every travel question can spend Atlas's provider quota — 50
 * openrouteservice requests a day for the whole key, shared by every caller
 * (travel-legs/1) — so the two travel routes, which are anonymous POSTs, and
 * the printed guide, which asks on the server, are bounded here:
 *
 * - **Same origin.** A page on another site cannot drive them (`isSameOrigin`).
 * - **A per-client rate limit**, per server instance (`rateLimit.ts` says
 *   what that does and does not bound). Counted by Supabase user id when
 *   signed in, by client IP when not.
 * - **A session, only when `TRAVEL_REQUIRE_SESSION=1`.** Off by default:
 *   `/go` and Discovery are used signed out (`middleware.ts`, `currentUser`),
 *   and their travel times with them. Whether to require one is the owner's
 *   decision, not this file's.
 *
 * Identical questions are answered from the server's memo before Atlas is
 * reached (`askedOnce` in `answerMemo.ts`); the limit counts them anyway, so
 * a loop is refused whether or not Atlas would have been asked.
 */

/** A day's legs: a page asks once per mode, and again on a revision. */
export const legsLimiter = rateLimiter({
  limits: [
    { max: 20, windowMs: 60_000 },
    { max: 120, windowMs: 60 * 60_000 },
  ],
});

/** A whole feed's travel times from one origin: rarer, and heavier. */
export const discoveryTravelLimiter = rateLimiter({
  limits: [
    { max: 10, windowMs: 60_000 },
    { max: 60, windowMs: 60 * 60_000 },
  ],
});

export const travelRequiresSession = (): boolean =>
  process.env.TRAVEL_REQUIRE_SESSION === "1";

/** The signed-in person's id, or `null` — never a reason to fail the request. */
async function userId(): Promise<string | null> {
  try {
    return (await currentUser())?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * **Whether this caller may ask now**: `undefined` to go ahead, or the
 * response to send instead (403, 401 or 429). Nothing about the question is
 * read here; it is checked before this is called.
 */
export async function guardTravel(
  request: Request,
  limiter: RateLimiter,
): Promise<Response | undefined> {
  if (!isSameOrigin(request)) return crossSiteRefused();
  const decision = await allowTravel(request.headers, limiter);
  if (decision === "sign-in") {
    return Response.json(
      { error: "sign-in" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (decision !== "ok") return tooManyRequests(decision.retryAfterSeconds);
  return undefined;
}

/**
 * The session and rate-limit half, for a caller with headers but no
 * `Request` — the printed guide, which renders on the server.
 */
export async function allowTravel(
  headers: Headers,
  limiter: RateLimiter,
): Promise<"ok" | "sign-in" | { readonly retryAfterSeconds: number }> {
  const id = await userId();
  if (travelRequiresSession() && !id) return "sign-in";
  const decision = limiter.take(clientKey(headers, id));
  return decision.ok ? "ok" : { retryAfterSeconds: decision.retryAfterSeconds };
}
