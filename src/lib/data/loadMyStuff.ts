import "server-only";
import { currentUser } from "@/lib/auth/currentUser";
import { listBoardItemsFor } from "./boards-server";
import { listDiscoveryCandidates, listPlaces } from "./atlas-repo";
import {
  candidateToExperience,
  placeToExperience,
} from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";
import {
  boardsVisibleTo,
  type BoardRole,
} from "@/lib/collaboration/boardAccess";
import { ideasBoardOf, ideasFrom } from "@/lib/pocket/ideas";
import type { Board } from "./boards-repo";

export interface Collection {
  readonly board: Board;
  readonly role: BoardRole;
  /** How many things are in it. */
  readonly count: number;
  /** A picture from the first thing in it that has one. */
  readonly cover?: string;
}

export type MyStuff =
  | {
      readonly status: "ok";
      /** Where a new save goes; `null` until their first save makes one. */
      readonly ideasBoard: Board | null;
      /** Every idea Passport can name, newest first. */
      readonly ideas: readonly Experience[];
      /** For each idea, every board of theirs it is on — what Remove clears. */
      readonly holders: Readonly<Record<string, readonly string[]>>;
      /** Saved ids nothing could name. Shown, never dropped. */
      readonly unresolved: readonly string[];
      /** Every board but the ideas board: their own, and ones shared with them. */
      readonly collections: readonly Collection[];
    }
  | { readonly status: "signed-out" }
  | { readonly status: "error" };

/**
 * **My Stuff, read once** — the owner's brief, 2026-11-08 (P3): one place for
 * ideas, collections, adventures and memories, where saving never required a
 * collection and collections are optional.
 *
 * This reads the same Atlas boards the Pocket does (`ideas.ts`): Ideas is the
 * union of every board the person owns; Collections is every board except the
 * one saves go to — including boards someone shared with them. Nothing is
 * migrated. `loadSaved` (one board) stays for the surfaces that still want it.
 */
export async function loadMyStuff(): Promise<MyStuff> {
  const user = await currentUser();
  if (!user) return { status: "signed-out" };

  try {
    const [access, candidates, places] = await Promise.all([
      boardsVisibleTo(user),
      listDiscoveryCandidates().catch(() => []),
      listPlaces().catch(() => []),
    ]);
    const boards = access.map(({ board, role }) => ({ ...board, role }));
    // Their first own board, the same rule the Pocket uses (`useIdeas`), so
    // the board saves go to is never also listed as a collection.
    const home = ideasBoardOf(boards, null);
    const read = await Promise.all(
      access.map(async ({ board, role, ownerId }) => ({
        board: { ...board, role },
        // A board someone shared that can't be read right now is listed
        // empty; one of their own that can't be read is an error, said so.
        items: await listBoardItemsFor(board.id, ownerId).catch((error) => {
          if (role === "owner") throw error;
          return [];
        }),
      })),
    );

    const known = new Map<string, Experience>();
    for (const place of places) known.set(place.id, placeToExperience(place));
    for (const candidate of candidates)
      known.set(candidate.id, candidateToExperience(candidate));

    const merged = ideasFrom(read, home?.id ?? null);
    const ideas: Experience[] = [];
    const unresolved: string[] = [];
    const holders: Record<string, readonly string[]> = {};
    for (const idea of merged) {
      holders[idea.experienceId] = idea.boardIds;
      const experience = known.get(idea.experienceId);
      if (experience) ideas.push(experience);
      else unresolved.push(idea.experienceId);
    }

    const collections: Collection[] = read
      .filter(({ board }) => board.id !== home?.id)
      .map(({ board, items }) => {
        const cover = items
          .map((i) => known.get(i.experienceId))
          .map(
            (e) =>
              e?.heroMedia?.src ??
              e?.presentationImage?.url ??
              e?.contextualMedia?.heroUrl,
          )
          .find(Boolean);
        const { role, ...plain } = board;
        return {
          board: plain,
          role,
          count: items.length,
          ...(cover ? { cover } : {}),
        };
      });

    return {
      status: "ok",
      ideasBoard: access.find((a) => a.board.id === home?.id)?.board ?? null,
      ideas,
      holders,
      unresolved,
      collections,
    };
  } catch {
    return { status: "error" };
  }
}
