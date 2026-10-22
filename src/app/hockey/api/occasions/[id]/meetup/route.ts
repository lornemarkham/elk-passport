import { asMember, bodyOf } from "../../../../_server/respond";
import { NightError } from "../../../../_server/night";
import { setMeetup } from "../../../../_server/seats";
import { MeetupSchema } from "@/domain/hockey/seats";

export const dynamic = "force-dynamic";

/** The host sets where we find each other at the arena. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember(async (user) => {
    const parsed = MeetupSchema.safeParse(await bodyOf(request));
    if (!parsed.success) {
      throw new NightError(
        parsed.error.issues[0]?.message ?? "That isn't a meeting point.",
        400,
      );
    }
    return setMeetup(user, id, parsed.data);
  });
}

/** The host clears it. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember((user) => setMeetup(user, id, null));
}
