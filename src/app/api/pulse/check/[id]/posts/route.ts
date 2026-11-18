import { addPost, authorOf } from "@/lib/pulse/checkService";
import { isPulseId } from "@/lib/pulse/model";
import {
  checkGuarded,
  device,
  existingDevice,
  guardRequest,
  ipOf,
  json,
  readBody,
} from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/** The discussion, oldest first. Never says who wrote anything. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  const { id } = await params;
  if (!isPulseId(id)) return json({ error: "missing" }, 404);
  return checkGuarded(async ({ checks }, key) =>
    json({
      posts: await checks.posts(id, authorOf(key, await existingDevice())),
    }),
  );
}

/** Add an experience, a question, an opinion or a source to look at. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refused = guardRequest(request, "post");
  if (refused) return refused;
  const { id } = await params;
  if (!isPulseId(id)) return json({ error: "missing" }, 404);
  return checkGuarded(async (stores, key) => {
    const result = await addPost(stores, key, id, await readBody(request), {
      device: await device(),
      ip: ipOf(request),
      now: new Date(),
    });
    if (result.ok) return json({ post: result.post }, 201);
    const status = { invalid: 400, bot: 400, limited: 429, missing: 404 }[
      result.error
    ];
    return json({ error: result.error, message: result.message }, status);
  });
}
