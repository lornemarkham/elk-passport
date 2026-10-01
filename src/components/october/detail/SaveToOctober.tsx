"use client";

import { Check, Heart, Loader2 } from "lucide-react";
import { useKeeping } from "@/components/october/save/keeping";
import type { OctoberKind } from "@/lib/october/types";

/**
 * **Save to My October.**
 *
 * The missing half of the journey. October was a directory that read well and
 * then ejected you to somebody else's ticket page: there was no way to keep a
 * thing, so *discover → understand → **save** → compare → act* stopped at the
 * third step and the product had no reason to be returned to.
 *
 * ## It writes to the thing that already exists
 *
 * `PUT /api/october/things/{id}` — the same rows `/october` and
 * `/october/mine` already read. No second store, no local shadow copy, and the
 * identity is the session's: the body carries only what the person was looking
 * at, never who they are.
 *
 * ## Saving is ours; buying is theirs
 *
 * This sits beside the external actions rather than among them, because they
 * are different promises. *Get tickets* hands the person to the organiser, who
 * owns the booking, the terms and the refund. *Save* keeps it here. A button
 * that blurred those two would be the one place this product could mislead
 * somebody about who they are dealing with.
 *
 * ## The saved state lives in `october/save/keeping.ts`
 *
 * A card, this hero button and the one at the foot of the page are the same
 * control drawn three sizes. They share one boolean by construction rather
 * than by being kept in step, and the fetch that changes it is written once.
 */
/**
 * The store moved to `october/save/keeping.ts` when cards learned to save
 * too: a card, this hero button and the one at the foot of the page are the
 * same control drawn three sizes, and they now share one boolean by
 * construction rather than by being kept in step.
 */
export function SaveToOctober({
  entityId,
  entityKind,
  name,
  startsAt,
  initiallySaved = false,
  signedIn,
  returnTo,
}: {
  readonly entityId: string;
  readonly entityKind: OctoberKind;
  readonly name: string;
  readonly startsAt?: string | null;
  readonly initiallySaved?: boolean;
  readonly signedIn: boolean;
  /**
   * Where signing in should land them. Defaults to the Atlas subject page,
   * which is where every caller but one lives — a film has no `/passport/:id`
   * to come back to, because it is not an Atlas entity.
   */
  readonly returnTo?: string;
}) {
  const { saved, state, toggle } = useKeeping(
    { entityId, entityKind, name, startsAt },
    initiallySaved,
  );
  const busy = state === "saving";
  const failed = state === "failed";

  if (!signedIn) {
    return (
      <a
        href={`/auth?next=${encodeURIComponent(returnTo ?? `/passport/${entityId}`)}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e9e6da]/25 px-5 text-sm text-[#e9e6da]/80 transition-colors hover:border-[#d09a4e]/60 hover:text-[#f3efe4]"
      >
        <Heart className="h-4 w-4" />
        Sign in to save
      </a>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        data-testid="save-to-october"
        aria-pressed={saved}
        className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors ${
          saved
            ? "border border-[#d09a4e]/60 bg-[#d09a4e]/15 text-[#d09a4e]"
            : "border border-[#e9e6da]/25 text-[#e9e6da]/85 hover:border-[#d09a4e]/60 hover:text-[#f3efe4]"
        } disabled:opacity-60`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4" />
        ) : (
          <Heart className="h-4 w-4" />
        )}
        {saved ? "Saved to My October" : "Save to My October"}
      </button>
      {failed && (
        <span className="text-xs text-[#d09a4e]/80">
          That didn&apos;t save. Try again?
        </span>
      )}
    </span>
  );
}
