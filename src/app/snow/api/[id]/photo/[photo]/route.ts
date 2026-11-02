import { NextResponse } from "next/server";
import { answer, requireAdventureSession } from "@/lib/adventures/server";
import { photoOf } from "../../../../_server/shared";

const ID = /^[a-f0-9]{32}$/;
const UUID = /^[0-9a-f-]{36}$/;

/**
 * One shared picture, for a member of the day only: Postgres is asked as the
 * caller, so a stranger (or a guessed id) gets the same 404 as a missing one.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; photo: string }> },
) {
  const { id, photo } = await params;
  if (!ID.test(id) || !UUID.test(photo))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return answer(async () => {
    const dataUrl = await photoOf(session.db, id, photo);
    const m = /^data:(image\/[a-z+.-]+);base64,([\s\S]+)$/.exec(dataUrl);
    if (!m) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return new NextResponse(Buffer.from(m[2], "base64"), {
      headers: {
        "Content-Type": m[1],
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
