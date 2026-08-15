"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TraceEmission } from "./traceActions";

const OPEN_STATE_STORAGE_KEY = "atlas-learning-tracer-open";

interface TraceContextValue {
  readonly emission: TraceEmission | null;
  readonly open: boolean;
  /** True when a new emission arrived while the panel was closed — clears the moment the panel opens. Lets the floating launcher show a quiet "something happened" dot without forcing the panel open, which is the whole point of a DevTools-style tool. */
  readonly hasUnseen: boolean;
  /** Call this from wherever a meaningful action actually finishes — never speculatively, only after the real work succeeded. */
  readonly record: (emission: TraceEmission) => void;
  readonly close: () => void;
  readonly toggleOpen: () => void;
}

const TraceContext = createContext<TraceContextValue | null>(null);

/**
 * The Learning Tracer's one piece of shared runtime state — deliberately
 * small. This is not a generalized event bus: it holds exactly one thing
 * (the most recent `TraceEmission`) and exposes exactly one way to change
 * it (`record`). Any client component under this provider can call
 * `useTrace().record(...)` directly after a real action completes, instead
 * of threading a callback prop up through components that have nothing to
 * do with learning or tracing.
 *
 * Mounted once, at the Curator Workbench layout level
 * (`app/admin/layout.tsx`), so the same emission and panel
 * open/closed state survive navigating between Explorer, Duplicates, and
 * the overview page — not re-created per page.
 *
 * Curator Workbench v2: `record()` used to force the panel open on every
 * traced action — the opposite of the DevTools-style tool this is meant to
 * be (hidden until a curator explicitly asks for it). It now only updates
 * `emission` and flips `hasUnseen`; opening is exclusively the floating
 * launcher's job. Open/closed state is persisted to `localStorage` (a real
 * browser API in this actual app — unrelated to the "no browser storage"
 * rule for chat artifacts) so it survives a page reload, read lazily on
 * mount to avoid a server/client hydration mismatch.
 */
export function TraceProvider({ children }: { children: ReactNode }) {
  const [emission, setEmission] = useState<TraceEmission | null>(null);
  const [open, setOpen] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);

  // Read once, after mount — localStorage doesn't exist during SSR, and
  // reading it during the initial render would make the server- and
  // client-rendered output disagree. This is the one legitimate case for
  // calling setState from inside an effect: syncing from a browser API
  // React can't see, not deriving state React already owns.
  useEffect(() => {
    const stored = window.localStorage.getItem(OPEN_STATE_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real external source (localStorage) after mount, not a derivable-from-props value
    if (stored === "true") setOpen(true);
  }, []);

  // Purely a write to an external system — no React state changes here, so
  // this one needs no exception to the "no setState in effects" rule.
  useEffect(() => {
    window.localStorage.setItem(OPEN_STATE_STORAGE_KEY, String(open));
  }, [open]);

  // `record` needs to know the *current* open state to decide whether to
  // flag an unseen emission, without depending on `open` itself (that would
  // recreate `record` — and every consumer's effect that calls it — on
  // every open/close toggle). Reading it inside the functional state
  // updater sidesteps that without an extra ref.
  const record = useCallback((next: TraceEmission) => {
    setEmission(next);
    setOpen((currentlyOpen) => {
      if (!currentlyOpen) setHasUnseen(true);
      return currentlyOpen;
    });
  }, []);

  const close = useCallback(() => setOpen(false), []);
  // Clearing `hasUnseen` lives here, in the actual event handler that opens
  // the panel — not in an effect reacting to `open` changing — so it fires
  // exactly when a curator opens it, nothing more indirect than that.
  const toggleOpen = useCallback(() => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) setHasUnseen(false);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ emission, open, hasUnseen, record, close, toggleOpen }),
    [emission, open, hasUnseen, record, close, toggleOpen],
  );

  return (
    <TraceContext.Provider value={value}>{children}</TraceContext.Provider>
  );
}

/** Throws outside a TraceProvider — a missing provider should fail loudly during development, not silently no-op. */
export function useTrace(): TraceContextValue {
  const ctx = useContext(TraceContext);
  if (!ctx) {
    throw new Error("useTrace() must be called from within a <TraceProvider>.");
  }
  return ctx;
}
