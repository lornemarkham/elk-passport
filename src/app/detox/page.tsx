import type { Metadata } from "next";
import { GoOffline } from "@/components/detox/GoOffline";
import { ThemeProvider } from "@/components/ghad/theme";
import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";

export const metadata: Metadata = {
  title: "Go offline — plan it, print it, go",
  description:
    "Passport finds you a day made of real places and puts it on paper. Then the phones go away and the day is yours.",
};

/**
 * **`/detox` — Go Offline.**
 *
 * The route is named for the lane that built it; the person only ever reads
 * **Go offline**. "Digital detox" is the vocabulary of screen-time charts and
 * wellness apps, and `src/components/go/modes.ts` already says, on the record,
 * that this is not one of those. See `src/lib/detox/README.md`.
 *
 *     /detox        the idea, the doors into /go, the pact, "Phones away"
 *     /detox/out    the last screen before the phone goes in the glovebox
 *     /detox/back   welcome back, a postcard, and the next one
 *
 * Planning and printing are `/go` and `/go/print`. This route adds what
 * happens around the paper, not a second copy of it.
 */
export default async function GoOfflinePage() {
  const user = await currentUser();
  return (
    <ThemeProvider>
      <PassportNav displayName={user?.displayName ?? null} />
      <main className="min-h-screen bg-white">
        <GoOffline />
      </main>
    </ThemeProvider>
  );
}
