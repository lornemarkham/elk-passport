"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While a game on the page is live, read the page again every thirty
 * seconds — only while the tab is visible. The server's cache (thirty
 * seconds) means a room full of readers is still one request to the league.
 */
export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, router]);
  return null;
}
