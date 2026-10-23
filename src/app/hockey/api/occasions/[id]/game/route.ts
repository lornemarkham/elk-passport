import { asMember } from "../../../../_server/respond";
import { gameFor } from "../../../../_server/game";

export const dynamic = "force-dynamic";

/** The league's score, period and record for this night's game. Members only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember((user) => gameFor(user, id));
}
