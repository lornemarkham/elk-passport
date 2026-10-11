import type { Metadata } from "next";
import { GoOffline } from "@/components/detox/GoOffline";
import { ThemeProvider } from "@/components/ghad/theme";
import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";
import { dayQuery } from "@/lib/detox/day";
import { resolveDay } from "@/lib/detox/resolve";

export const metadata: Metadata = {
  title: "That's the plan — Go offline",
  description:
    "The end of planning. Keep the essentials on your phone, put the phones away, and go have the day.",
};

/**
 * **`/detox` — Go Offline.**
 *
 * The route is named for the lane that built it; the person only ever reads
 * **Go offline**. "Digital detox" is the vocabulary of screen-time charts and
 * wellness apps, and `src/components/go/modes.ts` already says, on the record,
 * that this is not one of those. See `src/lib/detox/README.md`.
 *
 *     /detox?stops=…  "that's the plan": what stays on the phone, the
 *                     optional pact, "Phones away"
 *     /detox          no day handed over: one link to /go, or go anyway
 *     /detox/out      the last screen before the phone goes in the glovebox
 *     /detox/back     welcome back, a postcard, and the next one (/go)
 *
 * GO HAVE A DAY's fourth step. It reads the same query `/go/print` reads, so a
 * day reaches it by the path it reaches the paper. Planning and printing are
 * `/go` and `/go/print`; nothing here re-plans or re-typesets.
 */
type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GoOfflinePage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const [user, resolved] = await Promise.all([
    currentUser(),
    resolveDay(query, dayQuery(query)),
  ]);
  return (
    <ThemeProvider>
      <PassportNav displayName={user?.displayName ?? null} />
      <main className="min-h-screen bg-white">
        <GoOffline
          {...(resolved.kind === "day" ? { day: resolved.day } : {})}
          unreachable={resolved.kind === "unreachable"}
        />
      </main>
    </ThemeProvider>
  );
}
