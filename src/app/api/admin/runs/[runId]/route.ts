import { NextResponse } from "next/server";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

/**
 * One run and its events, for the Region workspace to poll while growth
 * is in flight.
 *
 * **This is the only progress channel, on purpose.** Every stage the
 * workspace shows is an `IngestionEvent` the pipeline already writes for
 * the Observatory — there is no parallel progress feed that could tell a
 * different story about the same run. If the workspace says a page was
 * fetched, a curator can open Runs and find that exact event.
 *
 * Two reads in one response because the client wants them together on
 * every tick, and two round trips per second per viewer is a waste of a
 * localhost that is also running ingestion.
 */
const ATLAS_BASE_URL = "http://localhost:3000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured for this app." },
      { status: 503 },
    );
  }

  const { runId } = await params;
  const headers = atlasAuthHeaders({ "x-admin-token": token });

  try {
    const [runsResponse, eventsResponse] = await Promise.all([
      fetch(`${ATLAS_BASE_URL}/admin/runs`, { headers, cache: "no-store" }),
      fetch(
        `${ATLAS_BASE_URL}/admin/runs/${encodeURIComponent(runId)}/events`,
        { headers, cache: "no-store" },
      ),
    ]);

    if (!runsResponse.ok || !eventsResponse.ok) {
      return NextResponse.json(
        {
          error: `Atlas returned ${runsResponse.status}/${eventsResponse.status}.`,
        },
        { status: 502 },
      );
    }

    const runs = (await runsResponse.json()) as { id: string }[];
    const events = await eventsResponse.json();

    return NextResponse.json({
      run: runs.find((r) => r.id === runId) ?? null,
      events,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Atlas is unreachable: ${(error as Error).message}` },
      { status: 503 },
    );
  }
}
