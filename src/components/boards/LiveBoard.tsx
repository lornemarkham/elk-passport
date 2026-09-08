"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Radio } from "lucide-react";
import { useResourceEvents } from "@/lib/collaboration/useResourceEvents";
import { CORE_EVENT_KINDS } from "@/lib/collaboration/eventKinds";

/**
 * **Keeps an open board honest while somebody else is changing it.**
 *
 * The pattern, and the only correct one: an event arrives, and the component
 * asks the *server* what the board looks like now. It never applies the
 * payload as a diff. A client that rebuilds state from events is wrong the
 * first time a laptop slept through one, and "the live view disagrees with a
 * reload" is a bug that costs a day to find.
 *
 * `router.refresh()` re-runs the Server Component that read the board, so the
 * refreshed view is the canonical one by construction rather than by care.
 *
 * Renders a small line rather than nothing, because a board that silently
 * rearranges itself is unsettling — somebody should be able to see that it
 * moved and why.
 */
export function LiveBoard({ boardId }: { boardId: string }) {
  const router = useRouter();
  const [lastChange, setLastChange] = useState<string | null>(null);

  useResourceEvents("board", boardId, (event) => {
    switch (event.kind) {
      case CORE_EVENT_KINDS.itemAdded:
        setLastChange("Someone added a place.");
        break;
      case CORE_EVENT_KINDS.itemRemoved:
        setLastChange("Someone removed a place.");
        break;
      case CORE_EVENT_KINDS.boardRenamed:
        setLastChange("This board was renamed.");
        break;
      case CORE_EVENT_KINDS.memberJoined:
        setLastChange("Someone joined this board.");
        break;
      default:
        setLastChange("This board changed.");
    }
    router.refresh();
  });

  if (!lastChange) return null;

  return (
    <p
      className="text-muted-foreground mb-4 inline-flex items-center gap-1.5 text-xs"
      role="status"
      data-testid="live-board-notice"
    >
      <Radio className="h-3.5 w-3.5" aria-hidden />
      {lastChange}
    </p>
  );
}
