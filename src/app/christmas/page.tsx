import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Bookmark,
  CalendarHeart,
  CalendarRange,
  Compass,
  Dices,
  MapPin,
} from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { Festive } from "@/components/christmas/Festive";
import { RememberTown } from "@/components/christmas/RememberTown";
import { PlanHero } from "@/components/christmas/PlanHero";
import { PicksProvider } from "@/components/christmas/Picks";
import { RowSkeleton, WayCard } from "@/components/christmas/ways";
import { ExperienceLocation } from "@/components/location/ExperienceLocation";
import { PendingContent, PendingProvider } from "@/components/loading/Pending";
import styles from "@/components/christmas/christmas.module.css";
import { todayIn } from "@/lib/adventures/overview";
import { townById } from "@/domain/discovery/towns";
import { readAsk, writeAsk } from "@/domain/christmas/discover";
import { season } from "@/domain/christmas/when";
import { WAYS, wayHref } from "@/domain/christmas/ways";
import { TOWNS } from "@/domain/christmas/lights/model";
import { NearYou, YourAdventures } from "./_parts/near";
import { whereAreWe } from "./_server/where";

export const metadata: Metadata = {
  title: "Go Have a Christmas — Passport",
  description:
    "Your Christmas starts here: the lights, a Christmas date, family fun, friends, a cozy night in, and the real events and markets near you.",
};

/** The countdown, by where we are in the season. */
function seasonLine(stage: ReturnType<typeof season>): string {
  switch (stage.stage) {
    case "coming":
      return `${stage.daysToGo} sleeps till Christmas`;
    case "advent":
      return `${stage.daysToGo} sleeps — it's properly the season`;
    case "christmas-week":
      return stage.daysToGo === 0
        ? "It's Christmas Day"
        : `${stage.daysToGo} sleep${stage.daysToGo === 1 ? "" : "s"}. This is the week.`;
    case "after":
      return "Christmas has been — the lights are still up";
  }
}

/**
 * **Go Have a Christmas** — "Your Christmas Starts Here" (owner brief "P0 —
 * the experience-first rebuild", 2026-11-17).
 *
 * The page asks one thing: what kind of Christmas? Six ways answer it, each
 * opening a short page with a question or two and a handful of things to do
 * (`ways.ts`). Below them, the four strongest things happening near here,
 * a Surprise me, the planner's sentence box, and the way into everything.
 * The long rows of event cards are gone from here; every one of them is
 * still on Find Christmas (`/christmas/discover`) and the lights map.
 *
 * Only _Happening near you_ waits on Atlas, so on a first visit it streams in
 * behind the rest: the six ways are on screen while a cold Atlas is still
 * answering. Changing the place keeps the old answer, dimmed and said to be
 * loading (`PendingContent`), until the new one replaces it — a keyed
 * boundary showed a skeleton instead, which React holds for a minimum time,
 * and made a warm switch six times slower (M865 timings).
 */
