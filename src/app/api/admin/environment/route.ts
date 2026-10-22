import { NextResponse } from "next/server";
import { adminEnvironment } from "@/lib/admin/adminEnvironment";
import { requireAdminApi } from "@/lib/admin/requireAdmin";

/** What the workbench is still missing, by name. Never a value. */
export async function GET() {
  const access = await requireAdminApi();
  if ("response" in access) return access.response;

  return NextResponse.json(adminEnvironment(), {
    headers: { "Cache-Control": "no-store" },
  });
}
