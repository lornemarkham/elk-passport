import { getPhoto, readLights, viewer } from "../../../../_server/lights";
import { canSee } from "@/domain/christmas/lights/model";

export const dynamic = "force-dynamic";

/** A pin's photo, to whoever may see the pin — never a pending home's to the public. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const [{ doc }, v] = await Promise.all([readLights(), viewer()]);
    const pin = doc.pins.find((p) => p.id === id);
    if (!pin?.photo || !canSee(pin, v))
      return new Response("Not found", { status: 404 });
    const data = await getPhoto(pin.photo);
    if (!data) return new Response("Not found", { status: 404 });
    return new Response(Buffer.from(data, "base64"), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control":
          pin.status === "approved"
            ? "public, max-age=300"
            : "private, no-store",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 503 });
  }
}
