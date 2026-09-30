import { NextResponse } from "next/server";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

// Same proxy reasoning as ../../merge/route.ts — ADMIN_TOKEN stays
// server-side, the browser only ever talks to this same-origin route.
const ATLAS_BASE_URL = "http://localhost:3000";

export async function POST(request: Request) {
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

  const body = await request.text();

  const response = await fetch(
    `${ATLAS_BASE_URL}/admin/relationships/contains`,
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
