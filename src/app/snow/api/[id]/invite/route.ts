import { NextResponse } from "next/server";
import { answer, requireAdventureSession } from "@/lib/adventures/server";
import { inviteLink } from "../../../_server/shared";

const ID = /^[a-f0-9]{32}$/;

/**
 * A link for the crew to join: host only (Postgres refuses anyone else, and
 * that is a 404). Returns the token once; only its hash is stored. The link
 * works for up to 24 people over 14 days.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ID.test(id))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return answer(async () => {
    const token = await inviteLink(session.db, id, session.user.id);
    return NextResponse.json({ token });
  });
}
