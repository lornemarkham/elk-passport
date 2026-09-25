import type { Metadata } from "next";
import { HasBeenHere } from "./HasBeenHere";

export const metadata: Metadata = {
  title: "October has been here",
  robots: { index: false, follow: false },
};

/**
 * `/labs/october/scariest-room/has-been-here`
 *
 * One reading of *The Scariest Room in Your House*, made playable. The route
 * names the scene and then the reading, because the other readings in the
 * sketchbook — the callback, "the other one", the second photograph — are
 * different scenes wearing the same seed and would be siblings here, not
 * replacements.
 *
 * Nothing above the experience explains it. The sketchbook is where the idea
 * is written down; this is the idea happening.
 */
export default function Page() {
  return <HasBeenHere />;
}
