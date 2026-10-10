import "server-only";
import { currentUser } from "@/lib/auth/currentUser";
import { listBoardsFor } from "./boards-server";
import {
  loadBoardWithExperiences,
  type LoadBoardResult,
} from "./loadBoardWithExperiences";

/**
 * **What this person has collected, without asking them about boards.**
 *
 * The owner's actual route from Discovery to the things they had just saved:
 *
 * ```
 * Discovery → My Places → Back to Boards → Your Boards → My Places
 *           → Continue discovering
 * ```
 *
 * Five screens and two different pages called *My Places* to look at four
 * saved items. Boards are a real feature — they are shared, they have members,
 * `/boards/:id` is a link people send each other — but none of that is part of
 * collecting a few ideas on a Saturday morning, and the ordinary journey
 * should not route through it.
 *
 * So this resolves the one board a personal journey needs and leaves the board
 * model exactly where it is. Nothing is migrated, no second store appears, and
 * `/boards/:id` keeps working for anybody who deliberately goes there.
 */
export async function loadSaved(): Promise<
  LoadBoardResult | { status: "nothing-yet" }
> {
  const user = await currentUser();
  if (!user) return { status: "signed-out" };

  let boards;
  try {
    boards = await listBoardsFor(user.id);
  } catch {
    return { status: "error" };
  }

  // **No board is not an error and not an empty board.** Somebody who has
  // never saved anything has none, and a page that said "board not found"
  // would be answering a question they never asked.
  const first = boards[0];
  if (!first) return { status: "nothing-yet" };

  return loadBoardWithExperiences(first.id);
}
