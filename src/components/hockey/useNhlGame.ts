"use client";

import { useEffect, useState } from "react";
import type { GameView } from "@/app/hockey/_server/game";

/** How often the page asks the league while a game is on. */
const LIVE_MS = 30_000;

/**
 * **The league's word on the game, for the one night on this page.**
 *
 * Asked once on arrival, then every 30s only while the page is visible and
 * the game is not over. A failure is silence: the hook keeps whatever it last
 * knew, and `available: false` means the page shows no score at all.
 */
export function useNhlGame(slug: string): GameView | null {
  const [view, setView] = useState<GameView | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    const ask = async () => {
      try {
        const res = await fetch(`/hockey/api/occasions/${slug}/game`, {
          cache: "no-store",
        });
        if (!res.ok || stopped) return;
        const next = (await res.json()) as GameView;
        if (!stopped) setView(next);
        if (next.game?.state === "final" || !next.available) return;
      } catch {
        // Offline for a moment; try again below.
      }
      if (!stopped) timer = window.setTimeout(tick, LIVE_MS);
    };
    const tick = () => {
      if (document.visibilityState === "visible") void ask();
      else timer = window.setTimeout(tick, LIVE_MS);
    };
    void ask();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [slug]);

  return view;
}
