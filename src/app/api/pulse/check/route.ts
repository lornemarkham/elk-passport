import { checkShelves, createCheck } from "@/lib/pulse/checkService";
import { isProvince } from "@/lib/pulse/model";
import {
  checkGuarded,
  device,
  guardRequest,
  ipOf,
  json,
} from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/** The discovery shelves; `?p=BC` adds that province's local checks. */
export async function GET(request: Request) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  const p = new URL(request.url).searchParams.get("p");
  return checkGuarded(async ({ checks }) =>
    json(checkShelves(await checks.list(120), isProvince(p) ? p : null)),
  );
}

/** Publish a Pulse Check: the claim, the sources read for it, and its poll. */
export async function POST(request: Request) {
  const refused = guardRequest(request, "create");
  if (refused) return refused;
  return checkGuarded(async (stores, key) => {
    const text = await request.text().catch(() => "");
    // A screenshot rides along as base64, so this body may be large; nothing else is.
    if (text.length > 2_300_000)
      return json(
        {
          error: "invalid",
          field: "file",
          message: "That picture is too big.",
        },
        413,
      );
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text);
    } catch {
      return json(
        { error: "invalid", message: "That didn't come through." },
        400,
      );
    }
    const result = await createCheck(stores, key, body, {
      device: await device(),
      ip: ipOf(request),
      now: new Date(),
    });
    if (result.ok)
      return json({ id: result.pulse.id, slug: result.check.slug }, 201);
    return json(
      { error: result.error, field: result.field, message: result.message },
      result.error === "limited" ? 429 : 400,
    );
  });
}
