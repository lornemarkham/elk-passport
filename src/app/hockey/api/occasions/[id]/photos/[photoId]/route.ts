import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { asMember } from "../../../../../_server/respond";
import { NightError } from "../../../../../_server/night";
import { photoBytes, removePhoto } from "../../../../../_server/memories";

export const dynamic = "force-dynamic";

/** One picture. Private to the night: a stranger gets a 404, not an image. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await params;
  const who = await requireUser();
  if ("response" in who) return who.response;
  try {
    const bytes = await photoBytes(who.user, id, photoId);
    if (!bytes)
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof NightError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error("[hockey]", error);
    return NextResponse.json({ error: "Something broke." }, { status: 500 });
  }
}

/** Take a photo down: the one who took it, or the host. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await params;
  return asMember((user) => removePhoto(user, id, photoId));
}
