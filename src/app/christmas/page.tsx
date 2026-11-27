import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Dices } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { RememberTown } from "@/components/christmas/RememberTown";
import { RememberDistance } from "@/components/christmas/RememberDistance";
import { KeepScroll } from "@/components/christmas/KeepScroll";
import { DontMiss, HappeningToday } from "@/components/christmas/FeaturedToday";
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
import { featuredAt, inNorthOkanagan } from "@/domain/christmas/featured";
import { newYearInView } from "@/domain/christmas/finder";
import {
  daysUntil,
  newYear,
  presetDates,
  season,
  whenLabel,
} from "@/domain/christmas/when";
import { WAYS, wayHref, type Way } from "@/domain/christmas/ways";
import { TOWNS } from "@/domain/christmas/lights/model";
import {
  AlsoToday,
  ChristmasLights,
  ComingUp,
  Explore,
} from "./_parts/discovery";
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

/** A band's heading, said the same way all down the page. */
const H2 =
  "ghad-display text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em] sm:text-4xl";

/**
 * **Go Have a Christmas — one discovery experience** (owner brief M1154,
 * "One unified discovery experience", owner-approved design direction;
 * builds on M1128's one page, ADR 026). The page answers one question at
 * once — _what is happening around me this Christmas?_ — top to bottom:
 *
 * 1. **Christmas around {town}** — a compact festive header with where,
 *    when and how far, said once for the whole page. No full-screen hero.
 * 2. **Happening today** — today's headline event large, with its photo,
 *    what else is on today, then Atlas's own events confirmed for today.
 * 3. **Don't miss this Christmas** — the Bethlehem Star showcase and the
 *    season's other big local dates (`featured.ts`, clock-decided).
 * 4. **Coming up** — tomorrow, this weekend, the next fortnight.
 * 5. **What are you in the mood for?** — the six ways, as photographs,
 *    each one setting Explore's categories (or, for a night in, its page).
 * 6. **Explore Christmas** — every listing, categories several at once,
 *    show more on demand; nothing Coming up already said.
 * 7. **Christmas lights** — the map, ready-made drives, local displays.
 * 8. **Make Christmas your own** — Surprise me, and a plan from a sentence.
 *
 * `/christmas/discover` still redirects here with its query, and every
 * older link (`?theme=`, `?when=`, `#discover`) opens on what it showed.
 * Only the Atlas parts wait, each behind its own boundary; changing the
 * place, the days or the distance keeps the old answer, dimmed, until the
 * new one replaces it (`PendingContent`).
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
  const now = new Date();
  const northOkanagan = inNorthOkanagan(ask.at);
  const featuredToday = northOkanagan && featuredAt(now).tonight.length > 0;
  const newYearNear = newYearInView({ themes: [] }, today);
  const dated = Boolean(ask.from || ask.to);
  // A mood sets Explore's categories — the same filter as its chips — and
  // keeps the place, the days and the distance. A night in has no listings
  // to filter, so it opens its own page of ideas.
  const moodHref = (way: Way) =>
    way.themes.length === 0
      ? wayHref(way.id, ask.at, lightsTown, ask.km)
      : `${discoverHref({ ...ask, themes: [...way.themes] }).replace(/#.*$/, "")}#explore`;
  const streamed = (label: string) => <RowSkeleton label={label} />;

  return (
    <>
      {where.chosen && <RememberTown town={ask.at!} />}
      {typeof params.km === "string" && <RememberDistance km={ask.km} />}
      <KeepScroll />
      <ThemeProvider className="block">
        <PicksProvider
          planHref={`/christmas/plan${q}`}
          signedIn={Boolean(session)}
        >
          <main className={`${styles.page} min-h-screen pb-28`}>
            <PendingProvider>
              {/* 1. Christmas around {town} — compact, the controls said once. */}
              <header
                id="discover"
                className={`${styles.night} relative z-30 scroll-mt-12 px-4 pt-5 pb-5 text-white sm:px-6 sm:pt-7 sm:pb-6`}
                style={{ overflow: "visible" }}
                data-testid="discover"
              >
                <div className="mx-auto max-w-7xl">
                  <p
                    className="text-sm font-bold tracking-[0.14em] text-[#ffd98a] uppercase"
                    data-testid="countdown"
                  >
                    ✦ {seasonLine({ ...stage, today })}
                  </p>
                  <h1
                    id="discover-title"
                    className="ghad-display mt-1 text-[2rem] leading-[1] font-extrabold tracking-[-0.03em] sm:text-5xl"
                  >
                    Christmas around {townName}
                  </h1>
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
                  {newYearNear && (
                    <p className="mt-2 text-sm text-white/85">
                      New Year&apos;s Eve is nearly here —{" "}
                      <Link
                        href={discoverHref({
                          at: ask.at,
                          km: ask.km,
                          ...presetDates("nye", today),
                        })}
                        className="font-semibold text-[#ffd98a] underline underline-offset-4"
                        data-testid="new-year-link"
                      >
                        see what&apos;s on
                      </Link>
                      .
                    </p>
                  )}
                </div>
              </header>

              <PendingContent className="mx-auto max-w-7xl space-y-10 px-4 pt-6 sm:space-y-14 sm:px-6 sm:pt-8">
                {/* 2. Happening today — the featured events (M1152) by the
                    clock, then Atlas's own events confirmed for today. */}
                <HappeningToday
                  now={now}
                  townName={townName}
                  local={northOkanagan}
                  also={
                    <Suspense fallback={null}>
                      <AlsoToday
                        ask={ask}
                        today={today}
                        featured={featuredToday}
                      />
                    </Suspense>
                  }
                />

                {/* 3. Don't miss this Christmas — the Bethlehem Star first. */}
                {northOkanagan && <DontMiss now={now} />}

                {/* 4. Coming up — an undated look around only. */}
                {!dated && (
                  <Suspense
                    fallback={streamed(
                      `Finding what's coming up around ${townName}…`,
                    )}
                  >
                    <ComingUp ask={ask} today={today} />
                  </Suspense>
                )}

                {/* 5. What are you in the mood for? */}
                <section aria-labelledby="ways-title" data-testid="ways">
                  <h2 id="ways-title" className={H2}>
                    What are you in the mood for?
                  </h2>
                  <div className="mt-4">
                    <WayStories
                      ways={WAYS}
                      hrefFor={moodHref}
                      compact
                      cta="Show me"
                    />
                  </div>
                  <p
                    className="mt-3 text-sm text-[var(--gh-ink-soft)]"
                    data-testid="way-pages"
                  >
                    Ideas and plans for each:{" "}
                    {WAYS.map((way, i) => (
                      <span key={way.id}>
                        {i > 0 && " · "}
                        <Link
                          href={wayHref(way.id, ask.at, lightsTown, ask.km)}
                          className="inline-block py-1 font-semibold underline underline-offset-4"
                          data-testid={`way-page-${way.id}`}
                        >
                          {way.label.replace(/^Christmas /, "")}
                        </Link>
                      </span>
                    ))}
                  </p>
                </section>

                {/* 6. Explore Christmas — the listings, filtered in the hand. */}
                <section
                  id="explore"
                  aria-labelledby="explore-title"
                  className="scroll-mt-16"
                  data-testid="explore"
                >
                  <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 id="explore-title" className={H2}>
                      Explore Christmas
                    </h2>
                    <a
                      href="#discover"
                      className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
                      data-testid="explore-change"
                    >
                      {whenLabel(ask, today)} · {ask.km} km of {townName} ·
                      Change
                    </a>
                  </div>
                  <Suspense
                    fallback={streamed(`Finding what's on around ${townName}…`)}
                  >
                    <Explore ask={ask} today={today} />
                  </Suspense>
                </section>

                {/* 7. Christmas lights — map, drives, community displays. */}
                <Suspense fallback={null}>
                  <ChristmasLights
                    ask={ask}
                    today={today}
                    mapHref={wayHref("lights", ask.at, lightsTown, ask.km)}
                  />
                </Suspense>

                {/* 8. Make Christmas your own. */}
                <section
                  id="plan"
                  className="scroll-mt-20"
                  aria-labelledby="own-title"
                >
                  <h2 id="own-title" className={H2}>
                    Make Christmas your own
                  </h2>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
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
                          One thing to do — something real near {townName}, or
                          one of our ideas.
                        </span>
                      </span>
                    </Link>
                    <div
                      className={`${styles.night} rounded-[26px] p-3 sm:p-4`}
                    >
                      <PlanHero at={ask.at} km={ask.km} compact />
                    </div>
                  </div>
                </section>

                <div className="space-y-2">
                  <PhotoCredits />
                  <p className="max-w-3xl text-sm text-[var(--gh-ink-soft)]">
                    Every event, market and place here comes from local listings
                    or the organiser&apos;s own page, with its own dates. Lights
                    pinned by locals are checked by a person. Ideas say
                    they&apos;re ideas. We never invent a time, a price or that
                    something is open.
                  </p>
                </div>
              </PendingContent>
            </PendingProvider>
          </main>
        </PicksProvider>
      </ThemeProvider>
    </>
  );
}
