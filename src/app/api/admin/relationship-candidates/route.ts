import { NextResponse } from "next/server";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

// Same proxy reasoning as every other /api/admin/* route — ADMIN_TOKEN
// stays server-side.
const ATLAS_BASE_URL = "http://localhost:3000";

export async function GET() {
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

  const response = await fetch(
    `${ATLAS_BASE_URL}/admin/relationship-candidates`,
    {
      headers: atlasAuthHeaders({ "x-admin-token": token }),
      cache: "no-store",
    },
  );

  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
