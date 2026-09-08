import { type Board } from "./boards-repo";
import { getBoardFor, listBoardItemsFor } from "./boards-server";
import { currentUser } from "@/lib/auth/currentUser";
import { listPlaces } from "./atlas-repo";
import { placeToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";

export type LoadBoardResult =
  | { status: "ok"; board: Board; experiences: Experience[] }
  | { status: "signed-out" }
  | { status: "not-found" }
  | { status: "error" };

// Board items only store an experienceId — resolving them to something
// reviewable means cross-referencing against the same Place -> Experience
// mapping /discovery already uses, not a new lookup path. Shared by
// /boards/:id and /passport/:id, the two pages that both need a board's
// saved experiences rather than just its metadata.
export async function loadBoardWithExperiences(
  id: string,
): Promise<LoadBoardResult> {
  // A board belongs to somebody. Without a session there is nobody to ask on
  // behalf of, so this is "sign in" rather than "not found" — the reader is
  // told what to do instead of being told their own board does not exist.
  const user = await currentUser();
  if (!user) return { status: "signed-out" };

  let board: Board | null;
  try {
    board = await getBoardFor(id, user.id);
  } catch {
    return { status: "error" };
  }
  // Also the answer for a board that exists and belongs to someone else —
  // `getBoardFor` only ever looks inside this owner's boards, so another
  // person's id is indistinguishable from a typo. That is deliberate.
  if (!board) return { status: "not-found" };

  try {
    const [items, places] = await Promise.all([
      listBoardItemsFor(id, user.id),
      listPlaces(),
    ]);
    const experienceById = new Map(
      places.map((place) => [place.id, placeToExperience(place)]),
    );
    const experiences = items
      .map((item) => experienceById.get(item.experienceId))
      .filter((experience): experience is Experience => Boolean(experience));
    return { status: "ok", board, experiences };
  } catch {
    return { status: "error" };
  }
}
