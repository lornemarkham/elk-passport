import { NextResponse } from "next/server";
import { adventureSession, visitorDb } from "@/lib/adventures/server";
import { signedVideo } from "../../../../_server/sesh";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * A clip's file: a one-hour signed link, issued only if the caller can see
 * the clip (row-level security decides, as them). A clip someone can't see
 * — taken down, or a younger rider's to a visitor — is the same 404 as one
 * that never existed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const poster = new URL(request.url).searchParams.get("poster") === "1";
  const session = await adventureSession();
  const db = session?.db ?? (await visitorDb());
  const url = await signedVideo(db, id, poster);
  if (!url) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
