"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Board } from "@/lib/data/boards-repo";
import type { Experience } from "./types";

interface SaveToBoardDialogProps {
  experience: Experience | null;
  boards: Board[];
  savingBoardId: string | null;
  onOpenChange: (open: boolean) => void;
  onChooseBoard: (boardId: string) => void;
}

/**
 * Shown only when there's more than one Board to choose from — see
 * DiscoverySpace.handleSaveRequest, which saves directly with no picker
 * when only one Board exists, avoiding an unnecessary click.
 *
 * Deliberately its own Dialog rather than content nested inside
 * DiscoveryInspectSheet's: Radix Dialogs don't nest cleanly (competing
 * focus traps), so Save closes the inspect sheet first (if it was open)
 * and opens this one instead of stacking them.
 */
export function SaveToBoardDialog({
  experience,
  boards,
  savingBoardId,
  onOpenChange,
  onChooseBoard,
}: SaveToBoardDialogProps) {
  return (
    <Dialog open={experience !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border border-white/10 bg-[#0b0b0b]/95 text-white/90 ring-white/10 backdrop-blur-xl">
        {experience && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-lg text-white/95">
                Save &ldquo;{experience.name}&rdquo; to&hellip;
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2 flex flex-col gap-1.5">
              {boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  disabled={savingBoardId !== null}
                  onClick={() => onChooseBoard(board.id)}
                  className={cn(
                    "rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-white/80 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  {board.name}
                </button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
