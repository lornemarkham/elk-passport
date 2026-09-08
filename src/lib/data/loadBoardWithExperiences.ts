import { type Board } from "./boards-repo";
import { listBoardItemsFor } from "./boards-server";
import { accessToBoard, type BoardRole } from "@/lib/collaboration/boardAccess";
import { currentUser } from "@/lib/auth/currentUser";
import { listPlaces } from "./atlas-repo";
import { placeToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";

export type LoadBoardResult =
  | {
      status: "ok";
      board: Board;
      experiences: Experience[];
      /** What this person may do here. A shared board is not always editable. */
      role: BoardRole;
    }
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

  // Owned, shared with them, or neither. "Neither" is reported as not-found
  // whether the board is somebody else's or does not exist, so changing an id
  // in the URL tells the changer nothing.
  let access;
  try {
    access = await accessToBoard(user, id);
  } catch {
    return { status: "error" };
  }
  if (!access) return { status: "not-found" };

  const board = access.board;

  try {
    const [items, places] = await Promise.all([
      // Read on the owner's behalf — Atlas answers only for an owner and knows
      // nothing about sharing. Passport already decided this person may look.
      listBoardItemsFor(id, access.ownerId),
      listPlaces(),
    ]);
    const experienceById = new Map(
      places.map((place) => [place.id, placeToExperience(place)]),
    );
    const experiences = items
      .map((item) => experienceById.get(item.experienceId))
      .filter((experience): experience is Experience => Boolean(experience));
    return { status: "ok", board, experiences, role: access.role };
  } catch {
    return { status: "error" };
  }
}
