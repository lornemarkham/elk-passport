import { NextResponse } from "next/server";

/**
 * **Read the pages Atlas has discovered, from the mission that owns them.**
 *
 * The same operation `npm run run-queue` performs. ADR 043 says a mission is
 * finished on its own page, and reading a discovered page was the one step
 * that still required a terminal.
 *
 * Same proxy reasoning as every other `/api/admin/*` route: `ADMIN_TOKEN`
 * stays server-side and the browser never sees it. The body is forwarded
 * unchanged — the scope is a list of entity ids, and Atlas refuses an empty
 * one rather than widening a page's action into an Atlas-wide queue run.
 *
 * Atlas answers **202 with a run id** and does the work unawaited; progress is
 * read from that run's own events, exactly as region growth already does.
 * Nothing here waits, and nothing here reports completion.
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
    const response = await fetch(
      `${ATLAS_BASE_URL}/admin/candidate-sources/run-queue`,
      {
        method: "POST",
        headers: { "x-admin-token": token, "Content-Type": "application/json" },
        body: body || "{}",
      },
    );
    // Atlas serves a compiled build loaded at startup, so a 404 here does not
    // mean "nothing to read" — it means the running API predates this route.
    // Surfacing Atlas's bare "Not found" would send a curator hunting for a
    // data problem that does not exist.
    if (response.status === 404) {
      return NextResponse.json(
        {
          error:
            "The running Atlas API does not have this endpoint yet. It serves a compiled bundle loaded at startup — restart it with `npm run api` to pick up new routes.",
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
