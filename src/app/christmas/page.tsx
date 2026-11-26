import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Dices } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { Hearth } from "@/components/christmas/hearth/Hearth";
import { RememberTown } from "@/components/christmas/RememberTown";
import { RememberDistance } from "@/components/christmas/RememberDistance";
import { PlanHero } from "@/components/christmas/PlanHero";
import { DiscoverControls } from "@/components/christmas/DiscoverControls";
import { adventureSession } from "@/lib/adventures/server";
import { PicksProvider } from "@/components/christmas/Picks";
import { RowSkeleton } from "@/components/christmas/ways";
import { PhotoCredits, WayStories } from "@/components/christmas/WayStories";
import { PendingContent, PendingProvider } from "@/components/loading/Pending";
import styles from "@/components/christmas/christmas.module.css";
import { todayIn } from "@/lib/adventures/overview";
import { townById } from "@/domain/discovery/towns";
import {
  discoverHref,
  readAsk,
  writeAsk,
  type Ask,
} from "@/domain/christmas/discover";
import { newYearInView } from "@/domain/christmas/finder";
import {
  daysUntil,
  newYear,
  presetDates,
  season,
  whenLabel,
} from "@/domain/christmas/when";
import { WAYS, wayHref } from "@/domain/christmas/ways";
import { TOWNS } from "@/domain/christmas/lights/model";
import { Discovery } from "./_parts/discovery";
import { rememberedKm, whereAreWe } from "./_server/where";

export const metadata: Metadata = {
  title: "Go Have a Christmas — Passport",
  description:
    "Your Christmas starts here: the lights, a Christmas date, family fun, friends, a cozy night in, and the real events and markets near you.",
};

/** The countdown, by where we are in the season. */
function seasonLine(
  stage: ReturnType<typeof season> & { readonly today: string },
): string {
  switch (stage.stage) {
    case "coming":
      return `${stage.daysToGo} sleeps till Christmas`;
    case "advent":
      return `${stage.daysToGo} sleeps — it's properly the season`;
    case "christmas-week":
      return stage.daysToGo === 0
        ? "It's Christmas Day"
        : `${stage.daysToGo} sleep${stage.daysToGo === 1 ? "" : "s"}. This is the week.`;
    case "after": {
      const toEve = daysUntil(stage.today, newYear(stage.today).eve);
      return toEve > 0
        ? `Christmas has been — ${toEve} sleep${toEve === 1 ? "" : "s"} to New Year's Eve`
        : toEve === 0
          ? "It's New Year's Eve"
          : "Happy New Year — the lights are still up";
    }
  }
}

/**
 * **Go Have a Christmas — one page** (owner brief M1128, "One Beautiful
 * Experience": _Christmas Home and Discover are the same experience_).
 *
 * The visitor's day reads top to bottom, with nothing to navigate away to:
 *
 * 1. **Welcome.** The room by the fire (`Hearth`, M1127 "Stay Awhile"),
 *    unchanged: it asks nothing.
 * 2. **Inspiration.** Six ways to have a Christmas, as photographs of the
 *    feeling (`WayStories`); each opens its own short page.
 * 3. **Discovery.** Where, when and how far — one shared control, said once —
 *    then what is on, in a host's order, filtered by as many categories as
 *    the visitor likes without a trip to the server (`Discovery`, `Finder`).
 * 4. **Optional planning.** Surprise me, or say it and get a plan.
 *
 * The old `/christmas/discover` address redirects here, query and all, so
 * every shared link still opens on what it showed. New Year's Eve is said
 * when it is near (`newYearInView`), not on every screen.
 *
 * Only discovery waits on Atlas, so it streams in behind the welcome and the
 * ways. Changing the place, the days or the distance keeps the old answer,
 * dimmed and said to be loading, until the new one replaces it
 * (`PendingContent`).
 */
