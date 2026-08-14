import type { Metadata } from "next";
import { OctoberPassportExperiment } from "./OctoberPassportExperiment";

export const metadata: Metadata = {
  title: "ELK Labs — October Passport",
  robots: { index: false, follow: false },
};

/**
 * /about/experiment-03-october-passport — the flagship seasonal-
 * personality prototype. Real weather/persona/After-Dark filtering, a
 * real always-on ambient layer with a genuinely computed moon phase, two
 * real camera features, and a History section built from real, sourced
 * local history rather than invented lore. `noindex`, same discipline as
 * every ELK Labs sandbox.
 *
 * Thin server wrapper only — the whole experience lives in
 * `OctoberPassportExperiment.tsx` plus its four sibling client
 * components (`AmbientLayer`, `GhostPortrait`, `ScareCam`, and the
 * shared `useCamera` hook the latter two are built on).
 */
export default function OctoberPassportPage() {
  return <OctoberPassportExperiment />;
}
