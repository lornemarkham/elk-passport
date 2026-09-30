import { NextResponse } from "next/server";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

/**
 * Start region-scoped growth. Same proxy reasoning as every other
 * `/api/admin/*` route — `ADMIN_TOKEN` stays server-side and the browser
 * only ever talks to this same-origin route.
 *
 * Atlas answers in milliseconds with a run id and does the work in the
 * background, so this deliberately carries **no timeout**: there is
 * nothing long to wait for. Progress is read afterwards from the run's
 * own events.
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
      `${ATLAS_BASE_URL}/admin/regions/${encodeURIComponent(regionId)}/grow`,
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
    // Never a silent failure: the workspace shows this sentence verbatim,
    // because a button that appears to do nothing is the exact experience
    // this whole surface exists to prevent.
    return NextResponse.json(
      {
        error: `Atlas is unreachable at ${ATLAS_BASE_URL}: ${(error as Error).message}`,
      },
      { status: 503 },
    );
  }
}
