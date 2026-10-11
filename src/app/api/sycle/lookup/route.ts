import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, participantRequest } from "@/lib/sycle/request";
import { lookUp } from "@/lib/sycle/service";

/** Candidate flights for a number and date. Participants only: it costs money. */
export async function POST(request: NextRequest) {
  const gate = await participantRequest();
  if ("response" in gate) return gate.response;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const result = await lookUp(gate.config, body.flightNumber, body.date);
  const status = result.ok ? 200 : result.reason === "invalid" ? 400 : 502;
  return NextResponse.json(result, { status, headers: NO_STORE });
}
