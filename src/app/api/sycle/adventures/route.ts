import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, participantRequest } from "@/lib/sycle/request";
import { setInterest } from "@/lib/sycle/service";

/** "I'm in" / "I'm out" for one Atlas subject. */
export async function POST(request: NextRequest) {
  const gate = await participantRequest();
  if ("response" in gate) return gate.response;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const ok = await setInterest(
    gate.viewerId,
    body.adventureId,
    body.in === true,
  );
  return NextResponse.json(
    { ok },
    { status: ok ? 200 : 400, headers: NO_STORE },
  );
}
