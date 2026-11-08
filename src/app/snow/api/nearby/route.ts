import { mountainById } from "@/domain/snow/mountains";
import { atlasNear } from "../../_server/atlas";

/**
 * `GET /snow/api/nearby?mountain=<id>` — the Atlas places, activities and
 * events around one of Passport's mountains, sorted for a snow day, with
 * what Atlas is missing. Public, no account, nothing stored. 404 for a
 * mountain Passport doesn't list; `unavailable` (200) when Atlas didn't
 * answer, which the screen words differently from "Atlas has nothing".
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("mountain") ?? "";
  if (!/^[a-z0-9-]{1,40}$/.test(id))
    return Response.json({ error: "mountain" }, { status: 400 });
  const mountain = mountainById(id);
  if (!mountain) return Response.json({ error: "unknown" }, { status: 404 });
  const near = await atlasNear(mountain).catch(
    () =>
      ({ status: "unavailable", picks: [], gaps: [], request: "" }) as const,
  );
  return Response.json(near, {
    headers: {
      "cache-control":
        near.status === "connected" ? "public, max-age=600" : "no-store",
    },
  });
}
