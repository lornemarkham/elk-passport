"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/fairview3/store";

export type Link = "live" | "reconnecting" | "not-ready";

/**
 * **The room, polled.**
 *
 * Plain polling over one GET, because ~140 phones on a conference Wi-Fi
 * drop and reconnect, and a request that simply happens again is the most
 * graceful reconnect there is. The interval is short while the tab is
 * visible and paused while it is hidden; a failure backs off and the page
 * says "reconnecting" instead of lying. `refresh()` lets a page pull the
 * room right after it changed something itself.
 */
export function useLive(intervalMs = 2000): {
  snapshot: Snapshot | null;
  link: Link;
  refresh: () => Promise<void>;
} {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [link, setLink] = useState<Link>("reconnecting");
  const failures = useRef(0);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/fairview3/live", { cache: "no-store" });
      if (res.status === 503) {
        failures.current = 0;
        if (alive.current) setLink("not-ready");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as Snapshot;
      failures.current = 0;
      if (alive.current) {
        setSnapshot(body);
        setLink("live");
      }
    } catch {
      failures.current += 1;
      if (alive.current && failures.current >= 2) setLink("reconnecting");
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (document.visibilityState === "visible") await refresh();
      const wait =
        failures.current > 0
          ? Math.min(10_000, intervalMs * 2 ** failures.current)
          : intervalMs + Math.random() * 400;
      timer = setTimeout(tick, wait);
    };
    void tick();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, refresh]);

  return { snapshot, link, refresh };
}
