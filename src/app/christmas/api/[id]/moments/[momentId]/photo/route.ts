import { NextResponse } from "next/server";
import { requireAdventureSession } from "@/lib/adventures/server";
import { photoOf } from "../../../../../_server/together";
import { together } from "../../../../../_server/http";

type Context = { params: Promise<{ id: string; momentId: string }> };

/**
 * One shared photo, as a JPEG, to members only. Private and immutable (a
 * moment is never edited), so the browser may keep it.
 */
export async function GET(_request: Request, { params }: Context) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { id, momentId } = await params;
  return together(async () => {
    const photo = await photoOf(session.db, id, momentId);
    if (!photo)
      return NextResponse.json({ error: "No photo." }, { status: 404 });
    return new NextResponse(Buffer.from(photo, "base64"), {
      headers: {
        "content-type": "image/jpeg",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
        "cache-control": "private, max-age=86400, immutable",
      },
    });
  });
}
