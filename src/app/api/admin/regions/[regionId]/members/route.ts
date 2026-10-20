import { NextResponse } from "next/server";
import { ATLAS_BASE_URL, atlasAuthHeaders } from "@/lib/data/atlasAuth";
import { requireAdminApi } from "@/lib/admin/requireAdmin";

/**
 * Assert region membership for a set of entities.
 *
 * Same proxy reasoning as every other `/api/admin/*` route — `ADMIN_TOKEN`
 * stays server-side. The write itself is `RegionMembershipService`, the
 * same one `define-region` uses.
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ regionId: string }> },
) {
  const access = await requireAdminApi();
  if ("response" in access) return access.response;

  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured for this app." },
      { status: 503 },
    );
  }

  const { regionId } = await params;
  const body = await request.text();

  try {
    const response = await fetch(
      `${ATLAS_BASE_URL}/admin/regions/${encodeURIComponent(regionId)}/members`,
      {
        method: "POST",
        headers: atlasAuthHeaders({
          "x-admin-token": token,
          "Content-Type": "application/json",
        }),
        body: body || "{}",
      },
    );
    return NextResponse.json(await response.json(), {
      status: response.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Atlas is unreachable: ${(error as Error).message}` },
      { status: 503 },
    );
  }
}
