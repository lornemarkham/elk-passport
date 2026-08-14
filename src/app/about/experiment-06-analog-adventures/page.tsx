import type { Metadata } from "next";
import { AnalogAdventuresExperiment } from "./AnalogAdventuresExperiment";

export const metadata: Metadata = {
  title: "ELK Labs — Analog Adventures",
  robots: { index: false, follow: false },
};

/**
 * /about/experiment-06-analog-adventures — the quietest sandbox so far,
 * and deliberately so. It explores the philosophy most in tension with
 * building an app at all: the best Passport session ends with the phone
 * being put away.
 *
 * So: no camera, no soundscape, no ambient motion. One real interaction
 * (packing for a Saturday on the Sugar Lake FSR), and a page that ends by
 * telling you to stop reading it. The honest part is the status on each
 * prep item — roughly half of a genuinely useful list is knowledge Atlas
 * has no way to hold yet. `noindex`, same discipline as every ELK Labs
 * sandbox.
 */
export default function AnalogAdventuresPage() {
  return <AnalogAdventuresExperiment />;
}
