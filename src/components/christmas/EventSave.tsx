"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { eventHref } from "@/domain/christmas/eventPage";
import { cn } from "@/lib/utils";
import { usePicks } from "./Picks";

/**
 * **The one Save, large, for an event's own page.** The same action as the
 * card's (`toggleKeep`): it joins My Christmas List and Saved, and tapping it
 * again removes it.
 */
export function EventSave({
  id,
  title,
  className,
}: {
  readonly id: string;
  readonly title: string;
  readonly className?: string;
}) {
  const { isKept, saving, toggleKeep } = usePicks();
  const kept = isKept(id);
  return (
    <button
      type="button"
      onClick={() => void toggleKeep(id, { title, href: eventHref(id) })}
      disabled={saving.has(id)}
      aria-pressed={kept}
      aria-label={
        kept
          ? `Saved: ${title}. Tap to remove`
          : `Save ${title} to My Christmas List`
      }
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 px-6 text-base font-bold transition-colors disabled:opacity-60",
        kept
          ? "border-[#0f3b2b] bg-[#0f3b2b] text-white"
          : "border-[#0f3b2b] bg-white text-[#0f3b2b] hover:bg-[#eaf2ee]",
        className,
      )}
      data-testid="save-event"
    >
      {kept ? (
        <BookmarkCheck className="h-5 w-5" aria-hidden />
      ) : (
        <Bookmark className="h-5 w-5" aria-hidden />
      )}
      {kept ? "Saved — tap to remove" : "Save"}
    </button>
  );
}
