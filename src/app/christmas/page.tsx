import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Gift,
  CalendarRange,
  Compass,
  Dices,
  MapPin,
  Moon,
  Sparkles,
} from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { Hearth } from "@/components/christmas/hearth/Hearth";
import { RememberTown } from "@/components/christmas/RememberTown";
import { PlanHero } from "@/components/christmas/PlanHero";
import { DistancePicker } from "@/components/christmas/DistancePicker";
import { adventureSession } from "@/lib/adventures/server";
import { PicksProvider } from "@/components/christmas/Picks";
import { RowSkeleton, WayCard } from "@/components/christmas/ways";
import { ExperienceLocation } from "@/components/location/ExperienceLocation";
import { PendingContent, PendingProvider } from "@/components/loading/Pending";
import styles from "@/components/christmas/christmas.module.css";
import { todayIn } from "@/lib/adventures/overview";
import { townById } from "@/domain/discovery/towns";
import { readAsk, writeAsk } from "@/domain/christmas/discover";
import {
  daysUntil,
  newYear,
  newYearGone,
  season,
} from "@/domain/christmas/when";
import { dayOf, daysBetween, stageOf } from "@/domain/christmas/advent/model";
import { WAYS, wayHref } from "@/domain/christmas/ways";
import { TOWNS } from "@/domain/christmas/lights/model";
import { NearYou } from "./_parts/near";
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

/** Where the Advent calendar is, in a few words for its pill. */
function adventLine(today: string): string {
  const stage = stageOf(today);
  if (stage === "before") {
    const n = daysBetween(today, dayOf(1).date);
    return `door 1 in ${n} sleep${n === 1 ? "" : "s"}`;
  }
  if (stage === "doors") return "today's door is ready";
  if (stage === "after") return "a New Year's adventure a day";
  return "back next December";
}

