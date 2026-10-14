import "server-only";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import type { PassportUser } from "@/lib/auth/currentUser";
import { NightError } from "./night";

/**
 * Every Hockey Night route, in one shape: who is asking, then the work.
 *
 * A night someone is not a member of answers exactly like one that does not
 * exist — 404 — so a guessed id learns nothing. Nothing is ever cached: the
 * whole point is that the page changes when somebody else does something.
 */
export async function asMember(
  work: (user: PassportUser) => Promise<unknown>,
): Promise<NextResponse> {
  const who = await requireUser();
  if ("response" in who) return who.response;
  try {
    const body = await work(who.user);
    return NextResponse.json(body ?? { ok: true }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof NightError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[hockey]", error);
    return NextResponse.json({ error: "Something broke." }, { status: 500 });
  }
}

export async function bodyOf(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new NightError("Expected JSON.", 400);
  }
}
