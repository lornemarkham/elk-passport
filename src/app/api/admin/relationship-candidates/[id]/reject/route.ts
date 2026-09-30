import { NextResponse } from "next/server";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

// Same proxy reasoning as every other /api/admin/* route — ADMIN_TOKEN
// stays server-side.
const ATLAS_BASE_URL = "http://localhost:3000";

export async function POST(
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

  const response = await fetch(
    `${ATLAS_BASE_URL}/admin/relationship-candidates/${encodeURIComponent(id)}/reject`,
    {
      method: "POST",
      headers: atlasAuthHeaders({ "x-admin-token": token }),
    },
  );

  const responseBody = await response.json();
  return NextResponse.json(responseBody, { status: response.status });
}
