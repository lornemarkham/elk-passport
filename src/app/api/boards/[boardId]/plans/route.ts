import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import type { PassportUser } from "@/lib/auth/currentUser";
import {
  accessToBoard,
  canEdit,
  type BoardAccess,
} from "@/lib/collaboration/boardAccess";
import { recordEvent } from "@/lib/collaboration/events";
import { shownAsFor } from "@/lib/data/boards-interest";
import {
  PLAN_EVENT_KINDS,
  parsePlanRequest,
  summarisePlans,
} from "@/lib/data/boards-plans";
import {
  PlansUnavailable,
  readBoardPlans,
  sharePlan,
  withdrawPlan,
} from "@/lib/data/boards-plans-server";

/**
 * **Days shared on one board.**
 *
 * Any member may read them. Sharing one needs a role that may add to the
 * board — a viewer was invited to look — and taking one down is for whoever
 * shared it, or the owner. Every answer is the whole list as this person may
 * see it, so the page never stitches a partial update together.
 */
type Params = { params: Promise<{ boardId: string }> };

const notFound = () =>
  NextResponse.json({ error: "Board not found." }, { status: 404 });

const unavailable = () =>
  NextResponse.json(
    {
      error: "unavailable",
      message: "Passport can't share days on this board yet.",
    },
    { status: 503 },
  );

async function list(user: PassportUser, boardId: string, access: BoardAccess) {
  const { rows, memberIds } = await readBoardPlans(boardId);
  return summarisePlans(
    rows,
    { id: user.id, isOwner: access.role === "owner" },
    memberIds,
  );
}

async function guarded(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof PlansUnavailable) return unavailable();
    throw error;
  }
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;
  const access = await accessToBoard(auth.user, boardId);
  if (!access) return notFound();

  return guarded(async () =>
    NextResponse.json(await list(auth.user, boardId, access)),
  );
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;
  const asked = parsePlanRequest(await request.json().catch(() => null));
  if (!asked) {
    return NextResponse.json(
      { error: "That isn't a day from Go have a day." },
      { status: 400 },
    );
  }

  const access = await accessToBoard(auth.user, boardId);
  if (!access) return notFound();
  if (!canEdit(access.role)) {
    return NextResponse.json(
      { error: "You can look at this board, but not add to it." },
      { status: 403 },
    );
  }

  return guarded(async () => {
    await sharePlan(auth.user, boardId, {
      dayQuery: asked.dayQuery,
      title: asked.title,
      shownAs: shownAsFor(auth.user.displayName, asked.showName),
    });
    await recordEvent({
      resourceType: "board",
      resourceId: boardId,
      actorId: auth.user.id,
      kind: PLAN_EVENT_KINDS.planShared,
    });
    return NextResponse.json(await list(auth.user, boardId, access), {
      status: 201,
    });
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;
  const planId = new URL(request.url).searchParams.get("id")?.trim();
  if (!planId) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const access = await accessToBoard(auth.user, boardId);
  if (!access) return notFound();

  return guarded(async () => {
    const plan = (await list(auth.user, boardId, access)).find(
      (p) => p.id === planId,
    );
    // Somebody else's day, and you don't own the board: indistinguishable
    // from no such day, on purpose.
    if (!plan?.canWithdraw || !(await withdrawPlan(boardId, planId))) {
      return NextResponse.json(
        { error: "No such day on this board." },
        { status: 404 },
      );
    }
    await recordEvent({
      resourceType: "board",
      resourceId: boardId,
      actorId: auth.user.id,
      kind: PLAN_EVENT_KINDS.planWithdrawn,
    });
    return NextResponse.json(await list(auth.user, boardId, access));
  });
}
