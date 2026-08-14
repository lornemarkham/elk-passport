import { NextResponse } from "next/server";

// Same proxy reasoning as every other /api/admin/* route — ADMIN_TOKEN
// stays server-side.
const ATLAS_BASE_URL = "http://localhost:3000";

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
  const token = process.env.ADMIN_TOKEN;
  if (!token) return unauthorized();

  const { id } = await params;
  const response = await fetch(
    `${ATLAS_BASE_URL}/admin/entities/${encodeURIComponent(id)}/enrichment`,
    {
      headers: { "x-admin-token": token },
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
  const token = process.env.ADMIN_TOKEN;
  if (!token) return unauthorized();

  const { id } = await params;
  const body = await request.text();

  const response = await fetch(
    `${ATLAS_BASE_URL}/admin/entities/${encodeURIComponent(id)}/enrichment`,
    {
      method: "POST",
      headers: { "x-admin-token": token, "Content-Type": "application/json" },
      body,
    },
  );

  const responseBody = await response.json();
  return NextResponse.json(responseBody, { status: response.status });
}
