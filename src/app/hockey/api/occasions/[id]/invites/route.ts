import { z } from "zod";
import { asMember, bodyOf } from "../../../../_server/respond";
import {
  NightError,
  createInvite,
  listInvites,
  revokeInvite,
} from "../../../../_server/night";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Host only. Everyone else gets the 404 a stranger gets. */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return asMember((user) => listInvites(user, id));
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return asMember(async (user) => {
    const body = z
      .object({ label: z.string().max(60).optional() })
      .safeParse(await bodyOf(request));
    if (!body.success) throw new NightError("Bad invitation.", 400);
    return createInvite(user, id, body.data.label);
  });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  const inviteId = new URL(request.url).searchParams.get("invite") ?? "";
  return asMember(async (user) => {
    if (!z.string().uuid().safeParse(inviteId).success) {
      throw new NightError("Not found.", 404);
    }
    await revokeInvite(user, id, inviteId);
  });
}
