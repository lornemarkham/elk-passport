"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { parseOuting, type Outing } from "./outing";

/**
 * **Go Offline's memory: this browser, and nothing else.**
 *
 * The same shape as the GO HAVE A DAY theme store
 * (`src/components/ghad/theme.tsx`): `localStorage` read as an external store,
 * a server snapshot that is simply "nothing yet", and every read and write
 * wrapped so a private window costs the person their postcard, not the page.
 *
 * Nothing here is sent anywhere — see `outing.ts` for why that is a decision
 * left open rather than a missing feature.
 */
const KEY = "ghad.offline";

/** How many postcards the fridge holds before the oldest falls off. */
export const KEPT = 6;

export interface OfflineState {
  /** The pact being made, or the outing in progress. */
  readonly current?: Outing;
  /** Finished outings, newest first. */
  readonly past: readonly Outing[];
}

const EMPTY: OfflineState = { past: [] };

const listeners = new Set<() => void>();
let mirror: OfflineState | null = null;

function decode(raw: string | null): OfflineState {
  if (!raw) return EMPTY;
  try {
    const value = z
      .object({ current: z.unknown().optional(), past: z.array(z.unknown()) })
      .safeParse(JSON.parse(raw));
    if (!value.success) return EMPTY;
    const current = parseOuting(value.data.current);
    const past = value.data.past
      .map(parseOuting)
      .filter((o): o is Outing => Boolean(o))
      .slice(0, KEPT);
    return current ? { current, past } : { past };
  } catch {
    return EMPTY;
  }
}

const read = (): OfflineState => {
  if (mirror) return mirror;
  try {
    mirror = decode(window.localStorage.getItem(KEY));
  } catch {
    mirror = EMPTY;
  }
  return mirror;
};

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

export function writeOffline(next: OfflineState): void {
  mirror = { ...next, past: next.past.slice(0, KEPT) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(mirror));
  } catch {
    // Not kept past this visit. The day still happened.
  }
  for (const notify of [...listeners]) notify();
}

export function updateOffline(
  change: (state: OfflineState) => OfflineState,
): void {
  writeOffline(change(read()));
}

/** For tests, which mount many times in one process. See `forgetTheme`. */
export function forgetOffline(): void {
  mirror = null;
}

export function useOffline(): OfflineState {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
