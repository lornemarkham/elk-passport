import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clientKey,
  rateLimiter,
  tooManyRequests,
} from "@/lib/server/rateLimit";
import { crossSiteRefused, isSameOrigin } from "@/lib/server/sameOrigin";
import { NotReady, fairview3Store, type Fairview3Store } from "./store";

/** The presenter's key travels in an httpOnly cookie after one sign-in. */
export const PRESENTER_COOKIE = "fv3_presenter";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

/**
 * Every handler runs inside this: a database the owner has not set up yet is
 * a 503 with a reason, not a stack trace — the audience page keeps showing
 * the story on its own defaults, and the presenter console says what to do.
 */
export async function withStore(
  fn: (store: Fairview3Store) => Promise<Response>,
): Promise<Response> {
  try {
    return await fn(fairview3Store());
  } catch (e) {
    if (e instanceof NotReady)
      return json({ error: "not-ready", because: e.message }, 503);
    console.error("fairview3-error", e);
    return json({ error: "failed" }, 500);
  }
}

export async function presenterKey(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(PRESENTER_COOKIE)?.value ?? null;
}

const g = globalThis as unknown as {
  __fv3RateLimits?: Record<
    "participant" | "feedback" | "qa" | "ip" | "login" | "presenter",
    ReturnType<typeof rateLimiter>
  >;
};

/**
 * Per instance, per client; see rateLimit.ts for what that does and does not
 * bound. **Keyed on the participant, not the address**: the whole room sits
 * behind one conference Wi-Fi NAT, so 140 phones can share one IP, and a
 * per-IP limit tight enough to matter would have refused the room's votes
 * (it did, in rehearsal). The per-IP backstop is loose on purpose.
 */
export const limits = () =>
  (g.__fv3RateLimits ??= {
    // Four ballots and a change of mind each, upvotes, presence pings.
    participant: rateLimiter({ limits: [{ max: 90, windowMs: 60_000 }] }),
    feedback: rateLimiter({
      limits: [
        { max: 6, windowMs: 60_000 },
        { max: 20, windowMs: 3_600_000 },
      ],
    }),
    qa: rateLimiter({
      limits: [
        { max: 5, windowMs: 60_000 },
        { max: 20, windowMs: 3_600_000 },
      ],
    }),
    ip: rateLimiter({ limits: [{ max: 3_000, windowMs: 60_000 }] }),
    // A wrong key, tried many times, from one place.
    login: rateLimiter({ limits: [{ max: 10, windowMs: 60_000 }] }),
    presenter: rateLimiter({ limits: [{ max: 300, windowMs: 60_000 }] }),
  });

/**
 * Same-origin plus rate limits, the way every public POST here is guarded.
 * `participant` is the phone's own id when the body carries one.
 */
export function guardPublicPost(
  request: Request,
  which: "participant" | "feedback" | "qa" | "login" | "presenter",
  participant?: string,
): Response | null {
  if (!isSameOrigin(request)) return crossSiteRefused();
  const ip = clientKey(request.headers);
  const backstop = limits().ip.take(ip);
  if (!backstop.ok) return tooManyRequests(backstop.retryAfterSeconds);
  const key =
    which === "login" || which === "presenter" ? ip : (participant ?? ip);
  const decision = limits()[which].take(key);
  return decision.ok ? null : tooManyRequests(decision.retryAfterSeconds);
}

export async function readJson(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
