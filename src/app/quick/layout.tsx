import type { ReactNode } from "react";

/**
 * **A quick experience is the whole screen.**
 *
 * Deliberately outside `/october`, which is the only way to escape October's
 * nav bar: the bar is right on every other October page — it is how you move
 * between Home, Discover and My October — and wrong here, where the point is
 * to be standing under a sky for fifteen seconds rather than browsing a
 * product.
 *
 * Nothing is lost by leaving the chrome behind: every beat has a visible
 * Close, and the last one offers both the save and the full detail page.
 */
export default function QuickLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <div data-theme="october">{children}</div>;
}
