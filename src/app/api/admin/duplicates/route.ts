import { NextResponse } from "next/server";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

// Proxies to Atlas's admin API so ADMIN_TOKEN never reaches the browser —
// it's a server-only env var here (no NEXT_PUBLIC_ prefix), read and
// attached to the outgoing request on the server, same boundary reasoning
// as OPENAI_API_KEY in /api/recommend. The client (admin-repo.ts) only ever
// talks to this same-origin route, never to Atlas's /admin/* directly.
const ATLAS_BASE_URL = "http://localhost:3000";

export async function GET() {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    // 503, not 500 — this isn't a runtime failure, it's an unfinished setup
    // step. `code` lets the client show a real "here's how to fix this"
    // screen instead of a generic error (see AdminSetupNotice.tsx).
    return NextResponse.json(
      {
        error: "ADMIN_TOKEN is not configured for this app.",
        code: "ADMIN_TOKEN_MISSING",
      },
      { status: 503 },
    );
  }

  // Sprint 2 Refinement — same real cold-start failure mode documented in
  // /api/admin/content-health/route.ts: this app can come up before Atlas
  // is ready to answer, and an uncaught `fetch` here used to crash into a
  // generic 500 the client couldn't tell apart from a real defect.
  let response: Response;
  try {
    response = await fetch(`${ATLAS_BASE_URL}/admin/duplicates`, {
      headers: atlasAuthHeaders({ "x-admin-token": token }),
      cache: "no-store",
    });
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
