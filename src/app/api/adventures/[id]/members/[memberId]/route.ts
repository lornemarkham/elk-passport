import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import {
  adventureFor,
  Refused,
  removeMember,
  updateMe,
} from "@/lib/adventures/store";
import { parseVisibility } from "@/lib/adventures/rules";

type Params = { params: Promise<{ id: string; memberId: string }> };

/**
 * Leave (`me`, or your own member id) or remove somebody (owner only).
 * Postgres decides both and never lets the owner be removed.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const { id, memberId } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return answer(async () => {
    let target = memberId;
    if (memberId === "me") {
      const view = await adventureFor(session.db, id, session.user.id);
      if (!view) throw new Refused();
      target = view.you.memberId;
    }
    await removeMember(session.db, id, target);
    return new NextResponse(null, { status: 204 });
  });
}

/** How you appear here: `{ displayName?, visibility? }`. Only ever yourself. */
export async function PATCH(request: Request, { params }: Params) {
  const { id, memberId } = await params;
  if (memberId !== "me") return badRequest("You can only change yourself.");
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;

  const body = (await bodyOf(request)) as {
    displayName?: unknown;
    visibility?: unknown;
  } | null;
  const change: {
    displayName?: string | null;
    visibility?: "members" | "hidden";
  } = {};
  if (body?.displayName !== undefined) {
    if (
      body.displayName !== null &&
      (typeof body.displayName !== "string" ||
        body.displayName.trim().length > 40)
    )
      return badRequest("Keep your name under 40 characters.");
    change.displayName =
      typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim()
        : null;
  }
  if (body?.visibility !== undefined) {
    const visibility = parseVisibility(body.visibility);
    if (!visibility) return badRequest("Listed or unlisted?");
    change.visibility = visibility;
  }
  if (Object.keys(change).length === 0) return badRequest("Nothing to change.");

  return answer(async () => {
    await updateMe(session.db, id, session.user.id, change);
    return new NextResponse(null, { status: 204 });
  });
}