export default async function ChristmasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const today = todayIn();
  const remembered = await rememberedKm();
  const asked = readAsk(params, {
    today,
    ...(remembered ? { km: remembered } : {}),
  });
  // Christmas opens somewhere: the town just chosen, the one remembered, or
  // Vernon — never an unplaced list.
  const [where, session] = await Promise.all([
    whereAreWe(asked.at),
    adventureSession().catch(() => null),
  ]);
  const ask: Ask = { ...asked, at: where.at };
  const town = townById(ask.at);
  const townName = town?.name.replace(/,\s*BC$/, "") ?? "you";
  const stage = season(today);
  const lightsTown = (TOWNS as readonly string[]).includes(ask.at!);
  // The plan carries where and how far — never the browsing date, which is
  // a preference, not the date of somebody's plan.
  const place = writeAsk({ at: ask.at, km: ask.km });
  const q = place ? `?${place}` : "";
  const newYearNear = newYearInView({ themes: [] }, today);

  return (
    <>
      {where.chosen && <RememberTown town={ask.at!} />}
      {typeof params.km === "string" && <RememberDistance km={ask.km} />}
      <ThemeProvider className="block">
        <PicksProvider
          planHref={`/christmas/plan${q}`}
          signedIn={Boolean(session)}
        >
          <main className={`${styles.page} min-h-screen pb-28`}>
            <PendingProvider>
              {/* 1. Welcome — the hero asks nothing (M1127, "Stay Awhile"). */}
              <Hearth countdown={seasonLine({ ...stage, today })} />

              <div className="mx-auto max-w-7xl space-y-12 px-4 pt-8 sm:space-y-16 sm:px-6 sm:pt-12">
                {/* 2. Inspiration. */}
                <section aria-labelledby="ways-title" data-testid="ways">
                  <h2
                    id="ways-title"
                    className="ghad-display text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em] sm:text-4xl"
                  >
                    What kind of Christmas?
                  </h2>
                  {newYearNear && (
                    <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
                      And New Year&apos;s Eve is nearly here —{" "}
                      <Link
                        href={discoverHref({
                          at: ask.at,
                          km: ask.km,
                          ...presetDates("nye", today),
                        })}
                        className="font-semibold underline underline-offset-4"
                        data-testid="new-year-link"
                      >
                        see what&apos;s on
                      </Link>
                      .
                    </p>
                  )}
                  <div className="mt-4">
                    <WayStories
                      ways={WAYS}
                      hrefFor={(way) =>
                        wayHref(way.id, ask.at, lightsTown, ask.km)
                      }
                    />
                  </div>
                </section>

                {/* 3. Discovery — where, when and how far, said once. */}
                <section
                  id="discover"
                  aria-labelledby="discover-title"
                  className="scroll-mt-4"
                  data-testid="discover"
                >
                  <div
                    className={`${styles.night} relative z-30 rounded-[28px] px-4 pt-5 pb-4 sm:px-7 sm:pt-7 sm:pb-6`}
                    style={{ overflow: "visible" }}
                  >
                    <p className="text-sm font-bold tracking-[0.14em] text-[#ffd98a] uppercase">
                      Happening near you
                    </p>
                    <h2
                      id="discover-title"
                      className="ghad-display mt-1 text-[1.75rem] leading-[1] font-extrabold tracking-[-0.03em] sm:text-4xl"
                    >
                      Christmas around {townName}
                    </h2>
                    <Suspense fallback={null}>
                      <DiscoverControls
                        {...(ask.when ? { when: ask.when } : {})}
                        {...(ask.from ? { from: ask.from } : {})}
                        {...(ask.to ? { to: ask.to } : {})}
                        km={ask.km}
                        today={today}
                        label={whenLabel(ask, today)}
                        {...(ask.at ? { at: ask.at } : {})}
                      />
                    </Suspense>
                  </div>
                  <PendingContent className="mt-5">
                    <Suspense
                      fallback={
                        <RowSkeleton
                          label={`Finding what's on around ${townName}…`}
                        />
                      }
                    >
                      <Discovery ask={ask} today={today} />
                    </Suspense>
                  </PendingContent>
                </section>

                {/* 4. Optional planning. */}
                <section
                  id="plan"
                  className="grid scroll-mt-20 gap-4 lg:grid-cols-[1fr_1.4fr]"
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
                        One thing to do — something real near {townName}, or one
                        of our ideas.
                      </span>
                    </span>
                  </Link>
                  <div className={`${styles.night} rounded-[26px] p-3 sm:p-4`}>
                    <PlanHero at={ask.at} km={ask.km} compact />
                  </div>
                </section>

                <div className="space-y-2">
                  <PhotoCredits />
                  <p className="max-w-3xl text-sm text-[var(--gh-ink-soft)]">
                    Every event, market and place here comes from local
                    listings, with its own dates. Lights pinned by locals are
                    checked by a person. Ideas say they&apos;re ideas. We never
                    invent a time, a price or that something is open.
                  </p>
                </div>
              </div>
            </PendingProvider>
          </main>
        </PicksProvider>
      </ThemeProvider>
    </>
  );
}
