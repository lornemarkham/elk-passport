import { z } from "zod";
import { asMember, bodyOf } from "../../_server/respond";
import { NightError, redeemInvite } from "../../_server/night";

export const dynamic = "force-dynamic";

/**
 * Following an invitation. Requires a session — `asMember` returns 401
 * without one, and the database function refuses a caller with no
 * `auth.uid()` anyway — so a link alone never makes anybody a member.
 */
export async function POST(request: Request) {
  return asMember(async (user) => {
    const body = z
      .object({
        token: z.string().max(128),
        name: z.string().max(40).optional(),
      })
      .safeParse(await bodyOf(request));
    if (!body.success) throw new NightError("Bad link.", 400);
    const id = await redeemInvite(user, body.data.token, body.data.name);
    if (!id) {
      throw new NightError(
        "That link has been used, revoked or has expired. Ask whoever sent it for a fresh one.",
        410,
      );
    }
    return { id };
  });
}
