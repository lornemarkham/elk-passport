import { correctCheck } from "@/lib/pulse/checkService";
import { isPulseId } from "@/lib/pulse/model";
import {
  checkGuarded,
  device,
  guardRequest,
  json,
  readBody,
} from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/** A correction by the person who published the check, from the same browser. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refused = guardRequest(request, "create");
  if (refused) return refused;
  const { id } = await params;
  if (!isPulseId(id)) return json({ error: "missing" }, 404);
  return checkGuarded(async (stores, key) => {
    const result = await correctCheck(
      stores,
      key,
      id,
      await readBody(request),
      { device: await device() },
      new Date(),
    );
    if (result.ok) return json({ ok: true, check: result.check });
    const status = {
      invalid: 400,
      forbidden: 403,
      missing: 404,
      conflict: 409,
    }[result.error];
    return json({ error: result.error, message: result.message }, status);
  });
}
