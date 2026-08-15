import type { Metadata } from "next";
import { FishingWithEmi } from "./FishingWithEmi";

export const metadata: Metadata = {
  title: "ELK Labs — Fishing With Emi",
  description:
    "A first fishing adventure from Vernon through Trinity Valley to Hidden Lake. A real outing used as a Passport product prototype.",
  robots: { index: false, follow: false },
};

/**
 * /about/experiment-07-fishing-with-emi — the first ELK Labs sandbox built
 * from a real outing rather than a mood.
 *
 * The others explore what Passport could feel like. This one asks a
 * narrower, harder question: can Passport hold **more possibility than it
 * shows any one person**, and assemble the subset that fits a specific
 * uncle and a specific five-year-old? The Adventure Builder is the whole
 * argument — 22 modules, 13 on for Emi, and the 9 that are off stay
 * visible with the reason they were not chosen.
 *
 * It is also the first Labs page carrying real legal content, which
 * forced the honest part: a fishing regulation, a wildfire status and a
 * suggested game are all "content" and must not look alike. Hence three
 * evidence tiers, quoted primary sources on every legal rule, and a
 * before-you-go list that deliberately shows no status at all.
 *
 * `noindex`, same discipline as every ELK Labs sandbox — and more
 * important here than usual, since nothing on this page should ever be
 * found by someone searching for fishing regulations.
 */
export default function FishingWithEmiPage() {
  return <FishingWithEmi />;
}
