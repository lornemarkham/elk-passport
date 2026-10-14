import { asMember } from "../../../../_server/respond";
import { nearbyFor } from "../../../../_server/night";

export const dynamic = "force-dynamic";

/** Food and drink near the arena. Members only — a stranger learns nothing, not even the venue. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember((user) => nearbyFor(user, id));
}
