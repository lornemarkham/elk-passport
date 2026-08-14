import type { Metadata } from "next";
import { BachelorPartyExperiment } from "./BachelorPartyExperiment";

export const metadata: Metadata = {
  title: "ELK Labs — HELL YEAH: The Bachelor Party Experiment",
  robots: { index: false, follow: false },
};

/**
 * /about/experiment-01-bachelor-party — a second, deliberately extreme
 * sandbox under Experiment 01 (alongside `/about/experiment-01-discovery-space`,
 * which tested pacing; this one tests joy as a design constraint against
 * one intentionally non-representative persona: six loud friends planning
 * a bachelor weekend). `noindex`, same discipline as `/about/vision` and
 * the discovery-space sandbox — internal, findable only by URL or from
 * the wall.
 *
 * Thin server wrapper only (metadata) — the entire interactive experience
 * lives in `BachelorPartyExperiment.tsx`, a single client component. See
 * that file's own doc comment for why this page doesn't split into many
 * small islands the way most of this app does: nearly everything here
 * reads or writes one shared "room energy," so one shared state tree is
 * the honest shape for this specific prototype, not a violation of the
 * usual discipline.
 */
export default function BachelorPartyExperimentPage() {
  return <BachelorPartyExperiment />;
}
