import { contributor, getPhoto } from "@/lib/contributions/server";

export const dynamic = "force-dynamic";

/** A suggestion's photo, for the administrator alone. 404 to everyone else, and when there is none. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const who = await contributor(request, null).catch(() => null);
  if (!who?.reviewer) return new Response("Not found", { status: 404 });
  if (!/^sug-[a-z0-9]{6,12}$/.test(id))
    return new Response("Not found", { status: 404 });
  const data = await getPhoto(id).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(data, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
