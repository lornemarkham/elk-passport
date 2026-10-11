import type { Metadata } from "next";
import { PocketScreen } from "@/components/detox/PocketScreen";
import { ThemeProvider } from "@/components/ghad/theme";

export const metadata: Metadata = {
  title: "Put me away — Go offline",
};

/**
 * **`/detox/out` — phones away.**
 *
 * No nav on purpose. Everything a navigation bar offers is a reason to keep
 * the phone out, and this page has exactly one job.
 */
export default function PocketPage() {
  return (
    <ThemeProvider>
      <main className="min-h-screen bg-white">
        <PocketScreen />
      </main>
    </ThemeProvider>
  );
}
