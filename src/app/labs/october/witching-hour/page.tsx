import type { Metadata } from "next";
import { WitchingHour } from "./WitchingHour";

export const metadata: Metadata = {
  title: "Witching Hour — Passport Labs",
  robots: { index: false, follow: false },
};

/**
 * `/labs/october/witching-hour` — the first October scene, as an experiment.
 * Not linked from anywhere. Reached by knowing it exists.
 */
export default function WitchingHourPage() {
  return <WitchingHour />;
}
