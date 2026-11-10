import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clientKey,
  rateLimiter,
  tooManyRequests,
} from "@/lib/server/rateLimit";
import { crossSiteRefused, isSameOrigin } from "@/lib/server/sameOrigin";
import { NotReady, PLAYER_COOKIE } from "./service";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

export async function playerCookie(): Promise<string | undefined> {
  return (await cookies()).get(PLAYER_COOKIE)?.value;
}

export async function setPlayerCookie(value: string | null) {
  const jar = await cookies();
  if (value === null) jar.delete(PLAYER_COOKIE);
  else
    jar.set(PLAYER_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
}

/** A database the owner has not set up yet is a 503 with a reason. */
export async function guarded(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotReady)
      return json({ error: "not-ready", because: e.message }, 503);
    console.error("courtqueue-error", e);
    return json({ error: "Something went wrong — try again." }, 500);
  }
}

const g = globalThis as unknown as {
  __cqLimits?: Record<
    "post" | "register" | "signin" | "organizer" | "ip",
    ReturnType<typeof rateLimiter>
  >;
};

/**
 * **A whole gym shares one Wi-Fi address**, so nothing a crowd does at once
 * is limited per address except a loose backstop: actions are keyed on the
 * player, sign-ins on the name being tried (a 4-digit PIN can't be guessed
 * at 30 tries an hour), and registering allows a room full of people.
 */
const limits = () =>
  (g.__cqLimits ??= {
    post: rateLimiter({ limits: [{ max: 120, windowMs: 60_000 }] }),
    register: rateLimiter({ limits: [{ max: 60, windowMs: 60_000 }] }),
    signin: rateLimiter({
      limits: [
        { max: 8, windowMs: 60_000 },
        { max: 30, windowMs: 3_600_000 },
      ],
    }),
    organizer: rateLimiter({ limits: [{ max: 10, windowMs: 600_000 }] }),
    ip: rateLimiter({ limits: [{ max: 6_000, windowMs: 60_000 }] }),
  });

export function guardPost(
  request: Request,
  which: "post" | "register" | "signin" | "organizer",
  key: string | undefined,
): Response | null {
  if (!isSameOrigin(request)) return crossSiteRefused();
  const ip = clientKey(request.headers);
  const backstop = limits().ip.take(ip);
  if (!backstop.ok) return tooManyRequests(backstop.retryAfterSeconds);
  const who =
    which === "post"
      ? (key?.split(".")[0] ?? ip)
      : which === "signin"
        ? `name:${key ?? ""}`
        : ip;
  const d = limits()[which].take(who);
  return d.ok ? null : tooManyRequests(d.retryAfterSeconds);
}

export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (text.length > 200_000) return {};
    const body = JSON.parse(text);
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
