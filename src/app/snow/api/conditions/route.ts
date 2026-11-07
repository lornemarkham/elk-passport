import { mountainById } from "@/domain/snow/mountains";
import { conditionsFor } from "../../_server/conditions";

/**
 * `GET /snow/api/conditions?mountain=<id>` — the forecast for one of
 * Passport's known ski areas. Public, no account, nothing stored. 404 for an
 * id we do not hold; 502 when the weather service did not answer (the
 * screen shows its last good answer, labelled with its age).
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("mountain") ?? "";
  if (!/^[a-z0-9-]{1,40}$/.test(id))
    return Response.json({ error: "mountain" }, { status: 400 });
  const c = await conditionsFor(id);
  if (!c) {
    const known = mountainById(id);
    return Response.json(
      { error: known ? "unreachable" : "unknown" },
      { status: known ? 502 : 404 },
    );
  }
  return Response.json(
    { conditions: c },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
