"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteBoardDialogProps {
  boardName: string | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Confirmation gate for deleting the active board — open state is driven
 * by whether a boardName is present, same controlled pattern as
 * SaveToBoardDialog, so there's one way this file expresses "which
 * dialog is open" rather than a separate boolean that could drift out of
 * sync with what's actually being confirmed. */
export function DeleteBoardDialog({
  boardName,
  isDeleting,
  onOpenChange,
  onConfirm,
}: DeleteBoardDialogProps) {
  return (
    <Dialog open={boardName !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border border-white/10 bg-[#0b0b0b]/95 text-white/90 ring-white/10 backdrop-blur-xl">
        {boardName && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-lg text-white/95">
                Delete &ldquo;{boardName}&rdquo;?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-white/60">
              This removes the board and everything saved to it. This can&apos;t
              be undone.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/70 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={onConfirm}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-200 disabled:pointer-events-none disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Delete Board"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
