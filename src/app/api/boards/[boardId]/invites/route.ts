import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  accessToBoard,
  canShare,
  ensureOwnerMembership,
} from "@/lib/collaboration/boardAccess";
import {
  createInvite,
  invitesFor,
  revokeInvite,
  type InviteRole,
} from "@/lib/collaboration/invites";

const ROLES: readonly InviteRole[] = ["editor", "viewer"];

async function ownerAccess(boardId: string) {
  const auth = await requireUser();
  if ("response" in auth) return { response: auth.response } as const;

  const access = await accessToBoard(auth.user, boardId);
  if (!access) {
    return {
      response: NextResponse.json(
        { error: "Board not found." },
        { status: 404 },
      ),
    } as const;
  }
  if (!canShare(access.role)) {
    return {
      response: NextResponse.json(
        { error: "Only the board's owner can share it." },
        { status: 403 },
      ),
    } as const;
  }

  return { user: auth.user, access } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  const result = await ownerAccess(boardId);
  if ("response" in result) return result.response;

  return NextResponse.json(await invitesFor(boardId));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  const result = await ownerAccess(boardId);
  if ("response" in result) return result.response;

  const body = await request.json().catch(() => null);
  const role = ROLES.includes(body?.role)
    ? (body.role as InviteRole)
    : "editor";

  // A board created before sharing existed has no membership row, and the
  // "may I add a member" policy asks this table who the owner is. Written now,
  // at the first moment it is needed, rather than by a migration that would
  // have to guess.
  await ensureOwnerMembership(result.user, boardId);

  const invite = await createInvite({
    boardId,
    boardOwnerId: result.access.ownerId,
    createdBy: result.user.id,
    role,
    expiresInDays: body?.expiresInDays ?? null,
  });

  return NextResponse.json(invite, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  const result = await ownerAccess(boardId);
  if ("response" in result) return result.response;

  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  await revokeInvite(boardId, token);
  return new NextResponse(null, { status: 204 });
}
