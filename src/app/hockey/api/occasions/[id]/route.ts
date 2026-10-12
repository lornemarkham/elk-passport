import { asMember } from "../../../_server/respond";
import { NightError, loadNight } from "../../../_server/night";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember(async (user) => {
    const night = await loadNight(user, id);
    if (!night) throw new NightError("Not found.", 404);
    return night;
  });
}
