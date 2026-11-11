import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  CalendarHeart,
  Compass,
  MapPin,
  Sun,
} from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { Picture } from "@/components/adventures/Picture";
import { AdventureCard } from "@/components/adventures/AdventureCard";
import { Festive } from "@/components/christmas/Festive";
import { RememberTown } from "@/components/christmas/RememberTown";
import { PinCard } from "@/components/christmas/lights/PinCard";
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
import { around, type SectionId } from "@/domain/christmas/around";
import { TOWNS } from "@/domain/christmas/lights/model";
import { christmasFinds } from "./_server/corpus";
import { lightsFor, viewer } from "./_server/lights";
import { whereAreWe } from "./_server/where";

export const metadata: Metadata = {
  title: "Go Have a Christmas — Passport",
  description:
    "Christmas markets, lights, Santa and the people you love — real things near you this season, planned together and remembered.",
};

const SHORT: Readonly<Record<SectionId, string>> = {
  soon: "Happening soon",
  lights: "Lights",
  markets: "Markets",
  santa: "Santa & family",
  festive: "Festive events",
  drive: "Worth the drive",
};

const EYEBROW: Readonly<Record<SectionId, string>> = {
  soon: "On the calendar",
  lights: "After dark",
  markets: "Gifts, treats and mulled things",
  santa: "With the kids",
  festive: "Shows, festivals and feasts",
  drive: "Worth getting in the car",
};

/** Where "more" goes for a section: the Discover page narrowed to its kind. */
function moreHref(id: SectionId, q: string, lightsTown: string): string {
  const base = q ? `${q}&` : "?";
  switch (id) {
    case "lights":
      return `/christmas/lights${lightsTown}`;
    case "markets":
      return `/christmas/discover${base}theme=markets`;
    case "santa":
      return `/christmas/discover${base}theme=santa`;
    case "festive":
      return `/christmas/discover${base}theme=festivals`;
    case "drive":
      return `/christmas/discover${base}km=250`;
    default:
      return `/christmas/discover${q}`;
  }
}

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
  const asked = readAsk(params);
  // Christmas opens somewhere: the town just chosen, the one remembered, or
  // Vernon — never an unplaced list.
  const where = await whereAreWe(asked.at);
  const ask = { ...asked, at: where.at };
  const today = todayIn();
  const town = townById(ask.at);
  const [session, corpus, lights] = await Promise.all([
    adventureSession(),
    christmasFinds(ask, today),
    viewer().then((v) => lightsFor(v)),
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
  const sections = around(answered, today, ask.km, lights.pins);
  const sectionFinds = sections.flatMap((s) => s.finds);
  const lead =
    sectionFinds.find(hasPicture) ?? live.find(hasPicture) ?? sectionFinds[0];
  const lightsTown = (TOWNS as readonly string[]).includes(ask.at)
    ? `?at=${ask.at}`
    : "";
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
      <PassportNav displayName={session?.user.displayName ?? null} />
      {where.chosen && <RememberTown town={ask.at} />}
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
                  Christmas around {townName ?? "you"}.
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
                  Lights, markets, Santa and the people you love — real things
                  {townName ? ` near ${townName}` : " near you"}, with the dates
                  to prove it. Let&apos;s make some Christmas memories.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="#build"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ffd98a] px-6 text-base font-bold text-[#082319] hover:brightness-105"
                    data-testid="cta-plan"
                  >
                    Build a Christmas adventure
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </Link>
                  <Link
                    href={`/christmas/lights${lightsTown}`}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#b3242f] px-6 text-base font-bold text-white hover:brightness-110"
                    data-testid="cta-lights"
                  >
                    <MapPin className="h-5 w-5" aria-hidden />
                    The Christmas lights map
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
                anywhere={false}
                selected={ask.at}
                hrefFor={(id) => `/christmas${id ? `?at=${id}` : ""}`}
              />

              {corpus.outage && <AtlasDown />}

              {sections.length > 0 && (
                <nav
                  aria-label="On this page"
                  className="-mx-4 -mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
                  data-testid="around-nav"
                >
                  {[
                    ...sections.map((s) => ({
                      id: s.id as string,
                      label: SHORT[s.id],
                    })),
                    { id: "build", label: "Build an adventure" },
                  ].map((j) => (
                    <a
                      key={j.id}
                      href={`#${j.id}`}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-black/10 hover:ring-black/30"
                    >
                      {j.label}
                    </a>
                  ))}
                </nav>
              )}

              {sections.map((s) => (
                <Section
                  key={s.id}
                  id={s.id}
                  eyebrow={EYEBROW[s.id]}
                  title={s.title}
                  line={s.line}
                  action={
                    <Link
                      href={moreHref(s.id, q, lightsTown)}
                      className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4"
                      data-testid={`more-${s.id}`}
                    >
                      {s.more > 0 ? `${s.more} more` : "See them all"}
                    </Link>
                  }
                >
                  {s.finds.length > 0 && (
                    <div
                      className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6"
                      data-testid={`around-${s.id}`}
                    >
                      {s.finds.map((f) => (
                        <FindCard
                          key={f.experience.id}
                          find={f}
                          origin={origin}
                          compact
                        />
                      ))}
                    </div>
                  )}
                  {s.pins.length > 0 && (
                    <div className={s.finds.length > 0 ? "mt-5" : ""}>
                      <p className="mb-2 text-sm font-semibold text-[var(--gh-ink-soft)]">
                        From the community lights map
                        <span className="font-normal">
                          {" "}
                          — local listings checked by a person, not from Atlas
                        </span>
                      </p>
                      <ul
                        className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6"
                        data-testid={`around-${s.id}-pins`}
                      >
                        {s.pins.map((p) => (
                          <li
                            key={p.id}
                            className="w-[17.5rem] shrink-0 snap-start"
                          >
                            <PinCard pin={p} day />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {s.id === "lights" && (
                    <Link
                      href={`/christmas/lights${lightsTown}`}
                      className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#b3242f] px-6 font-extrabold text-white hover:brightness-110"
                      data-testid="lights-banner"
                    >
                      📍 Open the lights map — or pin one we&apos;re missing
                    </Link>
                  )}
                </Section>
              ))}

              {sections.length === 0 && !corpus.outage && (
                <p
                  className="rounded-[22px] bg-white p-5 text-base ring-1 ring-black/5"
                  data-testid="around-empty"
                >
                  Atlas has no dated Christmas things near {townName} yet. Try
                  another town above, or{" "}
                  <Link
                    href={`/christmas/discover${q}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    everything Atlas knows
                  </Link>
                  .
                </p>
              )}

              <section id="build" className="scroll-mt-20">
                <div id="say-it" className="scroll-mt-20">
                  <SayIt today={today} {...(ask.at ? { town: ask.at } : {})} />
                </div>
                <div className="mt-8">
                  <Section
                    eyebrow="Build a Christmas adventure"
                    title="What are you dreaming of?"
                    line="Add things to your Christmas day as you scroll — events, markets, light displays — then make it an adventure. Passport sketches around what you chose, from real places; invite your people, change anything."
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
                </div>
              </section>

              <Section
                eyebrow="Or start with what makes you grin"
                title="What kind of Christmas?"
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
