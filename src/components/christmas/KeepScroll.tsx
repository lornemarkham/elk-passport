"use client";

import { useEffect } from "react";

/** Set by the Christmas bar when the browser goes Back or Forward. */
export const POP_KEY = "__xmPop";
const key = () => `xm-scroll:${location.pathname}${location.search}`;

/**
 * **Back puts you where you were** (owner brief M1128: "preserve scroll
 * position", "support browser back and forward"). The landing page's
 * discovery streams in after the welcome, so on Back the page is briefly
 * shorter than it was and the browser's own restoration lands at the top.
 * This remembers how far down each address was (this tab only) and, when
 * the page was reached by Back or Forward, returns there once the page is
 * long enough — giving up after a few seconds rather than jumping late.
 */
export function KeepScroll() {
  useEffect(() => {
    let frame = 0;
    // Once the visitor follows a link or goes Back, the position is frozen:
    // the router scrolls the outgoing page to the top before it unmounts,
    // and that is not where they were.
    let leaving = false;
    const persist = (y: number) => {
      try {
        sessionStorage.setItem(key(), String(Math.round(y)));
      } catch {
        /* private mode: nothing remembered */
      }
    };
    const save = () => {
      if (leaving) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!leaving) persist(window.scrollY);
      });
    };
    let thaw: ReturnType<typeof setTimeout> | undefined;
    const leave = () => {
      persist(window.scrollY);
      leaving = true;
      // A link to somewhere on this same page leaves nothing.
      clearTimeout(thaw);
      thaw = setTimeout(() => (leaving = false), 2000);
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (a && !(a as HTMLAnchorElement).getAttribute("href")?.startsWith("#"))
        leave();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", leave);
    const popped =
      Date.now() -
        ((window as unknown as Record<string, number>)[POP_KEY] ?? 0) <
      1500;
    let target = 0;
    try {
      target = popped ? Number(sessionStorage.getItem(key()) ?? 0) : 0;
    } catch {
      target = 0;
    }
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const restore = () => {
      if (
        document.documentElement.scrollHeight - window.innerHeight >=
        target
      ) {
        window.scrollTo(0, target);
        return;
      }
      if (++tries < 40) timer = setTimeout(restore, 100);
    };
    if (target > 0) restore();
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", leave);
      clearTimeout(thaw);
      window.removeEventListener("scroll", save);
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return null;
}
