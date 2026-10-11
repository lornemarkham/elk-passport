import { NextResponse } from "next/server";
import { NO_STORE, participantRequest } from "@/lib/sycle/request";
import { ownRecord } from "@/domain/sycle/board";
import { readBoard } from "@/lib/sycle/service";

/** The board as this participant may see it. Polled by the page. */
export async function GET() {
  const gate = await participantRequest();
  if ("response" in gate) return gate.response;
  const view = await readBoard(gate.config, gate.viewerId);
  return NextResponse.json(
    {
      board: view.board,
      me: ownRecord(view.me),
      interest: Object.fromEntries(view.interest),
      expiresAt: view.expiresAt,
    },
    { headers: NO_STORE },
  );
}
