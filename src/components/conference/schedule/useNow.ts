"use client";

import { useEffect, useState } from "react";

/**
 * **The conference's clock, in the browser.** The server says what time it
 * is when the page is made (`serverNow`); the browser keeps counting from
 * there, so a countdown ticks without a reload, a phone whose clock is a few
 * minutes out still agrees with the agenda, and a pinned walkthrough clock
 * (development only) stays pinned.
 */
export function useNow(serverNow: string, everyMs = 15_000): Date {
  const [offset] = useState(() => Date.parse(serverNow) - Date.now());
  const [now, setNow] = useState(() => new Date(Date.parse(serverNow)));
  useEffect(() => {
    const tick = () => setNow(new Date(Date.now() + offset));
    tick();
    const t = window.setInterval(tick, everyMs);
    return () => window.clearInterval(t);
  }, [offset, everyMs]);
  return now;
}
