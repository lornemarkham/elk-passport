import { z } from "zod";
import { asMember, bodyOf } from "../../../../_server/respond";
import { NightError, chirpsFor } from "../../../../_server/night";

export const dynamic = "force-dynamic";

const Body = z.object({ targetId: z.string().uuid() });

/**
 * **Chirp someone:** three chirps about another member, to choose from.
 * Publishes nothing — the person picks one and sends it as their own
 * message through the ordinary `say` action, or doesn't.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember(async (user) => {
    const parsed = Body.safeParse(await bodyOf(request));
    if (!parsed.success) throw new NightError("Chirp who?", 400);
    return chirpsFor(user, id, parsed.data.targetId);
  });
}
