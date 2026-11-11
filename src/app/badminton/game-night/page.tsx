import type { Metadata } from "next";
import { GameNightDemo } from "@/components/badminton-demo/GameNightDemo";

export const metadata: Metadata = {
  title: "Badminton Game Night — demo",
  description:
    "A fictional badminton night: 25 made-up players, 4 doubles courts, levels, scores, wins and losses, a waiting queue with estimated waits, and automatic rotation. Runs in your browser.",
  robots: { index: false, follow: false },
};

/**
 * **Badminton Game Night, the scoreboard demo.** Everyone here is fictional;
 * no account, server or database is involved. See
 * `src/lib/badminton-demo/scoreboard.ts`.
 */
export default function BadmintonGameNightDemoPage() {
  return <GameNightDemo />;
}