/**
 * **Go Have a Christmas** — "Your Christmas Starts Here" (owner brief "P0 —
 * the experience-first rebuild", 2026-11-17).
 *
 * It opens on a hero that asks nothing — a fire, a tree, the Star of
 * Bethlehem, a verse at a time (`Hearth`, owner brief M1127 "Stay Awhile").
 * Advent, New Year's Eve, the three ways in, the place and the distance wait
 * in the band just below it, unchanged, for when the visitor is ready.
 *
 * Then the page asks one thing: what kind of Christmas? Six ways answer it, each
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
  const remembered = await rememberedKm();
  const asked = readAsk(params, remembered ? { km: remembered } : {});
  // Christmas opens somewhere: the town just chosen, the one remembered, or
  // Vernon — never an unplaced list.
  const [where, session] = await Promise.all([
    whereAreWe(asked.at),
    adventureSession().catch(() => null),
  ]);
  const ask = { ...asked, at: where.at };
  const today = todayIn();
  const town = townById(ask.at);
  const townName = town?.name.replace(/,\s*BC$/, "");
  const stage = season(today);
  const lightsTown = (TOWNS as readonly string[]).includes(ask.at);
  const lightsHref = `/christmas/lights${lightsTown ? `?at=${ask.at}` : ""}`;
  // The place and the distance ride along every link, so the next page is
  // about the same town and radius.
  const here = writeAsk({ at: ask.at, km: ask.km });
  const q = here ? `?${here}` : "";
  // A word, not today's date: the page says "Tonight", and a saved link
  // still means tonight on another night.
  const tonight = `/christmas/discover?${writeAsk({ at: ask.at, km: ask.km, when: "tonight" })}`;
  const discoverHref = `/christmas/discover${q}`;
  const newYearHref = `/christmas/discover?${writeAsk({
    at: ask.at,
    km: ask.km,
    themes: ["newyear"],
    ...(newYearGone(today) ? {} : { when: "nye" as const }),
  })}`;

  return (
    <>
      {where.chosen && <RememberTown town={ask.at} />}
      <ThemeProvider className="block">
        <PicksProvider
          planHref={`/christmas/plan${q}`}
          signedIn={Boolean(session)}
        >
          <main className={`${styles.page} min-h-screen pb-28`}>
            <PendingProvider>
              {/* The hero asks nothing (M1127, "Stay Awhile"). */}
              <Hearth countdown={seasonLine({ ...stage, today })} />

              {/* Everything the hero used to ask, kept, for when the visitor
                  is ready. Above the page below it: the place picker opens
                  out of this band. */}
              <section
                aria-label="When you're ready"
                className={`${styles.night} z-30`}
                style={{ overflow: "visible" }}
                data-testid="ready"
              >
                <div className={styles.lights} aria-hidden />
                <div className="mx-auto max-w-6xl px-4 pt-5 pb-6 sm:px-6 sm:pt-8 sm:pb-8">
                  <div
                    className="flex flex-wrap gap-2"
                    data-testid="season-pills"
                  >
                    <Link
                      href={`/christmas/advent${q}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#b3242f] px-4 text-sm font-extrabold text-white shadow-md hover:brightness-110"
                      data-testid="pill-advent"
                    >
                      <span aria-hidden>🎁</span> Advent Adventure
                      <span className="font-semibold text-white/85">
                        · {adventLine(today)}
                      </span>
                    </Link>
                    <Link
                      href={newYearHref}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ffd98a] px-4 text-sm font-extrabold text-[#082319] shadow-md hover:brightness-105"
                      data-testid="pill-new-year"
                    >
                      <span aria-hidden>🎆</span> New Year&apos;s Eve
                    </Link>
                  </div>
                  <nav
                    aria-label="Start here"
                    className="mt-5 grid max-w-3xl gap-2 sm:grid-cols-3"
                    data-testid="entry-points"
                  >
                    {[
                      {
                        id: "lights",
                        href: lightsHref,
                        icon: MapPin,
                        title: "Explore Christmas lights",
                        line: "The map, and drives to see them",
                      },
                      {
                        id: "tonight",
                        href: tonight,
                        icon: Moon,
                        title: "What's happening tonight?",
                        line: "Only what's confirmed for tonight",
                      },
                      {
                        id: "plan",
                        href: "#plan",
                        icon: Sparkles,
                        title: "Plan a Christmas adventure",
                        line: "Say it; get a plan",
                      },
                    ].map(({ id, href, icon: Icon, title, line }) => (
                      <Link
                        key={id}
                        href={href}
                        data-testid={`entry-${id}`}
                        className="flex min-h-16 items-center gap-3 rounded-[20px] bg-white/95 p-3 text-[#082319] shadow-lg ring-1 ring-white/40 transition hover:bg-white motion-reduce:transition-none"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#b3242f] text-white">
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-base leading-tight font-extrabold">
                            {title}
                          </span>
                          <span className="block text-sm text-[#082319]/70">
                            {line}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </nav>
                  <Suspense fallback={null}>
                    <ExperienceLocation
                      scope="christmas"
                      experience="Christmas"
                      at={ask.at}
                      className="mt-2 text-white"
                    />
                  </Suspense>
                  <DistancePicker
                    ask={ask}
                    path="/christmas"
                    className="mt-2"
                  />
                </div>
              </section>

              <div className="mx-auto max-w-6xl space-y-10 px-4 pt-6 sm:space-y-14 sm:px-6 sm:pt-10">
                <nav aria-labelledby="ways-title" data-testid="ways">
                  <h2
                    id="ways-title"
                    className="ghad-display text-2xl leading-tight font-extrabold tracking-[-0.02em] sm:text-3xl"
                  >
                    What are you in the mood for?
                  </h2>
                  <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                    {WAYS.map((way) => (
                      <li key={way.id}>
                        <WayCard
                          way={way}
                          href={wayHref(way.id, ask.at, lightsTown, ask.km)}
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
                        One thing to do — something real near{" "}
                        {townName ?? "you"}, or one of our ideas.
                      </span>
                    </span>
                  </Link>
                  <div className={`${styles.night} rounded-[26px] p-3 sm:p-4`}>
                    <PlanHero at={ask.at} km={ask.km} compact />
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
                    Every Christmas thing we know of, with filters, for anybody
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
                        href: "/christmas/list",
                        icon: Gift,
                        title: "My Christmas List",
                        line: "What you've added, saved and planned — only you can see it.",
                        testId: "my-list-link",
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

                <p className="max-w-3xl text-sm text-[var(--gh-ink-soft)]">
                  Every event, market and place here comes from the event
                  listings, with its dates and how sure they are on its card.
                  Lights pinned by locals are checked by a person. Ideas say
                  they&apos;re ideas. Passport never invents a time, a price or
                  that something is open.
                </p>
              </div>
            </PendingProvider>
          </main>
        </PicksProvider>
      </ThemeProvider>
    </>
  );
}
