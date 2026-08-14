import { getBoard, listBoardItems, type Board } from "./boards-repo";
import { listPlaces } from "./atlas-repo";
import { placeToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";

export type LoadBoardResult =
  | { status: "ok"; board: Board; experiences: Experience[] }
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
  let board: Board | null;
  try {
    board = await getBoard(id);
  } catch {
    return { status: "error" };
  }
  if (!board) return { status: "not-found" };

  try {
    const [items, places] = await Promise.all([
      listBoardItems(id),
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
