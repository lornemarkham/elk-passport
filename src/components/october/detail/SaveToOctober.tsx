"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Heart, Loader2 } from "lucide-react";
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
 */
/**
 * **One saved state, however many buttons the page draws.**
 *
 * A long October subject offers Save at the top, where somebody decides
 * quickly, and again at the foot, where somebody decides after reading. They
 * are two controls for one fact: two `useState`s would let the page show
 * *Saved* at the top and *Save* at the bottom at the same moment, which is a
 * page lying about what it just did.
 *
 * Deliberately not a context or a store module — it is one boolean per
 * subject, read by the only component that can change it.
 */
const savedByEntity = new Map<string, boolean>();
const listeners = new Set<() => void>();

function publishSaved(entityId: string, saved: boolean) {
  savedByEntity.set(entityId, saved);
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function SaveToOctober({
  entityId,
  entityKind,
  name,
  startsAt,
  initiallySaved = false,
  signedIn,
}: {
  readonly entityId: string;
  readonly entityKind: OctoberKind;
  readonly name: string;
  readonly startsAt?: string | null;
  readonly initiallySaved?: boolean;
  readonly signedIn: boolean;
}) {
  const saved = useSyncExternalStore(
    subscribe,
    () => savedByEntity.get(entityId) ?? initiallySaved,
    () => initiallySaved,
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!signedIn) {
    return (
      <a
        href={`/auth?next=${encodeURIComponent(`/passport/${entityId}`)}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e9e6da]/25 px-5 text-sm text-[#e9e6da]/80 transition-colors hover:border-[#d09a4e]/60 hover:text-[#f3efe4]"
      >
        <Heart className="h-4 w-4" />
        Sign in to save
      </a>
    );
  }

  const toggle = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/october/things/${entityId}`, {
        method: saved ? "DELETE" : "PUT",
        headers: { "content-type": "application/json" },
        ...(saved
          ? {}
          : {
              body: JSON.stringify({
                entityKind,
                name,
                startsAt: startsAt ?? null,
              }),
            }),
      });
      if (!response.ok) throw new Error(String(response.status));
      publishSaved(entityId, !saved);
    } catch {
      // Said plainly rather than swallowed: a save that silently failed would
      // send somebody back for a thing that was never kept.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
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
