import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clientKey,
  rateLimiter,
  tooManyRequests,
} from "@/lib/server/rateLimit";
import { crossSiteRefused, isSameOrigin } from "@/lib/server/sameOrigin";
import { isDevice, newDevice } from "./service";
import { NotReady, pulseKey, pulseStore, type PulseStore } from "./store";

export const DEVICE_COOKIE = "pulse_device";
export const NO_STORE = { "Cache-Control": "no-store" } as const;

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

/**
 * This browser's random id, made on first use. httpOnly: page script never
 * sees it, and it is hashed before anything stores it.
 */
export async function device(): Promise<string> {
  const jar = await cookies();
  const have = jar.get(DEVICE_COOKIE)?.value;
  if (isDevice(have)) return have;
  const made = newDevice();
  jar.set(DEVICE_COOKIE, made, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return made;
}

/** The device id if this browser already has one; never sets a cookie. */
export async function existingDevice(): Promise<string | null> {
  const have = (await cookies()).get(DEVICE_COOKIE)?.value;
  return isDevice(have) ? have : null;
}

export function ipOf(request: Request): string {
  return clientKey(request.headers);
}

/** The store and key, or a 503 saying what the owner still has to set up. */
export async function guarded(
  fn: (store: PulseStore, key: string) => Promise<Response>,
): Promise<Response> {
  try {
    const store = pulseStore();
    const key = pulseKey();
    if (!key) throw new NotReady("no server key");
    return await fn(store, key);
  } catch (e) {
    if (e instanceof NotReady)
      return json({ error: "not-ready", because: e.message }, 503);
    console.error("pulse-error", e);
    return json({ error: "Something went wrong — try again." }, 500);
  }
}

type Limit = "read" | "create" | "vote" | "report" | "check" | "event" | "ip";

const g = globalThis as unknown as {
  __pulseLimits?: Record<Limit, ReturnType<typeof rateLimiter>>;
};

/**
 * Per-instance counters, a first line only: the database's per-network vote
 * cap and daily creation limit are the ones a busy script meets everywhere.
 */
const limits = () =>
  (g.__pulseLimits ??= {
    read: rateLimiter({ limits: [{ max: 240, windowMs: 60_000 }] }),
    create: rateLimiter({
      limits: [
        { max: 4, windowMs: 600_000 },
        { max: 12, windowMs: 86_400_000 },
      ],
    }),
    vote: rateLimiter({ limits: [{ max: 60, windowMs: 60_000 }] }),
    report: rateLimiter({ limits: [{ max: 10, windowMs: 3_600_000 }] }),
    // Usage counts: generous for a person, useless for inflating numbers.
    event: rateLimiter({
      limits: [
        { max: 20, windowMs: 60_000 },
        { max: 200, windowMs: 86_400_000 },
      ],
    }),
    // A source check opens a stranger's web page, so it is the dearest call.
    check: rateLimiter({
      limits: [
        { max: 4, windowMs: 300_000 },
        { max: 20, windowMs: 86_400_000 },
      ],
    }),
    ip: rateLimiter({ limits: [{ max: 2_000, windowMs: 60_000 }] }),
  });

export function guardRequest(request: Request, which: Limit): Response | null {
  if (request.method !== "GET" && !isSameOrigin(request))
    return crossSiteRefused();
  const ip = ipOf(request);
  const backstop = limits().ip.take(ip);
  if (!backstop.ok) return tooManyRequests(backstop.retryAfterSeconds);
  const d = limits()[which].take(ip);
  return d.ok ? null : tooManyRequests(d.retryAfterSeconds);
}

/** Tests only. */
export function clearPulseLimits() {
  g.__pulseLimits = undefined;
}

export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (text.length > 20_000) return {};
    const body = JSON.parse(text);
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
