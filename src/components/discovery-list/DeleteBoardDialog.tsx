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

/**
 * Confirmation gate for deleting the active board, light-themed
 * equivalent of labs/discovery-space/DeleteBoardDialog.tsx. Same
 * controlled-by-boardName-presence pattern.
 */
export function DeleteBoardDialog({
  boardName,
  isDeleting,
  onOpenChange,
  onConfirm,
}: DeleteBoardDialogProps) {
  return (
    <Dialog open={boardName !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border border-[#8a5a24]/20 bg-[#fbf5e6] text-[#2b2015]">
        {boardName && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-lg text-[#2b2015]">
                Delete &ldquo;{boardName}&rdquo;?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[#2b2015]/60">
              This removes the board and everything saved to it. This can&apos;t
              be undone.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-[#8a5a24]/20 bg-white/50 px-3 py-2.5 text-sm text-[#2b2015]/70 transition-colors hover:border-[#8a5a24]/40 hover:bg-white/70 hover:text-[#2b2015] disabled:pointer-events-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={onConfirm}
                className="rounded-lg border border-red-600/30 bg-red-600/10 px-3 py-2.5 text-sm text-red-700 transition-colors hover:border-red-600/50 hover:bg-red-600/20 disabled:pointer-events-none disabled:opacity-50"
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
