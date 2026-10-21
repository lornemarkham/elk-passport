import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import {
  adventureFor,
  createInvite,
  invitesOf,
  Refused,
  revokeInvite,
} from "@/lib/adventures/store";
import { parseInviteRequest } from "@/lib/adventures/rules";

type Params = { params: Promise<{ id: string }> };

/**
 * Links into one adventure. Owner only, enforced by Postgres; this handler
 * also checks first so a participant gets 404 rather than an empty list that
 * looks like "no links".
 */
async function ownerSession(id: string) {
  const session = await requireAdventureSession();
  if ("response" in session) return session;
  const view = await adventureFor(session.db, id, session.user.id);
  if (!view || view.role !== "owner") throw new Refused();
  return session;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return answer(async () => {
    const session = await ownerSession(id);
    if ("response" in session) return session.response;
    return NextResponse.json(await invitesOf(session.db, id));
  });
}

/**
 * Make a link. Single-use unless `maxUses` says otherwise (`null` = open).
 * The token comes back here, once; Passport keeps only its hash.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = parseInviteRequest(await bodyOf(request));
  if (!parsed.ok) return badRequest(parsed.error);
  return answer(async () => {
    const session = await ownerSession(id);
    if ("response" in session) return session.response;
    const { token, invite } = await createInvite(
      session.db,
      id,
      session.user.id,
      parsed.value,
    );
    return NextResponse.json(
      { token, path: `/adventures/join/${token}`, invite },
      { status: 201 },
    );
  });
}

/** `?invite=<id>` stops that link working. People already in stay. */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const inviteId = new URL(request.url).searchParams.get("invite");
  if (!inviteId) return badRequest("Which link?");
  return answer(async () => {
    const session = await ownerSession(id);
    if ("response" in session) return session.response;
    await revokeInvite(session.db, id, inviteId);
    return new NextResponse(null, { status: 204 });
  });
}
