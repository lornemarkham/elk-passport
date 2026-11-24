import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { ExperienceLocation } from "@/components/location/ExperienceLocation";
import { RememberTown } from "@/components/christmas/RememberTown";
import { AdventCalendar } from "@/components/christmas/advent/AdventCalendar";
import styles from "@/components/christmas/christmas.module.css";
import advent from "@/components/christmas/advent/advent.module.css";
import { todayIn } from "@/lib/adventures/overview";
import { townById } from "@/domain/discovery/towns";
import { readAsk } from "@/domain/christmas/discover";
import { TOWNS } from "@/domain/christmas/lights/model";
import {
  ADVENT_COOKIE,
  dayOf,
  daysBetween,
  hasSaid,
  openDays,
  previewActive,
  previewDays,
  readPrefs,
  stageOf,
  type AdventDay,
} from "@/domain/christmas/advent/model";
import { planDays } from "@/domain/christmas/advent/pick";
import { christmasFinds } from "../_server/corpus";
import { whereAreWe } from "../_server/where";

export const metadata: Metadata = {
  title: "Advent Adventure — Go Have a Christmas",
  description:
    "25 days, 25 surprises: a holiday adventure behind every door from December 1 to Christmas Day — real events near you and ideas for home — then New Year's adventures to January 3.",
};

/**
 * **Advent Adventure** (owner brief M1053). The doors that have come are
 * planned here, from the family's choices (a cookie) and the Christmas
 * finds Atlas holds near their place — the same read and the same rules as
 * Christmas Discovery — and handed to the calendar. A door still to come
 * is sent as nothing at all.
 */
export default async function AdventPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const [where, jar] = await Promise.all([
    whereAreWe(readAsk(params).at),
    cookies(),
  ]);
  const prefs = readPrefs(jar.get(ADVENT_COOKIE)?.value);
  const at = where.at;
  const town = townById(at);
  const townName = town?.name.replace(/,\s*BC$/, "") ?? "you";
  // A test server may start the season on any day (`ADVENT_TODAY`, set only
  // in the server's own environment, never by a visitor) — the e2e opens
  // December's doors in November.
  const pinned = process.env.ADVENT_TODAY;
  const today =
    pinned && /^\d{4}-\d{2}-\d{2}$/.test(pinned) ? pinned : todayIn();
  // Advent Preview Mode (M1074): every door is open until midnight Pacific on
  // December 1. `today` stays the real day — each door is still planned for
  // its own date, so a real event is behind it only on a day it is on.
  const preview = previewActive();
  const stage = preview ? "doors" : stageOf(today);
  // Before December: a warm-up adventure for today behind Surprise me.
  const days: AdventDay[] = preview
    ? previewDays()
    : stage === "before"
      ? [{ n: 0, date: today, door: false }]
      : openDays(today);
  const corpus = days.length
    ? await christmasFinds({ at, km: prefs.km, ages: prefs.ages }, today)
    : { finds: [], experiences: [] };
  const plans = planDays(days, corpus.finds, prefs, {
    at,
    townName,
    today,
    now: new Date(),
  });
  const lightsTown = (TOWNS as readonly string[]).includes(at);
  const toGo = daysBetween(today, dayOf(1).date);

  return (
    <>
      {where.chosen && <RememberTown town={at} />}
      <ThemeProvider className="block">
        <main className={`${styles.page} min-h-screen pb-28`}>
          <header
            className={`${advent.sky} z-30`}
            style={{ overflow: "visible" }}
          >
            <div className="mx-auto max-w-3xl px-4 pt-2 pb-4 sm:px-6 sm:pt-8 sm:pb-6">
              <Link
                href={`/christmas?at=${at}`}
                className="-ml-1 hidden min-h-11 items-center gap-1.5 px-1 text-sm font-bold text-white/90 hover:text-white sm:inline-flex"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                All of Christmas
              </Link>
              <p className="mt-1 text-xs font-bold tracking-[0.18em] text-[#ffd98a] uppercase">
                Advent Adventure 2026
              </p>
              <h1 className="ghad-display mt-1 text-[2rem] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance sm:text-6xl">
                25 days. 25 surprises.
              </h1>
              <p
                className="mt-1.5 max-w-xl text-sm font-semibold text-white/90 sm:mt-2 sm:text-lg"
                data-testid="advent-stage"
              >
                {preview
                  ? `All 25 doors are open to try, around ${townName}. One holiday adventure behind each.`
                  : stage === "before"
                    ? `One holiday adventure behind each door. The first opens in ${toGo} sleep${toGo === 1 ? "" : "s"} — on December 1.`
                    : stage === "doors"
                      ? `Door ${days.length} is open. One holiday adventure a day, around ${townName}.`
                      : stage === "after"
                        ? "Christmas has been — now a New Year's adventure every day until January 3."
                        : "That was the season. See you next December!"}
              </p>
              {preview && (
                <p
                  className="mt-2 inline-block rounded-full bg-[#ffd98a] px-3 py-1 text-xs font-extrabold text-[#082319]"
                  data-testid="advent-preview"
                >
                  Advent Preview Mode · every door is open until midnight on
                  December 1 (Pacific), then the doors open one a day
                </p>
              )}
              <Suspense fallback={null}>
                <ExperienceLocation
                  scope="christmas"
                  experience="Christmas"
                  at={at}
                  className="mt-1 text-white"
                />
              </Suspense>
            </div>
          </header>
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 sm:pt-5">
            <AdventCalendar
              plans={plans}
              today={today}
              stage={stage}
              preview={preview}
              prefs={prefs}
              said={hasSaid(prefs)}
              townName={townName}
              lightsHref={`/christmas/lights${lightsTown ? `?at=${at}` : ""}`}
              plannerBase={`/christmas/itinerary?at=${encodeURIComponent(at)}`}
              outage={Boolean(corpus.outage)}
            />
            <p className="mt-8 text-sm text-[var(--gh-ink-soft)]">
              A real event is behind a door only on a day its own listing
              confirms, and only when it is placed within your distance. Ideas
              say they&apos;re ideas and name no venue, time or price. Nothing
              needs an account: what you open and complete stays on this
              browser.
            </p>
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
