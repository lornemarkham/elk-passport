import { z } from "zod";
import {
  NightError,
  cancelNight,
  changeGame,
  loadNight,
} from "../../../_server/night";
import { asMember, bodyOf } from "../../../_server/respond";

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

const GameBody = z.object({
  opponent: z.string().trim().min(1).max(30),
  startsAt: z.string().max(40),
});

/** The host changes who the Canucks play, or when. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember(async (user) => {
    const parsed = GameBody.safeParse(await bodyOf(request));
    if (!parsed.success)
      throw new NightError("Who are they playing, and when?", 400);
    await changeGame(user, id, parsed.data);
  });
}

/** The host cancels the night. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember((user) => cancelNight(user, id));
}
