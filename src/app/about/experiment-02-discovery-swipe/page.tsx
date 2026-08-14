import type { Metadata } from "next";
import { DiscoverySwipeExperiment } from "./DiscoverySwipeExperiment";

export const metadata: Metadata = {
  title: "ELK Labs — Discovery Swipe",
  robots: { index: false, follow: false },
};

/**
 * /about/experiment-02-discovery-swipe — a real, working swipe-stack
 * prototype: drag a card (or use the four buttons), watch the Mood Board
 * grow, and see what Passport notices about you along the way. `noindex`,
 * same discipline as every ELK Labs sandbox — internal, findable only by
 * URL or from the wall.
 *
 * Thin server wrapper only. The whole interactive experience lives in
 * `DiscoverySwipeExperiment.tsx`, one client component for the same
 * reason `BachelorPartyExperiment.tsx` (Experiment 01) is: nearly
 * everything on this page reads or writes the same shared deck/board
 * state, so one shared state tree is the honest shape here, not a
 * violation of this app's usual small-component discipline.
 */
export default function DiscoverySwipeExperimentPage() {
  return <DiscoverySwipeExperiment />;
}
