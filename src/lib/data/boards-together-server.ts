import "server-only";
import type { PassportUser } from "@/lib/auth/currentUser";
import type { BoardRole } from "@/lib/collaboration/boardAccess";
import {
  kindredColleagues,
  summariseInterest,
  type InterestSummary,
  type Kindred,
} from "./boards-interest";
import { readBoardInterest } from "./boards-interest-server";
import { summarisePlans, type SharedPlan } from "./boards-plans";
import { readBoardPlans } from "./boards-plans-server";

/**
 * **What a member sees of the group on a board: who's interested, and the
 * days people have shared.**
 *
 * One loader so the ordinary board page and a gathering's page read the group
 * the same way — a conference is a board, and its group features are the
 * board's. Each half fails on its own: interest not being switched on says
 * nothing about shared days, and the reverse.
 *
 * `null` always means "Passport could not ask", never "nobody".
 */
export interface BoardTogether {
  readonly interest: {
    readonly summaries: Readonly<Record<string, InterestSummary>>;
    readonly kindred: readonly Kindred[];
  } | null;
  readonly plans: readonly SharedPlan[] | null;
}

export async function loadBoardTogether(
  user: PassportUser,
  boardId: string,
  role: BoardRole,
): Promise<BoardTogether> {
  const [interest, plans] = await Promise.all([
    readBoardInterest(boardId).then(
      ({ rows, memberIds }) => ({
        summaries: summariseInterest(rows, user.id, memberIds),
        kindred: kindredColleagues(rows, user.id, memberIds),
      }),
      () => null,
    ),
    readBoardPlans(boardId).then(
      ({ rows, memberIds }) =>
        summarisePlans(
          rows,
          { id: user.id, isOwner: role === "owner" },
          memberIds,
        ),
      () => null,
    ),
  ]);
  return { interest, plans };
}
