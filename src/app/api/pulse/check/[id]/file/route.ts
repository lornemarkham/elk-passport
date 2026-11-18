import { requireAdminApi } from "@/lib/admin/requireAdmin";
import { isCheckCreator } from "@/lib/pulse/checkService";
import { isPulseId } from "@/lib/pulse/model";
import {
  checkGuarded,
  existingDevice,
  guardRequest,
  json,
} from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/**
 * The screenshot attached to a check. **Private**: only the browser that
 * published it, or a Passport administrator, can see it. It is never part of
 * the public page or the link preview, because it may show other people's
 * names, faces or words.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  const { id } = await params;
  if (!isPulseId(id)) return json({ error: "missing" }, 404);
  return checkGuarded(async ({ checks }, key) => {
    const mine = await isCheckCreator(checks, key, id, await existingDevice());
    if (!mine) {
      const gate = await requireAdminApi();
      // Everyone else is told only that there is nothing here.
      if ("response" in gate) return json({ error: "missing" }, 404);
    }
    const file = await checks.file(id);
    if (!file) return json({ error: "missing" }, 404);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": "inline",
        "X-Robots-Tag": "noindex",
      },
    });
  });
}
