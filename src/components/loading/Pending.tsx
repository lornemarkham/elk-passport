"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import { hold } from "./progress";

/**
 * **"Kelowna is loading" — said by the page, while the old answer stays put.**
 *
 * A page whose server reads the town from its address (Christmas) changes
 * town with a navigation, and a navigation inside a transition keeps showing
 * the old page until the new one is ready. That is right — results should not
 * blank to a skeleton for a refresh — but on its own it is also silent: in
 * production the bar went on saying "Vernon" for seconds after Kelowna was
 * picked. A `PendingProvider` holds that transition so that:
 *
 * - the control that started it can say what is coming (`label`),
 * - `PendingContent` dims what is now out of date and marks it `aria-busy`,
 * - the top line (`NavigationProgress`) runs for exactly as long.
 *
 * Nothing is removed and nothing is covered: the old results stay readable,
 * and tappable, until the new ones replace them.
 */
interface PendingRegion {
  readonly pending: boolean;
  /** What is on its way, in the words of the control that asked ("Kelowna"). */
  readonly label?: string;
  readonly start: (label: string, navigate: () => void) => void;
}

const Region = createContext<PendingRegion | null>(null);

export function usePendingRegion(): PendingRegion {
  const shared = useContext(Region);
  const own = usePendingState();
  return shared ?? own;
}

function usePendingState(): PendingRegion {
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState<string>();
  useHoldWhile(pending);
  return {
    pending,
    ...(pending && label ? { label } : {}),
    start: (next, navigate) => {
      setLabel(next);
      startTransition(navigate);
    },
  };
}

/** Keep the top line running while `busy` is true. */
export function useHoldWhile(busy: boolean): void {
  useEffect(() => {
    if (!busy) return;
    return hold();
  }, [busy]);
}

export function PendingProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const region = usePendingState();
  return <Region.Provider value={region}>{children}</Region.Provider>;
}

/**
 * The part of a page that goes out of date while its region is pending:
 * dimmed, never hidden, and announced as busy.
 */
export function PendingContent({
  children,
  className = "",
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  const region = useContext(Region);
  const pending = region?.pending ?? false;
  return (
    <div
      aria-busy={pending || undefined}
      data-loading={pending ? "true" : undefined}
      data-testid="pending-content"
      className={`transition-opacity duration-200 motion-reduce:transition-none ${pending ? "opacity-50" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
