import { NextResponse } from "next/server";

// Same proxy shape as /api/admin/duplicates/route.ts — see that file's
// comment for why this exists (keeping ADMIN_TOKEN server-only).
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

  // Sprint 2 Refinement — real user-observed failure mode: on a cold dev
  // start, this app's server can come up before Atlas's own server has
  // finished starting (or, against real Supabase, before its connection is
  // warm), so this `fetch` itself throws (`ECONNREFUSED` / `fetch failed`)
  // rather than Atlas returning a normal error response. Previously
  // unhandled, that exception crashed this route into a generic Next.js
  // 500 with no recognizable shape, which the client could only ever show
  // as "Couldn't load the Curator Queue — please try again" — honest, but
  // indistinguishable from a real defect. Caught here and given its own
  // real `code` so the client can tell "Atlas isn't up yet" apart from
  // every other failure and react accordingly (see `AtlasUnreachableError`
  // in `admin-repo.ts`).
  let response: Response;
  try {
    response = await fetch(`${ATLAS_BASE_URL}/admin/content-health`, {
      headers: { "x-admin-token": token },
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
