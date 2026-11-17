"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  endLink,
  getProgress,
  getServerProgress,
  isBusy,
  navigatesAway,
  startLink,
  subscribeProgress,
} from "./progress";

/**
 * **A thin line at the very top while the next page is on its way.**
 *
 * Production, measured 2026-11-17: picking Kelowna on Christmas left the page
 * saying "Vernon" for 1.4–4.4 s (8.3 s on a cold instance), and a place page
 * took 9–11 s to its first byte — both with nothing on screen to say a tap
 * had landed. This is the one signal every navigation shares: it starts on
 * the click (or a form's submit), not when the server answers, and finishes
 * when the address changes.
 *
 * - **Quiet when fast.** It appears only after 150 ms, so a cached page never
 *   flashes a bar.
 * - **Honest when slow.** It creeps towards — never reaches — the end while
 *   waiting, and stays as long as the wait does. It hides nothing: the
 *   numbers that made it necessary are fixed where they can be (see
 *   `getPlaceDetail`), not covered.
 * - **Still for reduced motion.** A steady line instead of a moving one.
 * - **Never in the way.** 3 px, no overlay, nothing to dismiss.
 *
 * Mounted by `ThemeProvider`, which every Go Have a Day surface already wraps
 * itself in; a page that nests two providers still draws one line.
 */
export function NavigationProgress() {
  const owner = useOwner();
  if (!owner) return null;
  return (
    <>
      <Listeners />
      <Line />
    </>
  );
}

function Listeners() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (navigatesAway(anchor.href, window.location)) startLink();
    };
    // A form whose `onSubmit` handles it in place (a fetch) names no
    // `action`; one that does, by GET, is a page load whether the browser
    // makes it or `next/form` does.
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = form.getAttribute("action");
      const method = (form.getAttribute("method") ?? "get").toLowerCase();
      // A GET form with somewhere to go always loads a page.
      if (action && method === "get") startLink();
    };
    // Back and Forward change the address themselves; a page that unmounts
    // is a navigation that finished.
    const onPop = () => endLink();
    document.addEventListener("click", onClick, true);
    window.addEventListener("submit", onSubmit);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("submit", onSubmit);
      window.removeEventListener("popstate", onPop);
      endLink();
    };
  }, []);
  return null;
}

const SHOW_AFTER_MS = 150;

function Line() {
  const busy = isBusy(
    useSyncExternalStore(subscribeProgress, getProgress, getServerProgress),
  );
  // idle → waiting (not yet shown) → shown → finishing (runs to the end, fades)
  const [phase, setPhase] = useState<"idle" | "shown" | "finishing">("idle");
  const [wasBusy, setWasBusy] = useState(busy);
  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (!busy && phase === "shown") setPhase("finishing");
    // A new wait while the last one fades starts again from the beginning.
    if (busy && phase === "finishing") setPhase("idle");
  }

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setPhase("shown"), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  useEffect(() => {
    if (phase !== "finishing") return;
    const timer = setTimeout(() => setPhase("idle"), 450);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "idle") return null;
  const finishing = phase === "finishing";
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      data-testid="nav-progress"
      data-state={finishing ? "done" : "loading"}
      role="progressbar"
      aria-label="Loading"
      aria-busy={!finishing}
    >
      {/* Creeps towards 85% and waits there: it never claims to be done. */}
      <style>{`@keyframes ghad-creep{from{width:8%}to{width:85%}}`}</style>
      <div
        className={
          "h-full motion-reduce:!w-full motion-reduce:!animate-none motion-reduce:!transition-none " +
          (finishing
            ? "w-full opacity-0 transition-[width,opacity] duration-300 ease-out"
            : "w-[85%] animate-[ghad-creep_8s_cubic-bezier(0.1,0.7,0.2,1)] opacity-100 motion-reduce:opacity-70")
        }
        style={{
          backgroundColor: "var(--ghad-accent, #B04E28)",
          boxShadow: "0 0 6px var(--ghad-accent, #B04E28)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// One line per page, however many providers mount it.

let owners: symbol[] = [];
const ownerListeners = new Set<() => void>();
const subscribeOwners = (l: () => void) => {
  ownerListeners.add(l);
  return () => ownerListeners.delete(l);
};
const getOwners = () => owners;
const NONE: symbol[] = [];

function useOwner(): boolean {
  const [me] = useState(() => Symbol("progress"));
  useEffect(() => {
    owners = [...owners, me];
    ownerListeners.forEach((l) => l());
    return () => {
      owners = owners.filter((o) => o !== me);
      ownerListeners.forEach((l) => l());
    };
  }, [me]);
  const all = useSyncExternalStore(subscribeOwners, getOwners, () => NONE);
  return all[0] === me;
}
