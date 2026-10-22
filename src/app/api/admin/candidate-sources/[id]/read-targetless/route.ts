import { NextResponse } from "next/server";
import { ATLAS_BASE_URL, atlasAuthHeaders } from "@/lib/data/atlasAuth";
import { requireAdminApi } from "@/lib/admin/requireAdmin";

/**
 * Read a queued source about something Atlas does not hold yet.
 *
 * Separate from targeted processing on purpose (ADR 031 Amendment 2) —
 * the two ask opposite questions and end in different things.
 */

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const { id } = await params;
  try {
    const response = await fetch(
      `${ATLAS_BASE_URL}/admin/candidate-sources/${encodeURIComponent(id)}/read-targetless`,
      { method: "POST", headers: atlasAuthHeaders({ "x-admin-token": token }) },
    );
    // A 404 here means the running API predates this route, not that the
    // candidate is missing. Forwarding it verbatim sends a curator hunting
    // for a data problem that does not exist.
    if (response.status === 404) {
      return NextResponse.json(
        {
          error:
            "The running Atlas API does not have this endpoint yet. Restart it with `npm run api` to pick up new routes.",
        },
        { status: 503 },
      );
    }
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
