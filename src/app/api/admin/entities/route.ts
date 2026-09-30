import { NextRequest, NextResponse } from "next/server";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

// Same proxy reasoning as ../relationships/route.ts — ADMIN_TOKEN stays
// server-side, the browser only ever talks to this same-origin route.
// `includeArchived` is passed straight through — this route's only job is
// keeping the token off the client, not deciding what to fetch.
const ATLAS_BASE_URL = "http://localhost:3000";

export async function GET(request: NextRequest) {
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

  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "true";
  const response = await fetch(
    `${ATLAS_BASE_URL}/admin/entities?includeArchived=${includeArchived}`,
    {
      headers: atlasAuthHeaders({ "x-admin-token": token }),
      cache: "no-store",
    },
  );

  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
