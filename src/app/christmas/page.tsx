import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  CalendarHeart,
  Compass,
  Sun,
} from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { Picture } from "@/components/adventures/Picture";
import { AdventureCard } from "@/components/adventures/AdventureCard";
import { Festive } from "@/components/christmas/Festive";
import { SayIt } from "@/components/christmas/SayIt";
import { FindCard } from "@/components/christmas/FindCard";
import { PicksProvider } from "@/components/christmas/Picks";
import { AtlasDown, Section, TownChips } from "@/components/christmas/parts";
import styles from "@/components/christmas/christmas.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { adventuresOf, type AdventureSummary } from "@/lib/adventures/store";
import { todayIn } from "@/lib/adventures/overview";
import { townById } from "@/domain/discovery/towns";
import { subjectHref } from "@/domain/experience/destination";
import {
  answer,
  readAsk,
  writeAsk,
  type Find,
} from "@/domain/christmas/discover";
import { THEMES } from "@/domain/christmas/themes";
import { CHALLENGES } from "@/domain/christmas/challenges";
import { SHAPES } from "@/domain/christmas/plans";
import { CONFIDENCE_LABEL, season } from "@/domain/christmas/when";
import { christmasFinds } from "./_server/corpus";

export const metadata: Metadata = {
  title: "Go Have a Christmas — Passport",
  description:
    "Christmas markets, lights, Santa and the people you love — real things near you this season, planned together and remembered.",
};

/** The page's opening line, by where we are in the season. */
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

const hasPicture = (f: Find) =>
  Boolean(f.experience.heroMedia || f.experience.contextualMedia);

/**
 * **Go Have a Christmas** — Passport's Christmas, inside Go Have a Day.
 *
 * Not a directory: the page opens on the season (how long to go, what is
 * coming up), lets somebody say what kind of Christmas they want in one tap,
 * and leads to a plan made with the people they love. Everything named is an
 * Atlas subject with its evidence; the decoration is CSS.
 */
