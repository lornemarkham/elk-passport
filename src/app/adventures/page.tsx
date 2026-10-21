import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { StartAdventure } from "@/components/adventures/StartAdventure";
import { adventureSession } from "@/lib/adventures/server";
import { adventuresOf, type AdventureSummary } from "@/lib/adventures/store";
import { kindLabel } from "@/lib/adventures/kinds";
import { whenLabel } from "@/lib/adventures/present";

export const metadata: Metadata = {
  title: "Adventures — Passport",
  robots: { index: false },
};

/**
 * **Everything you're doing with other people.**
 *
 * Hockey Nights, conferences, days out, birthdays — every adventure you
 * started or joined, each with its own people and its own plan. Being in one
 * gives you nothing in any other.
 */
export default async function AdventuresPage() {
  const session = await adventureSession();

  let adventures: AdventureSummary[] | null = [];
  if (session) {
    adventures = await adventuresOf(session.db, session.user.id).catch(
      () => null,
    );
  }

  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
      <main className="bg-background min-h-screen">
        <div className="mx-auto max-w-3xl space-y-10 px-6 py-10 sm:py-14">
          <header>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Adventures
            </h1>
            <p className="text-muted-foreground mt-2">
              Atlas knows what&apos;s out there. This is who&apos;s going, and
              what you&apos;re doing together.
            </p>
          </header>

          {!session ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
              <Users className="text-muted-foreground h-8 w-8" aria-hidden />
              <p className="text-lg font-medium">Do things with people</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                Sign in to start a Hockey Night, a weekend or a day out, and
                send the people you want there a link.
              </p>
              <Link
                href="/auth?next=/adventures"
                className="bg-primary text-primary-foreground mt-2 rounded-full px-4 py-2 text-sm font-medium"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <>
              <section aria-labelledby="yours-heading" className="space-y-3">
                <h2 id="yours-heading" className="text-lg font-semibold">
                  Yours
                </h2>
                {adventures === null ? (
                  <p className="text-muted-foreground text-sm">
                    Couldn&apos;t load your adventures just now. Try again in a
                    moment.
                  </p>
                ) : adventures.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Nothing yet. Start one below, or open a link somebody sent
                    you.
                  </p>
                ) : (
                  <ul
                    className="divide-y rounded-xl border"
                    aria-label="Your adventures"
                  >
                    {adventures.map((a) => {
                      const when = whenLabel(a.startsOn, a.endsOn);
                      return (
                        <li key={a.id}>
                          <Link
                            href={`/adventures/${a.id}`}
                            className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3"
                          >
                            <span>
                              <span className="font-medium">{a.title}</span>
                              <span className="text-muted-foreground block text-xs">
                                {kindLabel(a.kind)}
                                {when ? ` · ${when}` : ""}
                                {a.destinationLabel
                                  ? ` · ${a.destinationLabel}`
                                  : ""}
                              </span>
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {a.role === "owner" ? "You started it" : "Joined"}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section aria-labelledby="start-heading" className="space-y-3">
                <h2 id="start-heading" className="text-lg font-semibold">
                  Start one
                </h2>
                <p className="text-muted-foreground text-sm">
                  Planning a day, a weekend or a trip? Start from{" "}
                  <Link href="/saved" className="text-foreground underline">
                    what you saved
                  </Link>{" "}
                  and choose <em>Plan with these</em>.
                </p>
                <StartAdventure />
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
