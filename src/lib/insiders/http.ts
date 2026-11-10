import "server-only";
import { NextResponse } from "next/server";
import {
  clientKey,
  rateLimiter,
  tooManyRequests,
} from "@/lib/server/rateLimit";
import { crossSiteRefused, isSameOrigin } from "@/lib/server/sameOrigin";
import { Refused } from "@/domain/insiders/review";
import { NotReady } from "./store";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

const g = globalThis as unknown as {
  __insiderLimits?: Record<
    "read" | "submit" | "flag",
    ReturnType<typeof rateLimiter>
  >;
};

/**
 * Loose limits: a visitor can send a handful of things an hour, an AI reading
 * is the costly one. Keyed on the account when there is one, else the address.
 */
const limits = () =>
  (g.__insiderLimits ??= {
    read: rateLimiter({ limits: [{ max: 20, windowMs: 3_600_000 }] }),
    submit: rateLimiter({
      limits: [
        { max: 3, windowMs: 60_000 },
        { max: 12, windowMs: 3_600_000 },
      ],
    }),
    flag: rateLimiter({ limits: [{ max: 10, windowMs: 3_600_000 }] }),
  });

/** Same-origin, rate limit, JSON body, and errors said in words. */
export async function handle(
  request: Request,
  limit: "read" | "submit" | "flag" | null,
  who: string | null,
  fn: (body: Record<string, unknown>) => Promise<Response>,
): Promise<Response> {
  if (!isSameOrigin(request)) return crossSiteRefused();
  if (limit) {
    const decision = limits()[limit].take(clientKey(request.headers, who));
    if (!decision.ok) return tooManyRequests(decision.retryAfterSeconds);
  }
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
  } catch {
    return json({ error: "Send JSON." }, 400);
  }
  try {
    return await fn(body);
  } catch (e) {
    if (e instanceof Refused) return json({ error: e.message }, e.status);
    if (e instanceof NotReady)
      return json({ error: "not-ready", because: e.message }, 503);
    console.error("insiders-error", e);
    return json({ error: "Something went wrong — try again." }, 500);
  }
}
