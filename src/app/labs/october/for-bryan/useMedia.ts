"use client";

import { useSyncExternalStore } from "react";

/**
 * A media query as an external store.
 *
 * Read this way rather than with an effect that calls `setState` on mount: no
 * cascading render, and the server snapshot is a fixed answer so hydration
 * never disagrees with itself. The first client frame corrects it before
 * anything on this page is visible.
 */
export function useMedia(query: string, onServer = false): boolean {
  return useSyncExternalStore(
    (changed) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", changed);
      return () => mq.removeEventListener("change", changed);
    },
    () => window.matchMedia(query).matches,
    () => onServer,
  );
}
