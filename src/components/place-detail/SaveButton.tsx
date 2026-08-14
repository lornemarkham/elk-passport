"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createBoard,
  listBoardItems,
  listBoards,
  removeExperienceFromBoard,
  saveExperienceToBoard,
} from "@/lib/data/boards-repo";
import {
  getStoredActiveBoardId,
  setStoredActiveBoardId,
} from "@/lib/data/activeBoardStorage";

type State = "loading" | "idle" | "saving";

/**
 * The one client island on an otherwise server-rendered page. Reuses
 * exactly the same board data path Discovery already uses
 * (`boards-repo.ts`, `activeBoardStorage.ts`) — same active-board
 * resolution (persisted choice, or Atlas's first board), so saving a
 * place here and opening a board in Discovery show the same state,
 * because it's the same state. Not lifted into a shared hook: Discovery's
 * own board-resolution logic stays exactly where it is, unrefactored,
 * per this phase's explicit "leave Discovery almost entirely unchanged."
 *
 * One real addition beyond what Discovery's flow assumes: a visitor can
 * land directly on a Place Detail page (a shared link, a search result)
 * having never been through Discovery's own board setup, so zero boards
 * existing is a real first-run case here in a way it usually isn't for
 * someone who started at Discovery. Handled by creating a default board
 * on first save rather than a dead-end "no board" state.
 */
export function SaveButton({ placeId }: { placeId: string }) {
  const [state, setState] = useState<State>("loading");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const boards = await listBoards();
        if (cancelled) return;
        const storedId = getStoredActiveBoardId();
        const resolved =
          (storedId && boards.find((b) => b.id === storedId)) || boards[0];
        if (!resolved) {
          setState("idle");
          return;
        }
        const items = await listBoardItems(resolved.id);
        if (cancelled) return;
        setBoardId(resolved.id);
        setSaved(items.some((item) => item.experienceId === placeId));
        setState("idle");
      } catch (error) {
        console.error("Failed to load board state for Save button:", error);
        setState("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  async function toggleSave() {
    setState("saving");
    try {
      let targetBoardId = boardId;
      if (!targetBoardId) {
        const created = await createBoard("My Places");
        targetBoardId = created.id;
        setBoardId(created.id);
        setStoredActiveBoardId(created.id);
      }

      if (saved) {
        await removeExperienceFromBoard(targetBoardId, placeId);
        setSaved(false);
      } else {
        await saveExperienceToBoard(targetBoardId, placeId);
        setSaved(true);
        toast.success("Saved to your board.");
      }
    } catch (error) {
      console.error(`Failed to toggle save for place ${placeId}:`, error);
      toast.error("Couldn't update your board. Please try again.");
    } finally {
      setState("idle");
    }
  }

  return (
    <Button
      variant={saved ? "default" : "outline"}
      disabled={state !== "idle"}
      onClick={toggleSave}
    >
      {saved ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
