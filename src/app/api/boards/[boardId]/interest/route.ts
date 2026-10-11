import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import type { PassportUser } from "@/lib/auth/currentUser";
import { accessToBoard } from "@/lib/collaboration/boardAccess";
import { listBoardItemsFor } from "@/lib/data/boards-server";
import {
  gatheringForBoard,
  staffActivities,
} from "@/lib/data/boards-gatherings";
import {
  kindredColleagues,
  parseInterestRequest,
  shownAsFor,
  summariseInterest,
} from "@/lib/data/boards-interest";
import {
  InterestUnavailable,
  clearInterest,
  markInterest,
  readBoardInterest,
} from "@/lib/data/boards-interest-server";
import { planItemId } from "@/lib/data/boards-plans";
import { readBoardPlans } from "@/lib/data/boards-plans-server";

/**
 * **"I'm interested", on one board.**
 *
 * Any member may say it — a viewer included, because raising a hand is not
 * editing the board. Only things actually on this board can be marked: its
 * saved items, the staff activities its gathering declares, and the days
 * members have shared on it ("I'm in" on a shared day is this same mark). Every answer
 * is the board's whole picture as this person may see it, so the page never
 * has to stitch a partial update together.
 */
type Params = { params: Promise<{ boardId: string }> };

const notFound = () =>
  NextResponse.json({ error: "Board not found." }, { status: 404 });

const unavailable = () =>
  NextResponse.json(
    {
      error: "unavailable",
      message: "Passport can't record interest here yet.",
    },
    { status: 503 },
  );

async function picture(user: PassportUser, boardId: string) {
  const { rows, memberIds } = await readBoardInterest(boardId);
  return {
    summaries: summariseInterest(rows, user.id, memberIds),
    kindred: kindredColleagues(rows, user.id, memberIds),
  };
}

async function markable(
  boardId: string,
  ownerId: string,
): Promise<Set<string>> {
  const gathering = gatheringForBoard(boardId);
  const ids = new Set(
    gathering ? staffActivities(gathering).map((a) => a.id) : [],
  );
  // If Atlas cannot answer, declared activities can still be marked; saved
  // items wait until it can. Refusing everything would punish the hockey game
  // for an Atlas outage it has nothing to do with.
  const [items, plans] = await Promise.all([
    listBoardItemsFor(boardId, ownerId).catch(() => []),
    // Same reasoning: shared days not being switched on yet must not stop
    // anybody raising a hand for the hockey game.
    readBoardPlans(boardId).catch(() => ({ rows: [] })),
  ]);
  for (const item of items) ids.add(item.experienceId);
  for (const plan of plans.rows) ids.add(planItemId(plan.id));
  return ids;
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;
  const access = await accessToBoard(auth.user, boardId);
  if (!access) return notFound();

  try {
    return NextResponse.json(await picture(auth.user, boardId));
  } catch (error) {
    if (error instanceof InterestUnavailable) return unavailable();
    throw error;
  }
}

async function change(request: Request, { params }: Params, on: boolean) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;
  const asked = parseInterestRequest(await request.json().catch(() => null));
  if (!asked) {
    return NextResponse.json({ error: "itemId is required." }, { status: 400 });
  }

  const access = await accessToBoard(auth.user, boardId);
  if (!access) return notFound();

  if (on && !(await markable(boardId, access.ownerId)).has(asked.itemId)) {
    return NextResponse.json(
      { error: "That isn't on this board." },
      { status: 404 },
    );
  }

  try {
    if (on) {
      await markInterest(
        auth.user,
        boardId,
        asked.itemId,
        shownAsFor(auth.user.displayName, asked.showName),
      );
    } else {
      // Withdrawing is always allowed, even for something no longer on the
      // board — taking your hand down should never need permission.
      await clearInterest(auth.user, boardId, asked.itemId);
    }
    return NextResponse.json(await picture(auth.user, boardId));
  } catch (error) {
    if (error instanceof InterestUnavailable) return unavailable();
    throw error;
  }
}

export const PUT = (request: Request, context: Params) =>
  change(request, context, true);

export const DELETE = (request: Request, context: Params) =>
  change(request, context, false);
