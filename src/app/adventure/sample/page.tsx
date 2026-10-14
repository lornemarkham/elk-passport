import type { Metadata } from "next";
import { PrintableAdventure } from "@/components/adventure/PrintableAdventure";
import { sampleAdventure } from "@/lib/analog/sample";

export const metadata: Metadata = {
  title: "A sample adventure — Go have a day",
  description:
    "What a printed Go have a day guide looks like: stops, a checklist, time and money at a glance, side quests and room to write.",
};

/**
 * **`/adventure/sample` — what the paper looks like before you've built a
 * day.** Real places, built by the real planner, with nothing published that
 * isn't. See `lib/analog/sample.ts` for exactly what the sample does and
 * doesn't claim.
 *
 * A static segment, so it takes precedence over `/adventure/[id]` without
 * touching that route.
 */
export default function SampleAdventurePage() {
  return <PrintableAdventure adventure={sampleAdventure()} />;
}
