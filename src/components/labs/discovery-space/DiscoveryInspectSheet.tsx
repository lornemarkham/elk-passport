"use client";

import { Clock, Heart, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Experience } from "./types";

interface DiscoveryInspectSheetProps {
  experience: Experience | null;
  onOpenChange: (open: boolean) => void;
  onSave: (experience: Experience) => void;
  onReject: (experience: Experience) => void;
  onShelf: (experience: Experience) => void;
}

/**
 * The "focused overlay" the IMP-004 spec calls for in place of a full
 * experience detail page (explicitly a Non-Goal for this IMP). Opening it
 * never saves, rejects, or shelves on its own — those remain deliberate
 * actions taken from inside it. Closing it (Escape, backdrop, the built-in
 * close button) returns the user to exactly where Discovery was, since
 * nothing here navigates away from the field.
 */
export function DiscoveryInspectSheet({
  experience,
  onOpenChange,
  onSave,
  onReject,
  onShelf,
}: DiscoveryInspectSheetProps) {
  return (
    <Dialog open={experience !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-sm border border-white/10 bg-[#0b0b0b]/95 text-white/90 ring-white/10 backdrop-blur-xl",
        )}
      >
        {experience && (
          <>
            <div
              className={cn(
                "absolute -inset-16 -z-10 rounded-full bg-linear-to-br opacity-40 blur-3xl",
                experience.glow,
              )}
              aria-hidden
            />
            <DialogHeader>
              <DialogTitle className="font-heading text-lg text-white/95">
                {experience.name}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-white/60">{experience.tagline}</p>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  onSave(experience);
                  onOpenChange(false);
                }}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-3 text-xs text-white/70 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
              >
                <Heart className="size-4" />
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  onShelf(experience);
                  onOpenChange(false);
                }}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-3 text-xs text-white/70 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
              >
                <Clock className="size-4" />
                Shelf
              </button>
              <button
                type="button"
                onClick={() => {
                  onReject(experience);
                  onOpenChange(false);
                }}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-3 text-xs text-white/70 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
              >
                <X className="size-4" />
                Not now
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
