import {
  CHECK_EVENTS,
  isShareChannel,
  isVisitSource,
  type CheckEvent,
} from "@/lib/pulse/check";
import { countCheck } from "@/lib/pulse/checkService";
import { checkStore } from "@/lib/pulse/checkStore";
import { guardRequest, json, readBody } from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/**
 * One more visit (by kind of referring site) or share (by channel), counted
 * per day. Nothing about who, and nothing about which check.
 */
export async function POST(request: Request) {
  const refused = guardRequest(request, "event");
  if (refused) return refused;
  const body = await readBody(request);
  const event = CHECK_EVENTS.find((e) => e === body.event) as
    CheckEvent | undefined;
  const ok =
    (event === "visit" && isVisitSource(body.source)) ||
    (event === "share" && isShareChannel(body.source));
  if (!event || !ok) return json({ error: "invalid" }, 400);
  try {
    return json({
      counted: await countCheck(checkStore(), event, String(body.source)),
    });
  } catch {
    return json({ counted: false });
  }
}
