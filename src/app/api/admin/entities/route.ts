import { NextRequest, NextResponse } from "next/server";
import { ATLAS_BASE_URL, atlasAuthHeaders } from "@/lib/data/atlasAuth";
import { requireAdminApi } from "@/lib/admin/requireAdmin";

export async function GET(request: NextRequest) {
  const access = await requireAdminApi();
  if ("response" in access) return access.response;

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
