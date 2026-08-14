import type { Metadata } from "next";
import { WonderExperiment } from "./WonderExperiment";

export const metadata: Metadata = {
  title: "ELK Labs — Wonder",
  robots: { index: false, follow: false },
};

/**
 * /about/experiment-04-wonder — deliberately the smallest, gentlest ELK
 * Labs sandbox so far. The brief was explicit: this is a sketchbook, not
 * a finished product — don't solve everything, don't over-engineer,
 * capture the heart. One light client component, a handful of small real
 * interactions (tap a theme open, pick a word, check off a memory, notice
 * a mission), and an open, unresolved list of real questions this sketch
 * raised rather than answered. `noindex`, same discipline as every ELK
 * Labs sandbox.
 */
export default function WonderExperimentPage() {
  return <WonderExperiment />;
}
