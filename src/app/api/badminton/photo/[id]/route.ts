import { guarded, json, playerCookie } from "@/lib/courtqueue/http";
import { readPhoto, whoIs } from "@/lib/courtqueue/service";

export const dynamic = "force-dynamic";

/** Players' pictures are for players: signed in only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return guarded(async () => {
    if (!(await whoIs(await playerCookie())))
      return json({ error: "Sign in first." }, 401);
    const photo = await readPhoto(id);
    if (!photo) return json({ error: "No picture." }, 404);
    return new Response(new Uint8Array(photo.bytes), {
      headers: {
        "Content-Type": photo.type,
        "Cache-Control": "private, max-age=300",
      },
    });
  });
}
