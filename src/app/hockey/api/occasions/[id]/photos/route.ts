import { asMember, bodyOf } from "../../../../_server/respond";
import { NightError } from "../../../../_server/night";
import { addPhoto, memoriesFor } from "../../../../_server/memories";
import { PhotoInputSchema } from "@/domain/hockey/memories";

export const dynamic = "force-dynamic";

/** The night's album. Members only; a stranger gets the night's own 404. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember((user) => memoriesFor(user, id));
}

/** Add a photo, as myself. The picture must be a small JPEG. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return asMember(async (user) => {
    const parsed = PhotoInputSchema.safeParse(await bodyOf(request));
    if (!parsed.success) {
      throw new NightError(
        parsed.error.issues[0]?.message ?? "That isn't a photo.",
        400,
      );
    }
    return addPhoto(user, id, parsed.data);
  });
}
