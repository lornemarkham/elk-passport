import { NextResponse } from "next/server";
import { ATLAS_BASE_URL, atlasAuthHeaders } from "@/lib/data/atlasAuth";
import { requireAdminApi } from "@/lib/admin/requireAdmin";

export async function GET() {
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
