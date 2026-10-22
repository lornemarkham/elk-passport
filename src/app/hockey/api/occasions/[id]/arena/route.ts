import { asMember, bodyOf } from "../../../../_server/respond";
import { NightError } from "../../../../_server/night";
import { arenaAct, arenaFor } from "../../../../_server/arena";
import { ArenaActionSchema } from "@/domain/hockey/arena-mode";

export const dynamic = "force-dynamic";

/**
 * Arena Mode: check-ins, pings and quests. Members only; a stranger gets the
 * same 404 as a night that does not exist. What each person may read and
 * write is the database's decision (`arena-migration.sql`).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember((user) => arenaFor(user, id));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember(async (user) => {
    const parsed = ArenaActionSchema.safeParse(await bodyOf(request));
    if (!parsed.success) {
      throw new NightError(
        parsed.error.issues[0]?.message ?? "That didn't make sense.",
        400,
      );
    }
    return arenaAct(user, id, parsed.data);
  });
}
