import { NextResponse } from "next/server";
import { ATLAS_BASE_URL, atlasAuthHeaders } from "@/lib/data/atlasAuth";
import { requireAdminApi } from "@/lib/admin/requireAdmin";

function unauthorized() {
  return NextResponse.json(
    {
      error: "ADMIN_TOKEN is not configured for this app.",
      code: "ADMIN_TOKEN_MISSING",
    },
    { status: 503 },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if ("response" in access) return access.response;

  const token = process.env.ADMIN_TOKEN;
  if (!token) return unauthorized();

  const { id } = await params;
  const response = await fetch(
    `${ATLAS_BASE_URL}/admin/entities/${encodeURIComponent(id)}/enrichment`,
    {
      headers: atlasAuthHeaders({ "x-admin-token": token }),
      cache: "no-store",
    },
  );

  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if ("response" in access) return access.response;

  const token = process.env.ADMIN_TOKEN;
  if (!token) return unauthorized();

  const { id } = await params;
  const body = await request.text();

  const response = await fetch(
    `${ATLAS_BASE_URL}/admin/entities/${encodeURIComponent(id)}/enrichment`,
    {
      method: "POST",
      headers: atlasAuthHeaders({
        "x-admin-token": token,
        "Content-Type": "application/json",
      }),
      body,
    },
  );

  const responseBody = await response.json();
  return NextResponse.json(responseBody, { status: response.status });
}
