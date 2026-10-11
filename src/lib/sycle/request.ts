import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, verify } from "./access";
import { sycleSetup, type SycleConfig } from "./config";

/**
 * The gate every Sycle route handler starts with: the experience is open, and
 * the caller holds a valid participant cookie. Returns the response to send
 * instead when either is untrue — 503 for "not set up", 401 for "no code yet".
 */
export async function participantRequest(): Promise<
  { config: SycleConfig; viewerId: string } | { response: NextResponse }
> {
  const setup = sycleSetup();
  if (!setup.open)
    return {
      response: NextResponse.json({ error: "closed" }, { status: 503 }),
    };
  const viewerId = verify(
    setup.config.secret,
    (await cookies()).get(COOKIE)?.value,
  );
  if (!viewerId)
    return {
      response: NextResponse.json({ error: "code-needed" }, { status: 401 }),
    };
  return { config: setup.config, viewerId };
}

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;
