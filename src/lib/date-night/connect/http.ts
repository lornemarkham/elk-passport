import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clientKey,
  rateLimiter,
  tooManyRequests,
} from "@/lib/server/rateLimit";
import { crossSiteRefused, isSameOrigin } from "@/lib/server/sameOrigin";
import {
  NIGHT_TTL_SECONDS,
  NotReady,
  nightStore,
  type NightStore,
} from "./store";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

/** One cookie per night, so two nights in one browser do not meet. */
export const cookieName = (code: string) => `dnp_${code}`;

export async function tokenFor(code: string): Promise<string | null> {
  const jar = await cookies();
  return jar.get(cookieName(code))?.value ?? null;
}

export async function giveToken(code: string, token: string) {
  const jar = await cookies();
  jar.set(cookieName(code), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: NIGHT_TTL_SECONDS,
  });
}

export async function takeToken(code: string) {
  const jar = await cookies();
  jar.delete(cookieName(code));
}

const g = globalThis as unknown as {
  __dnpLimits?: Record<
    "make" | "read" | "act" | "ip",
    ReturnType<typeof rateLimiter>
  >;
};
const limits = () =>
  (g.__dnpLimits ??= {
    make: rateLimiter({ limits: [{ max: 60, windowMs: 3_600_000 }] }),
    // A phone polls every few seconds; two phones may share one address.
    read: rateLimiter({ limits: [{ max: 240, windowMs: 60_000 }] }),
    act: rateLimiter({ limits: [{ max: 120, windowMs: 60_000 }] }),
    ip: rateLimiter({ limits: [{ max: 1_200, windowMs: 60_000 }] }),
  });

/** Same-origin for writes, then the limits. `null` means go ahead. */
export function guard(
  request: Request,
  which: "make" | "read" | "act",
  scope = "",
): Response | null {
  if (which !== "read" && !isSameOrigin(request)) return crossSiteRefused();
  const ip = clientKey(request.headers);
  const wide = limits().ip.take(ip);
  if (!wide.ok) return tooManyRequests(wide.retryAfterSeconds);
  const one = limits()[which].take(`${ip}|${scope}`);
  return one.ok ? null : tooManyRequests(one.retryAfterSeconds);
}

/** A store that is not set up is a 503 with a reason, never a stack trace. */
export async function withStore(
  fn: (store: NightStore) => Promise<Response>,
): Promise<Response> {
  try {
    return await fn(nightStore());
  } catch (e) {
    if (e instanceof NotReady)
      return json({ error: "not-ready", because: e.message }, 503);
    console.error("date-night-play-error", e);
    return json({ error: "failed" }, 500);
  }
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
