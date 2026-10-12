"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * **Keeps a shared page honest while it is open.**
 *
 * Re-asks the server every few seconds, but only while the tab is visible: a
 * phone in a pocket asks nothing. A refresh keeps what a person is typing, so
 * it never eats a half-written name.
 */
export function LiveRefresh({ everySeconds = 8 }: { everySeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, everySeconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, everySeconds]);
  return null;
}