export default async function ChristmasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const ask = readAsk(params);
  const today = todayIn();
  const town = townById(ask.at);
  const [session, corpus] = await Promise.all([
    adventureSession(),
    christmasFinds(ask, today),
  ]);
  const mine: AdventureSummary[] = session
    ? await adventuresOf(session.db, session.user.id)
        .then((all) => all.filter((a) => a.kind === "christmas"))
        .catch(() => [])
    : [];

  const stage = season(today);
  const answered = answer(corpus.finds, ask);
  const live = answered.shelves
    .filter((s) => s.id !== "past" && s.id !== "age" && s.id !== "far")
    .flatMap((s) => s.finds);
  const upcoming = live
    .filter(
      (f) =>
        f.reading.christmas &&
        (f.when.confidence === "dated" || f.when.confidence === "check"),
    )
    .sort((a, b) => (a.when.from ?? "").localeCompare(b.when.from ?? ""));
  const lead =
    upcoming.find(hasPicture) ?? live.find(hasPicture) ?? upcoming[0];
  const christmasCount = corpus.finds.filter((f) => f.reading.christmas).length;
  const datedCount = corpus.finds.filter(
    (f) => f.reading.christmas && f.when.confidence === "dated",
  ).length;
  const here = writeAsk({ at: ask.at });
  const q = here ? `?${here}` : "";
  const amp = here ? `&${here}` : "";
  const townName = town?.name.replace(/,\s*BC$/, "");
  const origin = town
    ? { latitude: town.latitude, longitude: town.longitude }
    : undefined;

  return (
    <>
      <ThemeProvider className="block">
        <PicksProvider planHref={`/christmas/plan${q}`}>
          <main className={`${styles.page} min-h-screen pb-28`}>
            <header className={styles.night}>
              {lead && (
                <>
                  <Picture
                    experience={lead.experience}
                    priority
                    showLabel={false}
                    fallbackTitle=""
                    tone="#0f3b2b"
                    className="absolute inset-0 -z-10 h-full w-full"
                  />
                  <div
                    className="absolute inset-0 -z-10 bg-gradient-to-t from-[#082319] via-[#082319]/60 to-[#082319]/20"
                    aria-hidden
                  />
                </>
              )}
              <div className="mx-auto flex min-h-[calc(100svh-5.5rem)] max-w-6xl flex-col justify-end px-4 pt-16 pb-8 sm:min-h-[36rem] sm:px-6 sm:pb-12">
                <p className="text-sm font-bold tracking-[0.18em] text-[#ffd98a] uppercase">
                  Go Have a Christmas
                </p>
                <h1 className="ghad-display mt-3 max-w-3xl text-[3.4rem] leading-[0.9] font-extrabold tracking-[-0.045em] text-balance sm:text-8xl">
                  Let&apos;s make some Christmas memories.
                </h1>
                <p
                  className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-black/35 px-4 py-2 text-lg font-bold backdrop-blur"
                  data-testid="countdown"
                >
                  <CalendarHeart
                    className="h-5 w-5 text-[#ffd98a]"
                    aria-hidden
                  />
                  {seasonLine(stage)}
                </p>
                <p className="mt-4 max-w-xl text-lg text-white/90">
                  Markets, lights, hot chocolate and the people you love — real
                  things
                  {townName ? ` near ${townName}` : " near you"}, with the dates
                  to prove it.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="#say-it"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ffd98a] px-6 text-base font-bold text-[#082319] hover:brightness-105"
                    data-testid="cta-plan"
                  >
                    Plan our Christmas
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </Link>
                  <Link
                    href={`/christmas/discover${q}`}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 px-6 text-base font-bold backdrop-blur hover:bg-white/25"
                    data-testid="cta-discover"
                  >
                    <Compass className="h-5 w-5" aria-hidden />
                    Find Christmas
                    {townName ? ` near ${townName}` : " near me"}
                  </Link>
                </div>
                {lead && (
                  <Link
                    href={subjectHref(lead.experience.kind, lead.experience.id)}
                    className="mt-5 block w-fit max-w-full text-sm text-white/85 underline-offset-4 hover:underline"
                    data-testid="lead-find"
                  >
                    <span className="font-bold text-[#ffd98a]">Pictured:</span>{" "}
                    {lead.experience.title}
                    {lead.when.line ? ` · ${lead.when.line}` : ""} ·{" "}
                    {CONFIDENCE_LABEL[lead.when.confidence]}
                  </Link>
                )}
                <Festive className="mt-4" />
              </div>
              <div className={styles.lights} aria-hidden />
            </header>

            <div className="mx-auto max-w-6xl space-y-14 px-4 pt-8 sm:px-6">
              <TownChips
                selected={ask.at}
                hrefFor={(id) => `/christmas${id ? `?at=${id}` : ""}`}
              />

              {corpus.outage && <AtlasDown />}

              <section id="say-it" className="scroll-mt-20">
                <SayIt today={today} {...(ask.at ? { town: ask.at } : {})} />
              </section>

              <Section
                eyebrow="What kind of Christmas?"
                title="Start with what makes you grin"
              >
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {THEMES.map((theme) => {
                    const here = live.filter((f) =>
                      f.reading.themes.includes(theme.id),
                    );
                    const cover = here.find(hasPicture);
                    return (
                      <li key={theme.id}>
                        <Link
                          href={`/christmas/discover?theme=${theme.id}${amp}`}
                          className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[24px] bg-[#0f3b2b] p-4 text-white shadow-[0_6px_24px_rgba(8,35,25,0.12)] transition hover:-translate-y-0.5 motion-reduce:transition-none"
                          data-testid={`theme-${theme.id}`}
                        >
                          {cover && (
                            <Picture
                              experience={cover.experience}
                              showLabel={false}
                              fallbackTitle=""
                              tone="#0f3b2b"
                              className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
                            />
                          )}
                          <span
                            className="absolute inset-0 bg-gradient-to-t from-[#082319]/90 via-[#082319]/30 to-transparent"
                            aria-hidden
                          />
                          <span className="relative">
                            <span className="ghad-display block text-xl leading-tight font-extrabold">
                              {theme.label}
                            </span>
                            <span className="text-sm text-white/85">
                              {here.length > 0
                                ? `${here.length} Atlas knows about`
                                : "None in Atlas yet"}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  <li>
                    <Link
                      href={`/christmas/discover${q}`}
                      className="flex aspect-[4/5] flex-col justify-end rounded-[24px] bg-[#b3242f] p-4 text-white transition hover:brightness-110 motion-reduce:transition-none"
                    >
                      <span className="ghad-display text-xl leading-tight font-extrabold">
                        Show me everything
                      </span>
                      <span className="text-sm text-white/85">
                        {live.length} to look at
                      </span>
                    </Link>
                  </li>
                </ul>
              </Section>

              {upcoming.length > 0 && (
                <Section
                  eyebrow="Coming up this season"
                  title={
                    townName
                      ? `On the calendar near ${townName}`
                      : "On the calendar"
                  }
                  line="Atlas's dates, soonest first. A yellow chip means check the days before you go."
                  action={
                    <Link
                      href={`/christmas/discover${q}`}
                      className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4"
                    >
                      All {live.length}
                    </Link>
                  }
                >
                  <div
                    className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6"
                    data-testid="upcoming"
                  >
                    {upcoming.slice(0, 10).map((f) => (
                      <FindCard
                        key={f.experience.id}
                        find={f}
                        origin={origin}
                        compact
                      />
                    ))}
                  </div>
                </Section>
              )}

              <Section
                eyebrow="Make it a plan"
                title="What are you dreaming of?"
                line="Passport sketches it from real places, kept around the Christmas things you chose. Invite your people, change anything."
              >
                <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5">
                  {SHAPES.map((shape) => (
                    <li
                      key={shape.id}
                      className="w-[15rem] shrink-0 snap-start sm:w-auto"
                    >
                      <Link
                        href={`/christmas/plan?shape=${shape.id}${amp}`}
                        className={`${styles.ticket} flex h-full flex-col gap-2 rounded-[22px] p-5 transition hover:-translate-y-0.5 motion-reduce:transition-none`}
                        data-testid={`shape-${shape.id}`}
                      >
                        <span
                          className="h-1.5 w-10 rounded-full bg-[#b3242f]"
                          aria-hidden
                        />
                        <span className="ghad-display text-lg leading-tight font-extrabold">
                          {shape.label}
                        </span>
                        <span className="text-sm text-[var(--gh-ink-soft)]">
                          {shape.line}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section
                eyebrow="Christmas challenges"
                title="Small dares. Big memories."
                line="Every Christmas adventure comes with these. Finish one with a photo or a line and it becomes one of the group's memories."
              >
                <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
                  {CHALLENGES.slice(0, 6).map((c) => (
                    <li
                      key={c.id}
                      className="flex w-[17rem] shrink-0 snap-start gap-3 rounded-[22px] bg-[#0f3b2b] p-5 text-white sm:w-auto"
                    >
                      <span
                        className="mt-1 h-10 w-1.5 shrink-0 rounded-full bg-[#ffd98a]"
                        aria-hidden
                      />
                      <span>
                        <span className="ghad-display block text-lg leading-tight font-extrabold">
                          {c.title}
                        </span>
                        <span className="mt-1 block text-sm text-white/80">
                          {c.dare}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>

              {mine.length > 0 && (
                <Section eyebrow="Yours" title="Your Christmas adventures">
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {mine.map((a) => (
                      <li key={a.id}>
                        <AdventureCard adventure={a} today={today} />
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <section className="rounded-[28px] bg-white p-6 ring-1 ring-black/5 sm:p-8">
                <h2 className="ghad-display text-2xl font-extrabold">
                  How Passport knows
                </h2>
                <p className="mt-2 max-w-3xl text-base text-[var(--gh-ink-soft)]">
                  Everything here is something Atlas holds, with the words that
                  make it Christmas on its card.{" "}
                  {corpus.outage
                    ? "Atlas can't be reached right now, so there's nothing to count."
                    : `Atlas knows ${christmasCount} Christmas things; ${datedCount} have this season's dates.`}{" "}
                  Passport never invents a time, a price or that something is
                  open.
                </p>
                <ul className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
                  <li className="rounded-full bg-[#0f3b2b] px-3 py-1 text-white">
                    {CONFIDENCE_LABEL.dated} — dated, from the listing
                  </li>
                  <li className="rounded-full bg-[#ffd98a] px-3 py-1 text-[#082319]">
                    {CONFIDENCE_LABEL.check} — a window, not the days
                  </li>
                  <li className="rounded-full bg-white px-3 py-1 ring-1 ring-black/10">
                    {CONFIDENCE_LABEL.unconfirmed} — no dates this season
                  </li>
                  <li className="rounded-full bg-[#ebe1cd] px-3 py-1">
                    {CONFIDENCE_LABEL.past} — last year&apos;s, or older
                  </li>
                </ul>
              </section>

              <nav
                aria-label="More of Passport"
                className="grid gap-3 sm:grid-cols-3"
              >
                {[
                  {
                    href: "/saved",
                    icon: Bookmark,
                    title: "Saved",
                    line: "Everything you've kept — Christmas included.",
                  },
                  {
                    href: "/go",
                    icon: Sun,
                    title: "Go Have a Day",
                    line: "Any day, built from a sentence.",
                  },
                  {
                    href: "/discovery",
                    icon: Compass,
                    title: "Discover",
                    line: "Everything else worth getting excited about.",
                  },
                ].map(({ href, icon: Icon, title, line }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-start gap-3 rounded-[22px] bg-white p-5 ring-1 ring-black/5 hover:ring-black/20"
                  >
                    <Icon className="mt-1 h-5 w-5 shrink-0" aria-hidden />
                    <span>
                      <span className="block font-bold">{title}</span>
                      <span className="text-sm text-[var(--gh-ink-soft)]">
                        {line}
                      </span>
                    </span>
                  </Link>
                ))}
              </nav>
            </div>
          </main>
        </PicksProvider>
      </ThemeProvider>
    </>
  );
}
