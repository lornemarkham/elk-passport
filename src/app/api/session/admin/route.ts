import { NextResponse } from "next/server";
import { adminVerdictForRequest } from "@/lib/admin/requireAdmin";

/**
 * Whether the caller is an approved administrator — a question about
 * themselves only, answered with a boolean.
 *
 * It lives outside `/api/admin` on purpose: that prefix answers 401 to
 * everybody else, and the nav entry asks on every page load, so a visitor's
 * console would fill with refusals. This answers 200 either way and reveals
 * nothing but "you are" or "you are not". The list itself never leaves the
 * server (`ADMIN_EMAILS` is not `NEXT_PUBLIC_*`).
 */
export async function GET() {
  const verdict = await adminVerdictForRequest();
  return NextResponse.json(
    { admin: verdict.ok },
    { headers: { "Cache-Control": "no-store" } },
  );
}
