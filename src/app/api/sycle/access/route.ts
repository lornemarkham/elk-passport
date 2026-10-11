import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE,
  blocked,
  codeMatches,
  issue,
  recordFailure,
} from "@/lib/sycle/access";
import { sycleSetup } from "@/lib/sycle/config";

/** Trade the conference code for a participant cookie. */
export async function POST(request: NextRequest) {
  const setup = sycleSetup();
  if (!setup.open)
    return NextResponse.json({ error: "closed" }, { status: 503 });

  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (blocked(address))
    return NextResponse.json({ error: "slow-down" }, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  if (!codeMatches(setup.config.accessCode, body.code)) {
    recordFailure(address);
    return NextResponse.json({ error: "wrong-code" }, { status: 403 });
  }

  const { value } = issue(setup.config.secret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: setup.config.expiresAt,
  });
  return response;
}
