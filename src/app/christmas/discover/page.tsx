import { Suspense } from "react";
import { ExperienceLocation } from "@/components/location/ExperienceLocation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { FindCard } from "@/components/christmas/FindCard";
import { PicksProvider } from "@/components/christmas/Picks";
import { Refine } from "@/components/christmas/Refine";
import { AtlasDown } from "@/components/christmas/parts";
import styles from "@/components/christmas/christmas.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { todayIn } from "@/lib/adventures/overview";
import {
  answer,
  readAsk,
  writeAsk,
  youngest,
  type Ask,
} from "@/domain/christmas/discover";
import { THEMES, themeById, type ThemeId } from "@/domain/christmas/themes";
import { cn } from "@/lib/utils";
import { christmasFinds } from "../_server/corpus";

export const metadata: Metadata = {
  title: "Find Christmas — Passport",
  description:
    "Christmas markets, lights, Santa and festive food — from Atlas, with the evidence on every card.",
};

/** Cards a shelf shows before "Show all" — a phone is not a database. */
const SHELF = 12;

const REMOVED: Readonly<Record<string, string>> = {
  interests: "aren't what you picked",
  dates: "Atlas dates outside your days",
  budget: "aren't stated as free",
  time: "usually take longer than you have",
};

/**
 * **Christmas Discovery.** Results first, constraints after (doctrine §4);
 * every constraint narrows only where Atlas holds the fact it needs, and the
 * page says what each one set aside.
 */
export default async function ChristmasDiscoverPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const ask = readAsk(params);
  const today = todayIn();
  const [session, corpus] = await Promise.all([
    adventureSession(),
    christmasFinds(ask, today),
  ]);
  const result = answer(corpus.finds, ask);
  const all = typeof params.all === "string" ? params.all : undefined;
  const age = youngest(ask);
  const origin = result.town
    ? { latitude: result.town.latitude, longitude: result.town.longitude }
    : undefined;
  const toggleTheme = (id: ThemeId): Ask => ({
    ...ask,
    themes: ask.themes.includes(id)
      ? ask.themes.filter((t) => t !== id)
      : [...ask.themes, id],
  });
  // The planner carries everything said here except interests, which a
  // plan doesn't need.
  const carry = writeAsk({ ...ask, themes: [] });
  const removed = Object.entries(result.removed).filter(([, n]) => n > 0);
  const heading =
    ask.themes.length === 1
      ? themeById(ask.themes[0]!).label
      : "Christmas, found";

  return (
    <>
      <ThemeProvider className="block">
        <PicksProvider planHref={`/christmas/plan${carry ? `?${carry}` : ""}`}>
          <main className={`${styles.page} min-h-screen pb-28`}>
            <header className={styles.night}>
              <div className="mx-auto max-w-6xl px-4 pt-5 pb-8 sm:px-6">
                <Link
                  href={`/christmas${ask.at ? `?at=${ask.at}` : ""}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Christmas
                </Link>
                <h1 className="ghad-display mt-4 text-[2.4rem] leading-[0.95] font-extrabold tracking-[-0.04em] sm:text-6xl">
                  {heading}
                </h1>
                <p
                  className="mt-2 text-lg text-white/85"
                  data-testid="result-count"
                >
                  {corpus.outage
                    ? "Atlas isn't answering just now."
                    : `${result.total} ${result.total === 1 ? "thing" : "things"} Atlas knows about${result.town ? ` within reach of ${result.town.name.replace(/,\s*BC$/, "")}` : ""}${age !== undefined ? ` · checked for a ${age}-year-old` : ""}.`}
                </p>
                <Suspense fallback={null}>
                  <ExperienceLocation
                    scope="christmas"
                    experience="Christmas"
                    className="mt-2 text-white"
                  />
                </Suspense>
              </div>
              <div className={styles.lights} aria-hidden />
            </header>

            <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6 sm:px-6">
              <nav
                aria-label="What you're into"
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
              >
                {THEMES.map((t) => {
                  const on = ask.themes.includes(t.id);
                  const next = writeAsk(toggleTheme(t.id));
                  return (
                    <Link
                      key={t.id}
                      href={`/christmas/discover${next ? `?${next}` : ""}`}
                      aria-pressed={on}
                      className={cn(
                        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold whitespace-nowrap",
                        on
                          ? "border-[#b3242f] bg-[#b3242f] text-white"
                          : "border-black/10 bg-white hover:border-black/30",
                      )}
                      data-testid={`chip-${t.id}`}
                    >
                      <span aria-hidden>{t.emoji}</span>
                      {t.label}
                    </Link>
                  );
                })}
              </nav>

              <Refine ask={ask} />

              {corpus.outage && <AtlasDown />}

              {removed.length > 0 && (
                <p
                  className="text-base text-[var(--gh-ink-soft)]"
                  data-testid="removed"
                >
                  Set aside:{" "}
                  {removed
                    .map(([why, n]) => `${n} that ${REMOVED[why] ?? why}`)
                    .join(" · ")}
                  .
                </p>
              )}

              {!corpus.outage && result.shelves.length === 0 && (
                <div
                  className="rounded-[28px] bg-white p-8 text-center ring-1 ring-black/5"
                  data-testid="nothing"
                >
                  <p className="text-4xl" aria-hidden>
                    🦌
                  </p>
                  <p className="ghad-display mt-2 text-2xl font-extrabold">
                    Nothing fits all of that
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-base text-[var(--gh-ink-soft)]">
                    Atlas doesn&apos;t hold anything that matches every answer.
                    Try further away, other dates, or fewer interests.
                  </p>
                  <Link
                    href={`/christmas/discover${ask.at ? `?at=${ask.at}` : ""}`}
                    className="mt-5 inline-flex min-h-12 items-center rounded-full bg-[#0f3b2b] px-6 font-bold text-white"
                  >
                    Start again
                  </Link>
                </div>
              )}

              {result.shelves.map((shelf) => (
                <section
                  key={shelf.id}
                  id={`shelf-${shelf.id}`}
                  className="scroll-mt-4"
                  data-testid={`shelf-${shelf.id}`}
                >
                  <h2 className="ghad-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                    {shelf.title}{" "}
                    <span className="text-[var(--gh-ink-soft)]">
                      {shelf.finds.length}
                    </span>
                  </h2>
                  {shelf.line && (
                    <p className="mt-1 max-w-2xl text-base text-[var(--gh-ink-soft)]">
                      {shelf.line}
                    </p>
                  )}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {shelf.finds
                      .slice(0, all === shelf.id ? 60 : SHELF)
                      .map((f) => (
                        <FindCard
                          key={f.experience.id}
                          find={f}
                          origin={origin}
                          youngest={age}
                        />
                      ))}
                  </div>
                  {all !== shelf.id && shelf.finds.length > SHELF && (
                    <Link
                      href={`/christmas/discover?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(writeAsk(ask))), all: shelf.id }).toString()}#shelf-${shelf.id}`}
                      className="mt-4 inline-flex min-h-12 items-center rounded-full border-2 border-black/10 bg-white px-5 font-semibold hover:border-black/30"
                      data-testid={`more-${shelf.id}`}
                    >
                      Show all {shelf.finds.length}
                    </Link>
                  )}
                </section>
              ))}
            </div>
          </main>
        </PicksProvider>
      </ThemeProvider>
    </>
  );
}
