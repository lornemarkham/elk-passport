import { NextResponse } from "next/server";

/**
 * **Abandon a candidate source.** The curator saying Atlas should not read
 * this page.
 *
 * Same proxy reasoning as every other `/api/admin/*` route: `ADMIN_TOKEN`
 * stays server-side. Nothing is decided here — Atlas sets the candidate's
 * status to `rejected` and keeps the row, so the decision is auditable and the
 * page is not rediscovered on the next sweep.
 */
const ATLAS_BASE_URL = "http://localhost:3000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured for this app." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const body = await request.text();

  try {
    const response = await fetch(
      `${ATLAS_BASE_URL}/admin/candidate-sources/${encodeURIComponent(id)}/dismiss`,
      {
        method: "POST",
        headers: { "x-admin-token": token, "Content-Type": "application/json" },
        body: body || "{}",
      },
    );
    // Atlas serves a compiled build loaded at startup, so a 404 here does not
    // mean "no such candidate" — it means the running API predates this route.
    // Surfacing Atlas's bare "Not found" would send a curator hunting for a
    // data problem that does not exist.
    if (response.status === 404) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (payload?.error !== "No such candidate source.") {
        return NextResponse.json(
          {
            error:
              "The running Atlas API does not have this endpoint yet. It serves a compiled build loaded at startup — restart it with `npm run api` to pick up new routes.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(payload, { status: 404 });
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
