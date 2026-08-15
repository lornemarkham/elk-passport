import { NextResponse } from "next/server";

/**
 * Assert region membership for a set of entities.
 *
 * Same proxy reasoning as every other `/api/admin/*` route — `ADMIN_TOKEN`
 * stays server-side. The write itself is `RegionMembershipService`, the
 * same one `define-region` uses.
 */
const ATLAS_BASE_URL = "http://localhost:3000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ regionId: string }> },
) {
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
        headers: { "x-admin-token": token, "Content-Type": "application/json" },
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
