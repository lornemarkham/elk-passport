"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import type { OctoberKind } from "@/lib/october/types";

/**
 * **Whether a thing is in somebody's October, and how it gets there.**
 *
 * One boolean per subject, shared by every control that can change it. There
 * are now several: the hero of a detail page, the foot of that same page, and
 * a card on any October surface. They are not copies of a control — they are
 * the same control drawn in different sizes, and if two of them could disagree
 * the page would be lying about what it had just done.
 *
 * ## Why a module-level store and not a context
 *
 * A context would have to wrap every October surface and thread a provider
 * through server components that have no business knowing about it. This is
 * one `Map<string, boolean>` and a set of listeners, read through
 * `useSyncExternalStore`, which is the smallest mechanism that makes
 * "October home and the card on it agree" true by construction.
 *
 * The server's answer is still the authority on first paint: each control is
 * told whether it was saved, and the store only speaks for subjects somebody
 * has touched *in this tab since it loaded*. A refresh goes back to the
 * database, which is where the truth lives.
 */
const savedByEntity = new Map<string, boolean>();
const listeners = new Set<() => void>();

function publish(entityId: string, saved: boolean): void {
  savedByEntity.set(entityId, saved);
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Nothing has been touched yet. Exported for tests, which share a module. */
export function forgetEverythingKept(): void {
  savedByEntity.clear();
  for (const listener of listeners) listener();
}

export interface Keepable {
  readonly entityId: string;
  readonly entityKind: OctoberKind;
  readonly name: string;
  /** An Event's start, so My October can sort it without re-reading Atlas. */
  readonly startsAt?: string | null;
}

export type KeepState = "idle" | "saving" | "failed";

/**
 * **The one way anything is kept.**
 *
 * `PUT` and `DELETE` on `/api/october/things/{id}` — the same rows
 * `/october/mine` reads and the same route the detail page has always used.
 * No second store, no local shadow copy, and the identity is the session's:
 * the body carries only what the person was looking at, never who they are.
 *
 * ## Nothing is claimed before it is true
 *
 * `saved` flips only after the server has answered, and a failure leaves it
 * exactly where it was. The optimistic version of this — flip, then reconcile
 * — is the version that tells somebody a thing is waiting for them when it is
 * not, and they find out in three weeks by opening an empty October.
 *
 * ## Saving twice is saving once
 *
 * `wantThing` reads before it inserts and the table's primary key is
 * `(user_id, entity_id)`, so a double click, a double tap or two cards for the
 * same subject produce one row. The `busy` guard here is about the *control*
 * not flickering, not about the data.
 */
export function useKeeping(thing: Keepable, initiallySaved: boolean) {
  const saved = useSyncExternalStore(
    subscribe,
    () => savedByEntity.get(thing.entityId) ?? initiallySaved,
    () => initiallySaved,
  );
  const [state, setState] = useState<KeepState>("idle");

  const toggle = useCallback(async () => {
    if (state === "saving") return;
    setState("saving");
    try {
      const response = await fetch(
        `/api/october/things/${encodeURIComponent(thing.entityId)}`,
        {
          method: saved ? "DELETE" : "PUT",
          headers: { "content-type": "application/json" },
          ...(saved
            ? {}
            : {
                body: JSON.stringify({
                  entityKind: thing.entityKind,
                  name: thing.name,
                  startsAt: thing.startsAt ?? null,
                }),
              }),
        },
      );
      if (!response.ok) throw new Error(String(response.status));
      publish(thing.entityId, !saved);
      setState("idle");
    } catch {
      // Said, not swallowed. A save that failed quietly sends somebody back
      // for a thing that was never kept.
      setState("failed");
    }
  }, [
    saved,
    state,
    thing.entityId,
    thing.entityKind,
    thing.name,
    thing.startsAt,
  ]);

  return { saved, state, toggle } as const;
}
