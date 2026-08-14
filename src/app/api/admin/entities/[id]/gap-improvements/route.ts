import { NextResponse } from "next/server";

// Same proxy reasoning as every other /api/admin/* route — ADMIN_TOKEN
// stays server-side.
const ATLAS_BASE_URL = "http://localhost:3000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error: "ADMIN_TOKEN is not configured for this app.",
        code: "ADMIN_TOKEN_MISSING",
      },
      { status: 503 },
    );
  }

  const { id } = await params;

  // Same cold-start protection as /api/admin/content-health — see that
  // route's own comment. Real for this route too: it's the one a curator
  // hits by clicking "Why this score?" moments after a fresh dev start.
  let response: Response;
  try {
    response = await fetch(
      `${ATLAS_BASE_URL}/admin/entities/${encodeURIComponent(id)}/gap-improvements`,
      {
        headers: { "x-admin-token": token },
        cache: "no-store",
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not reach Atlas. It may still be starting up.",
        code: "ATLAS_UNREACHABLE",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }

  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
