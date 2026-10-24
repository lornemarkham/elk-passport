import { gate } from "@/lib/conference/request";
import {
  photoBytes,
  reactToPhoto,
  removePhoto,
} from "@/lib/conference-memories/service";
import { memoriesDeps } from "@/lib/conference-together/request";
import { body, notFound, reply } from "@/lib/conference-together/respond";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

/**
 * The picture itself, for members allowed to see it. Never public, never
 * cached by anything shared. `?download=1` saves it under a file name a
 * person would keep.
 */
export async function GET(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const { id, photoId } = await params;
  const photo = await photoBytes(memoriesDeps(), g.identity, id, photoId);
  if (!photo) return notFound();
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      ...(download
        ? { "content-disposition": `attachment; filename="${photo.name}"` }
        : {}),
    },
  });
}

/** `{emoji}`: react, or take your reaction back. */
export async function POST(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const { id, photoId } = await params;
  const b = await body(request);
  return reply(
    await reactToPhoto(memoriesDeps(), g.identity, id, photoId, b.emoji),
  );
}

/** Take it down: the person who took it, or an organiser. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const { id, photoId } = await params;
  return reply(await removePhoto(memoriesDeps(), g.identity, id, photoId));
}
