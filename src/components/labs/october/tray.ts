"use client";

import { useSyncExternalStore } from "react";

/**
 * **What you have collected, without leaving where you are collecting it.**
 *
 * The question this prototypes is narrow: *does a person have to go to My
 * October to see what is in My October?* Today they do, and leaving a
 * discovery surface to check is how a session ends. So the labs keep a running
 * list in the corner.
 *
 * ## It mirrors the database, it is not a second one
 *
 * Saving still goes through `useKeeping` — same `PUT`, same row, same table.
 * This store holds only the **names**, so the drawer can say *Field of
 * Screams* instead of a uuid, and it is seeded on first paint from what the
 * server already said was kept. Nothing is written here that was not written
 * there first, and a refresh throws all of it away and asks the database
 * again. If the two ever disagreed, this one is the one that is wrong.
 */

export interface TrayItem {
  readonly id: string;
  readonly name: string;
  /** The temporal label, exactly as the card showed it. */
  readonly when: string;
}

let items: readonly TrayItem[] = [];
let seeded = false;
const listeners = new Set<() => void>();

const announce = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * What the server said was already kept, applied once per page load.
 *
 * Guarded because several cards mount at once and each one would otherwise
 * re-seed the list out from under the others.
 */
export function seedTray(initial: readonly TrayItem[]): void {
  if (seeded) return;
  seeded = true;
  items = initial;
  announce();
}

export function addToTray(item: TrayItem): void {
  if (items.some((i) => i.id === item.id)) return;
  items = [...items, item];
  announce();
}

export function removeFromTray(id: string): void {
  if (!items.some((i) => i.id === id)) return;
  items = items.filter((i) => i.id !== id);
  announce();
}

/** For tests, which share a module instance across cases. */
export function emptyTray(): void {
  items = [];
  seeded = false;
  announce();
}

const EMPTY: readonly TrayItem[] = [];

export function useTray(): readonly TrayItem[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    // The server renders no tray. Returning the live list here would make the
    // first client frame disagree with the HTML, which React calls a
    // hydration error and a person sees as the page flickering.
    () => EMPTY,
  );
}
