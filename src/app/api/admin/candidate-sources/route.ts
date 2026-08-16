import { NextResponse } from "next/server";

/**
 * Queue a URL for Atlas to read.
 *
 * The write seam the Region Workspace has been missing: until now the only
 * way to queue a source was a CLI, which is why every "read this source"
 * control on the page was honestly disabled.
 *
 * Thin by design. Atlas validates and creates the `CandidateSource`; this
 * only keeps `ADMIN_TOKEN` out of the browser.
 */
const ATLAS_BASE_URL = "http://localhost:3000";

export async function POST(request: Request) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured for this app." },
      { status: 503 },
    );
  }

  const body = await request.text();
  try {
    const response = await fetch(`${ATLAS_BASE_URL}/admin/candidate-sources`, {
      method: "POST",
      headers: { "x-admin-token": token, "Content-Type": "application/json" },
      body: body || "{}",
    });
    // Atlas serves a compiled build loaded at startup, so a 404 here does
    // not mean "no result" — it means the running API predates this route.
    // Surfacing Atlas's bare "Not found" would send a curator hunting for a
    // data problem that does not exist.
    if (response.status === 404) {
      return NextResponse.json(
        {
          error:
            "The running Atlas API does not have this endpoint yet. It serves a compiled build loaded at startup — restart it with `npm run api` to pick up new routes.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(await response.json(), {
      status: response.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Atlas is unreachable: ${(error as Error).message}` },
      { status: 503 },
    );
  }
}
