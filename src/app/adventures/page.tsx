import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { StartAdventure } from "@/components/adventures/StartAdventure";
import { AdventureCard } from "@/components/adventures/AdventureCard";
import { Eyebrow, PillLink, SectionHeading } from "@/components/adventures/kit";
import { adventureSession } from "@/lib/adventures/server";
import { adventureOverview, todayIn } from "@/lib/adventures/overview";
import { adventureStatus } from "@/lib/adventures/present";

export const metadata: Metadata = {
  title: "Adventures — Passport",
  robots: { index: false },
};

/**
 * **Everything you're doing, and with whom.**
 *
 * Days out, weekends, trips, Hockey Nights, conferences — every adventure you
 * started or joined, coming first, then drafts, then the ones you've done.
 * Being in one gives you nothing in any other.
 */
export default async function AdventuresPage() {
  const session = await adventureSession();
  const overview = session ? await adventureOverview(session) : null;
  const today = todayIn();
  const order = { today: 0, upcoming: 1, draft: 2, done: 3 } as const;
  const sorted = overview
    ? [...overview.adventures].sort((a, b) => {
        const sa = adventureStatus(a, { stops: 1, undecided: 0 }, today).stage;
        const sb = adventureStatus(b, { stops: 1, undecided: 0 }, today).stage;
        return (
          order[sa] - order[sb] ||
          (a.startsOn ?? "9999").localeCompare(b.startsOn ?? "9999")
        );
      })
    : [];

  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
      <ThemeProvider className="block">
        <main className="min-h-screen bg-white">
          <div className="mx-auto max-w-6xl px-4 pt-6 pb-20 sm:px-6 sm:pt-12">
            <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>Adventures</Eyebrow>
                <h1 className="ghad-display mt-2 text-[2.6rem] leading-[0.95] font-extrabold tracking-[-0.04em] text-[var(--gh-ink)] sm:text-7xl">
                  Go have a day.
                </h1>
                <p className="mt-3 max-w-xl text-lg text-[var(--gh-ink-soft)]">
                  Atlas knows what&apos;s out there. This is what you&apos;re
                  doing about it, and who&apos;s coming.
                </p>
              </div>
              <PillLink
                href="/adventures/new"
                variant="forest"
                data-testid="create-adventure"
                className="min-h-14 shrink-0 px-7 text-lg"
              >
                <Plus className="h-5 w-5" aria-hidden />
                Create an adventure
              </PillLink>
            </header>

            {!session ? (
              <div className="mt-10 rounded-[28px] bg-[var(--gh-cream)] px-6 py-14 text-center">
                <p className="ghad-display text-2xl font-extrabold">
                  Do things with people
                </p>
                <p className="mx-auto mt-2 max-w-md text-base text-[var(--gh-ink-soft)]">
                  Sign in to start a day out, a weekend or a Hockey Night, and
                  send the people you want there a link.
                </p>
                <PillLink
                  href="/auth?next=/adventures"
                  variant="primary"
                  className="mt-6"
                >
                  Sign in
                </PillLink>
              </div>
            ) : (
              <>
                <section aria-labelledby="yours-heading" className="mt-12">
                  <SectionHeading id="yours-heading" title="Yours" />
                  {overview === null ? (
                    <p className="mt-4 text-base text-[var(--gh-ink-soft)]">
                      Couldn&apos;t load your adventures just now. Try again in
                      a moment.
                    </p>
                  ) : sorted.length === 0 ? (
                    <p className="mt-4 text-base text-[var(--gh-ink-soft)]">
                      Nothing yet. Create one, start from{" "}
                      <Link href="/saved" className="font-semibold underline">
                        what you saved
                      </Link>
                      , or open a link somebody sent you.
                    </p>
                  ) : (
                    <ul
                      className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
                      aria-label="Your adventures"
                    >
                      {sorted.map((a) => (
                        <li key={a.id}>
                          <AdventureCard
                            adventure={a}
                            today={today}
                            {...(overview.glances[a.id]
                              ? { glance: overview.glances[a.id] }
                              : {})}
                            {...(overview.covers[a.id]
                              ? { cover: overview.covers[a.id] }
                              : {})}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section
                  id="something-else"
                  aria-labelledby="start-heading"
                  className="mt-16 rounded-[28px] bg-[var(--gh-cream)] p-5 sm:p-8"
                >
                  <SectionHeading id="start-heading" title="Something else?">
                    A Hockey Night, a birthday, a conference — start it here and
                    plan it with the people coming.
                  </SectionHeading>
                  <div className="mt-5">
                    <StartAdventure />
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
