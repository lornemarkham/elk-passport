import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/currentUser";
import { describeInvite, redeemInvite } from "@/lib/collaboration/invites";
import { CORE_EVENT_KINDS, recordEvent } from "@/lib/collaboration/events";

/**
 * What this link offers.
 *
 * Deliberately answerable **while signed out** — somebody who taps a link
 * should understand what they are being invited to before being asked to make
 * an account. That is the whole friction argument: sign in when it is actually
 * required, which is at the moment of joining, not at the moment of looking.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = await describeInvite(token);

  if (!invite) {
    return NextResponse.json(
      { valid: false, reason: "unknown" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    valid: invite.valid,
    role: invite.role,
    reason: invite.valid ? null : "expired-or-revoked",
  });
}

/** Accept it. This is the point at which identity is genuinely required. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "signed-out",
        message: "Sign in to join this board.",
      },
      { status: 401 },
    );
  }

  const boardId = await redeemInvite(token);

  if (!boardId) {
    return NextResponse.json(
      { error: "This link is no longer good." },
      { status: 410 },
    );
  }

  await recordEvent({
    resourceType: "board",
    resourceId: boardId,
    actorId: user.id,
    kind: CORE_EVENT_KINDS.memberJoined,
    payload: { userId: user.id, displayName: user.displayName },
  });

  return NextResponse.json({ boardId });
}
