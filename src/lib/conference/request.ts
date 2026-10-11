import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/currentUser";
import type { ConferenceContext } from "@/domain/conference/contracts";
import type { IdentityKey } from "@/domain/conference/types";
import { conferenceSetup, type ConferenceConfig } from "./config";
import {
  GUEST_COOKIE,
  GUEST_COOKIE_DAYS,
  identityFrom,
  issueGuest,
} from "./identity";
import { LIFECYCLE } from "./lifecycle";
import { contextFor, type Deps, type Failure } from "./service";
import { store } from "./store";

/**
 * **The glue between Next and the conference service.** Pages and route
 * handlers get identity, configuration and dependencies from here, and a
 * module gets its `ConferenceContext` from `conferenceContext`. Nothing else
 * reads the guest cookie.
 */

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export const deps = (): Deps => ({
  store: store(),
  lifecycle: LIFECYCLE,
  now: new Date(),
});

/** The viewer's identity, or `null` for somebody who has never joined anything. */
export async function readIdentity(
  config: ConferenceConfig,
): Promise<IdentityKey | null> {
  const [user, jar] = await Promise.all([currentUser(), cookies()]);
  return identityFrom(
    user?.id ?? null,
    jar.get(GUEST_COOKIE)?.value,
    config.secret,
  );
}

/**
 * For a module's page or route: the context for this member, or `null` when
 * conferences are closed, the viewer has no identity, or they are not in it.
 * Every one of those reads, to a module, as `notFound()`.
 */
export async function conferenceContext(
  conferenceId: string,
): Promise<ConferenceContext | null> {
  const setup = conferenceSetup();
  if (!setup.open) return null;
  const identity = await readIdentity(setup.config);
  if (!identity) return null;
  return contextFor(deps(), identity, conferenceId);
}

const STATUS: Record<Failure | "closed" | "signed-out" | "slow-down", number> =
  {
    closed: 503,
    "signed-out": 401,
    "not-found": 404,
    forbidden: 403,
    invalid: 400,
    "wrong-code": 403,
    "dead-link": 403,
    "slow-down": 429,
    "last-organiser": 409,
  };

export const errorResponse = (
  error: keyof typeof STATUS,
  issues?: readonly { path: string; message: string }[],
) =>
  NextResponse.json(
    { error, ...(issues ? { issues } : {}) },
    { status: STATUS[error], headers: NO_STORE },
  );

export const okResponse = (body: object) =>
  NextResponse.json({ ok: true, ...body }, { headers: NO_STORE });

/**
 * The gate a route handler starts with. `needIdentity: "existing"` answers
 * 401 for somebody with none; `"issue"` mints a guest identity, which the
 * caller must hand back through `withGuestCookie` on the response.
 */
export async function gate(needIdentity: "existing" | "issue"): Promise<
  | { response: NextResponse }
  | {
      config: ConferenceConfig;
      identity: IdentityKey;
      issued: string | null;
    }
> {
  const setup = conferenceSetup();
  if (!setup.open) return { response: errorResponse("closed") };
  const identity = await readIdentity(setup.config);
  if (identity) return { config: setup.config, identity, issued: null };
  if (needIdentity === "existing")
    return { response: errorResponse("signed-out") };
  const guest = issueGuest(setup.config.secret);
  return {
    config: setup.config,
    identity: guest.identity,
    issued: guest.value,
  };
}

export function withGuestCookie(
  response: NextResponse,
  issued: string | null,
): NextResponse {
  if (issued)
    response.cookies.set(GUEST_COOKIE, issued, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_COOKIE_DAYS * 86_400,
    });
  return response;
}

export const clientAddress = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
