"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * **A workflow that happens without leaving the region.**
 *
 * ## Why in place rather than a page
 *
 * The Region workspace is where a curator works. Sending them to
 * `/admin/duplicates`, then `/admin/review`, then back, makes navigation
 * the connective tissue of the job — and every one of those trips loses
 * the context they were working in. **Only the Entity page earns a full
 * navigation**, because working on one entity genuinely is a change of
 * subject (ADR 028).
 *
 * ## Reuse, never rebuild
 *
 * This is a *host*, not a workflow. `AdminDuplicatesView` is rendered
 * inside it unmodified — the same component `/admin/duplicates` uses, so
 * there is exactly one duplicate-review implementation and no chance of
 * the two drifting apart. The pages stay where they are and keep working;
 * this gives their contents a second home.
 *
 * That constraint is what makes the consolidation cheap. A drawer that
 * reimplemented duplicate review would be a second surface to keep
 * correct, and the first time they disagreed a curator would have no way
 * to tell which was right.
 *
 * ## Built on the Dialog primitive already in the codebase
 *
 * Styled as a right-hand sheet rather than a centred modal, because these
 * are *working* surfaces — lists to scroll and decide through — not
 * confirmations. The region stays visible behind it, which is the whole
 * point: the curator can see the thing they are changing.
 */
export function RegionDrawer({
  title,
  description,
  trigger,
  children,
  wide,
}: {
  title: string;
  description: string;
  /** Rendered as-is; the caller owns how the opener looks. */
  trigger: (open: () => void) => React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className={`fixed top-0 right-0 left-auto flex h-full max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-l p-0 sm:max-w-none ${
            wide ? "w-full lg:w-[900px]" : "w-full lg:w-[720px]"
          }`}
        >
          <div className="border-border flex items-start gap-4 border-b px-6 py-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold">
                {title}
              </DialogTitle>
              {/* Never decorative. Every drawer says what this workflow is
                  for, because a curator meeting it for the first time
                  should not have to infer it from the contents. */}
              <DialogDescription className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
                {description}
              </DialogDescription>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>

          <div className="border-border text-muted-foreground border-t px-6 py-3 text-[13px]">
            Changes here apply immediately. Close the panel to see the region
            update.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
