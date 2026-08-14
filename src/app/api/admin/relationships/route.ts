import { NextResponse } from "next/server";

// Same proxy reasoning as ../duplicates/route.ts — ADMIN_TOKEN stays
// server-side, the browser only ever talks to this same-origin route.
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

  const response = await fetch(`${ATLAS_BASE_URL}/admin/relationships`, {
    headers: { "x-admin-token": token },
    cache: "no-store",
  });

  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
