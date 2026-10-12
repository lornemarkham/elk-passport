import { ActionSchema } from "@/domain/hockey/actions";
import { asMember, bodyOf } from "../../../../_server/respond";
import { NightError, act } from "../../../../_server/night";

export const dynamic = "force-dynamic";

/** Everything a member does to the night. See `ActionSchema`. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember(async (user) => {
    const parsed = ActionSchema.safeParse(await bodyOf(request));
    if (!parsed.success)
      throw new NightError("That isn't something you can do here.", 400);
    return act(user, id, parsed.data);
  });
}