export default async function ChristmasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const asked = readAsk(params);
  // Christmas opens somewhere: the town just chosen, the one remembered, or
  // Vernon — never an unplaced list.
  const where = await whereAreWe(asked.at);
  const ask = { ...asked, at: where.at };
  const today = todayIn();
  const town = townById(ask.at);
  const townName = town?.name.replace(/,\s*BC$/, "");
  const stage = season(today);
  const lightsTown = (TOWNS as readonly string[]).includes(ask.at);
  const lightsHref = `/christmas/lights${lightsTown ? `?at=${ask.at}` : ""}`;
  const here = writeAsk({ at: ask.at });
  const q = here ? `?${here}` : "";
  const discoverHref = `/christmas/discover${q}`;

  return (
    <>
      {where.chosen && <RememberTown town={ask.at} />}
      <ThemeProvider className="block">
        <PicksProvider planHref={`/christmas/plan${q}`}>
          <main className={`${styles.page} min-h-screen pb-28`}>
            <PendingProvider>
              {/* Above the page below it: the place picker opens out of the header. */}
              <header
                className={`${styles.night} z-30`}
                style={{ overflow: "visible" }}
              >
                <div className="mx-auto max-w-6xl px-4 pt-7 pb-6 sm:px-6 sm:pt-12 sm:pb-10">
                  <p className="text-xs font-bold tracking-[0.18em] text-[#ffd98a] uppercase sm:text-sm">
                    Go Have a Christmas
                  </p>
                  <h1 className="ghad-display mt-2 max-w-3xl text-[2.6rem] leading-[0.92] font-extrabold tracking-[-0.045em] text-balance sm:text-7xl">
                    Your Christmas Starts Here
                  </h1>
                  <p className="mt-3 max-w-xl text-lg font-semibold text-white/90 sm:text-xl">
                    Find something wonderful to do together.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p
                      className="inline-flex w-fit items-center gap-2 rounded-full bg-black/30 px-3.5 py-1.5 text-sm font-bold backdrop-blur"
                      data-testid="countdown"
                    >
                      <CalendarHeart
                        className="h-4 w-4 text-[#ffd98a]"
                        aria-hidden
                      />
                      {seasonLine(stage)}
                    </p>
                    <Festive />
                  </div>
                  <Suspense fallback={null}>
                    <ExperienceLocation
                      scope="christmas"
                      experience="Christmas"
                      at={ask.at}
                      className="mt-2 text-white"
                    />
                  </Suspense>
                </div>
                <div className={styles.lights} aria-hidden />
              </header>

              <div className="mx-auto max-w-6xl space-y-10 px-4 pt-6 sm:space-y-14 sm:px-6 sm:pt-10">
                <nav aria-labelledby="ways-title" data-testid="ways">
                  <h2
                    id="ways-title"
                    className="ghad-display text-2xl leading-tight font-extrabold tracking-[-0.02em] sm:text-3xl"
                  >
                    What kind of Christmas?
                  </h2>
                  <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                    {WAYS.map((way) => (
                      <li key={way.id}>
                        <WayCard
                          way={way}
                          href={wayHref(way.id, ask.at, lightsTown)}
                          {...(way.id === "lights"
                            ? { testId: "cta-lights" }
                            : {})}
                        />
                      </li>
                    ))}
                  </ul>
                </nav>

                <PendingContent>
                  <Suspense
                    fallback={
                      <RowSkeleton
                        label={`Finding what's on around ${townName ?? "you"}…`}
                      />
                    }
                  >
                    <NearYou
                      ask={ask}
                      today={today}
                      discoverHref={discoverHref}
                      lightsHref={lightsHref}
                    />
                  </Suspense>
                </PendingContent>

                <section
                  className="grid gap-4 lg:grid-cols-[1fr_1.4fr]"
                  aria-label="Surprise me, or say it"
                >
                  <Link
                    href={`/christmas/surprise${q}`}
                    className="group flex items-center gap-4 rounded-[26px] bg-[#b3242f] p-5 text-white shadow-[0_10px_30px_rgba(179,36,47,0.25)] transition hover:brightness-110 motion-reduce:transition-none sm:p-6"
                    data-testid="surprise-me"
                  >
                    <Dices
                      className="h-10 w-10 shrink-0 text-[#ffd98a] transition-transform group-hover:rotate-12 motion-reduce:transition-none"
                      aria-hidden
                    />
                    <span>
                      <span className="ghad-display block text-2xl leading-tight font-extrabold">
                        Surprise me
                      </span>
                      <span className="text-sm text-white/85">
                        One thing to do — something real near{" "}
                        {townName ?? "you"}, or one of our ideas.
                      </span>
                    </span>
                  </Link>
                  <div className={`${styles.night} rounded-[26px] p-3 sm:p-4`}>
                    <PlanHero at={ask.at} compact />
                  </div>
                </section>

                <section aria-labelledby="browse-title" data-testid="browse">
                  <h2
                    id="browse-title"
                    className="ghad-display text-2xl leading-tight font-extrabold sm:text-3xl"
                  >
                    Browse everything
                  </h2>
                  <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
                    Every Christmas thing Atlas knows, with filters, for anybody
                    who&apos;d rather look through the lot.
                  </p>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      {
                        href: discoverHref,
                        icon: Compass,
                        title: `Find Christmas near ${townName ?? "me"}`,
                        line: "Markets, Santa, shows, festivals — the full directory.",
                        testId: "cta-discover",
                      },
                      {
                        href: lightsHref,
                        icon: MapPin,
                        title: "The Christmas lights map",
                        line: "Every pinned display, and a tour built for you.",
                        testId: "browse-lights",
                      },
                      {
                        href: `/christmas/plan${q}`,
                        icon: CalendarRange,
                        title: "A weekend, or a few days",
                        line: "An adventure for one day or several, sketched from real places.",
                        testId: "browse-plan",
                      },
                      {
                        href: "/saved",
                        icon: Bookmark,
                        title: "Saved",
                        line: "Everything you've kept — Christmas included.",
                        testId: "browse-saved",
                      },
                    ].map(({ href, icon: Icon, title, line, testId }) => (
                      <li key={testId}>
                        <Link
                          href={href}
                          className="flex h-full items-start gap-3 rounded-[22px] bg-white p-4 ring-1 ring-black/5 hover:ring-black/20"
                          data-testid={testId}
                        >
                          <Icon
                            className="mt-0.5 h-5 w-5 shrink-0 text-[#b3242f]"
                            aria-hidden
                          />
                          <span>
                            <span className="block font-bold">{title}</span>
                            <span className="text-sm text-[var(--gh-ink-soft)]">
                              {line}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>

                <Suspense fallback={null}>
                  <YourAdventures today={today} />
                </Suspense>

                <p className="max-w-3xl text-sm text-[var(--gh-ink-soft)]">
                  Every event, market and place here is one Atlas holds, with
                  its dates and how sure they are on its card. Lights pinned by
                  locals are checked by a person. Ideas say they&apos;re ideas.
                  Passport never invents a time, a price or that something is
                  open.
                </p>
              </div>
            </PendingProvider>
          </main>
        </PicksProvider>
      </ThemeProvider>
    </>
  );
}
