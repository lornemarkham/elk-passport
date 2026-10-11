import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/sycle/access";
import { NO_STORE, participantRequest } from "@/lib/sycle/request";
import { forgetMe, saveMine } from "@/lib/sycle/service";

export async function PUT(request: NextRequest) {
  const gate = await participantRequest();
  if ("response" in gate) return gate.response;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const result = await saveMine(gate.config, gate.viewerId, body);
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: NO_STORE,
  });
}

/** Delete everything about me, and the cookie that pointed at it. */
export async function DELETE() {
  const gate = await participantRequest();
  if ("response" in gate) return gate.response;
  await forgetMe(gate.viewerId);
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.delete(COOKIE);
  return response;
}
