import { reportPost } from "@/lib/pulse/checkService";
import { isPulseId } from "@/lib/pulse/model";
import {
  checkGuarded,
  device,
  guardRequest,
  json,
  readBody,
} from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/** Flag a post. Three different browsers hide it until a moderator looks. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const refused = guardRequest(request, "report");
  if (refused) return refused;
  const { postId } = await params;
  if (!isPulseId(postId)) return json({ error: "missing" }, 404);
  return checkGuarded(async ({ checks }, key) => {
    const body = await readBody(request);
    const outcome = await reportPost(
      checks,
      key,
      postId,
      body.reason,
      await device(),
    );
    if (outcome === "invalid") return json({ error: "invalid" }, 400);
    if (outcome === "missing") return json({ error: "missing" }, 404);
    return json({ outcome });
  });
}
