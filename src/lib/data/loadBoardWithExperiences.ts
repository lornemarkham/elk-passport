import { type Board } from "./boards-repo";
import { listBoardItemsFor } from "./boards-server";
import { accessToBoard, type BoardRole } from "@/lib/collaboration/boardAccess";
import { currentUser } from "@/lib/auth/currentUser";
import { listDiscoveryCandidates, listPlaces } from "./atlas-repo";
import {
  candidateToExperience,
  placeToExperience,
} from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";

export type LoadBoardResult =
  | {
      status: "ok";
      board: Board;
      experiences: Experience[];
      /**
       * Saved ids this page could not turn into anything to look at.
       *
       * Reported rather than dropped. Silently filtering these is what let
       * the board claim "Nothing saved yet" to somebody looking at two saved
       * items in the sidebar beside it.
       */
      unresolved: string[];
      /** What this person may do here. A shared board is not always editable. */
      role: BoardRole;
    }
  | { status: "signed-out" }
  | { status: "not-found" }
  | { status: "error" };

/**
 * **A board item is an id. What it resolves against decides what the board
 * says is on it.**
 *
 * The bug this fixes, from signed-in production screenshots: a sidebar saying
 * *My Places — 2 experiences saved*, listing **Ultimate 90s Night** and
 * **Canyon Frights**, beside a board page saying **"Nothing saved yet."**
 * And a sidebar saying six, with a board showing four.
 *
 * The two surfaces resolved the same ids against two different corpora.
 * Discovery's sidebar reads `/discovery/candidates` — 2,683 subjects of every
 * kind. This page read `/places` — **393 Places and nothing else**:
 *
 * ```
 * candidates   Organization 1584 · Activity 390 · Event 377 · Place 323 · Experience 9
 * places       393 Places
 * ```
 *
 * So every saved Event and every saved Organization vanished on the way to the
 * board. Both screenshots are the same cause: *Canyon Frights* and *Ultimate
 * 90s Night* are Events, *Swan Lake Market & Garden* is an Organization, and
 * the four that survived Case A — Kalamoir Park, Gambell Farms, Silver Star
 * Foothills, Silver Star Mountain Resort — are all Places.
 *
 * ## Both corpora, not the other one
 *
 * Measured against production: **70 Places are in `/places` and not in the
 * candidate feed** — Sovereign Lake Nordic Centre, UBC Museum of Anthropology,
 * Kekuli Bay Campground. Swapping one source for the other would have fixed
 * the Events and broken those, so this reads both and prefers the candidate,
 * which is the shape Discovery itself shows. Nothing that resolved yesterday
 * stops resolving today.
 *
 * ## And what still does not resolve is said out loud
 *
 * `unresolved` carries the rest. A board that quietly drops a row is the
 * defect; a board that says it cannot show one is a board telling the truth.
 */
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
    const [items, candidates, places] = await Promise.all([
      // Read on the owner's behalf — Atlas answers only for an owner and knows
      // nothing about sharing. Passport already decided this person may look.
      listBoardItemsFor(id, access.ownerId),
      // Either corpus may be unreachable without the board becoming a lie
      // about its own contents; whatever does answer still resolves what it
      // can, and the rest is reported rather than dropped.
      listDiscoveryCandidates().catch(() => []),
      listPlaces().catch(() => []),
    ]);

    const experienceById = new Map<string, Experience>();
    // Places first, candidates over the top: where Atlas holds both, the
    // candidate is what Discovery showed when the person pressed save, so it
    // is what the board should show back to them.
    for (const place of places) {
      experienceById.set(place.id, placeToExperience(place));
    }
    for (const candidate of candidates) {
      experienceById.set(candidate.id, candidateToExperience(candidate));
    }

    const experiences: Experience[] = [];
    const unresolved: string[] = [];
    for (const item of items) {
      const experience = experienceById.get(item.experienceId);
      if (experience) experiences.push(experience);
      else unresolved.push(item.experienceId);
    }
    return { status: "ok", board, experiences, unresolved, role: access.role };
  } catch {
    return { status: "error" };
  }
}
