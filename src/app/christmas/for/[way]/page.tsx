import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { RememberTown } from "@/components/christmas/RememberTown";
import { PicksProvider } from "@/components/christmas/Picks";
import { FindCard } from "@/components/christmas/FindCard";
import { AtlasDown } from "@/components/christmas/parts";
import {
  IdeaCard,
  PlanCard,
  RowSkeleton,
  WayCard,
} from "@/components/christmas/ways";
import { ExperienceLocation } from "@/components/location/ExperienceLocation";
import { PendingContent, PendingProvider } from "@/components/loading/Pending";
import styles from "@/components/christmas/christmas.module.css";
import { todayIn } from "@/lib/adventures/overview";
import { townById } from "@/domain/discovery/towns";
import { answer, writeAsk, type Ask } from "@/domain/christmas/discover";
import { TOWNS } from "@/domain/christmas/lights/model";
import {
  WAYS,
  askFor,
  choiceHref,
  countHere,
  ideasFor,
  isWayId,
  plansFor,
  questionsFor,
  readChoice,
  strongest,
  wantsFinds,
  wayById,
  wayHref,
  type Choice,
  type Way,
} from "@/domain/christmas/ways";
import { christmasFinds } from "../../_server/corpus";
import { whereAreWe } from "../../_server/where";

type Params = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ way: string }>;
}): Promise<Metadata> {
  const { way } = await params;
  if (!isWayId(way)) return {};
  const w = wayById(way);
  return {
    title: `${w.label} — Go Have a Christmas`,
    description: `${w.line} Real things near you this season, and ideas that work anywhere.`,
  };
}

/** How many real finds a way's page shows before "see all". */
const FINDS = { events: 6, default: 4 } as const;

const plannerHref = (say: string, at?: string) => {
  const q = new URLSearchParams({ say });
  if (at) q.set("at", at);
  return `/christmas/itinerary?${q.toString()}`;
};

/**
 * **One way to have a Christmas** — `/christmas/for/date`, `/family`,
 * `/friends`, `/cozy`, `/events`. A question or two as taps (each one
 * optional, each answer in the address), then a few things to do: plans the
 * planner builds from real places, Atlas's own finds near here, and
 * Passport's ideas, each said for what it is. The lights are the map itself
 * (`/christmas/for/lights` goes there).
 */
export default async function WayPage({
  params,
  searchParams,
}: {
  params: Promise<{ way: string }>;
  searchParams?: Promise<Params>;
}) {
  const { way: id } = await params;
  if (!isWayId(id)) notFound();
  const query = (await searchParams) ?? {};
  const requested = typeof query.at === "string" ? query.at : undefined;
  const where = await whereAreWe(requested);
  const at = where.at;
  const lightsTown = (TOWNS as readonly string[]).includes(at);
  if (id === "lights") redirect(wayHref("lights", at, lightsTown));

  const way = wayById(id);
  const choice = readChoice(way, query);
  const today = todayIn();
  const ask = askFor(way, choice, at, today);
  const town = townById(at);
  const townName = town?.name.replace(/,\s*BC$/, "") ?? "you";
  const plans = plansFor(way, choice);
  const ideas = ideasFor(way, choice);
  const lightsHref = wayHref("lights", at, lightsTown);
  const finds = wantsFinds(way, choice);

  return (
    <>
      {where.chosen && <RememberTown town={at} />}
      <ThemeProvider className="block">
        <PicksProvider planHref={`/christmas/plan?${writeAsk({ at })}`}>
          <main className={`${styles.page} min-h-screen pb-28`}>
            <PendingProvider>
              <header
                className="relative z-30 text-white"
                style={{
                  background: `radial-gradient(110% 80% at 90% 0%, color-mix(in srgb, ${way.art.glow} 30%, transparent), transparent 60%), linear-gradient(160deg, ${way.art.from}, ${way.art.to})`,
                }}
              >
                <div className="mx-auto max-w-6xl px-4 pt-4 pb-6 sm:px-6 sm:pt-8 sm:pb-10">
                  <Link
                    href={`/christmas?${writeAsk({ at })}`}
                    className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-bold text-white/90 hover:text-white"
                    data-testid="back-to-christmas"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    All of Christmas
                  </Link>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <div>
                      <h1 className="ghad-display text-[2.4rem] leading-[0.95] font-extrabold tracking-[-0.04em] sm:text-6xl">
                        {way.label}
                      </h1>
                      <p className="mt-2 max-w-xl text-base text-white/90 sm:text-lg">
                        {way.includes.join(" · ")}
                      </p>
                    </div>
                    <span
                      className="text-6xl leading-none drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)] sm:text-8xl"
                      aria-hidden
                    >
                      {way.emoji}
                    </span>
                  </div>
                  <Suspense fallback={null}>
                    <ExperienceLocation
                      scope="christmas"
                      experience="Christmas"
                      at={at}
                      className="mt-3 text-white"
                    />
                  </Suspense>
                </div>
                <div className={styles.lights} aria-hidden />
              </header>

              <div className="mx-auto max-w-6xl space-y-9 px-4 pt-5 sm:space-y-12 sm:px-6 sm:pt-8">
                <Questions way={way} choice={choice} at={at} />

                {plans.length > 0 && (
                  <section aria-labelledby="plans-title">
                    <h2
                      id="plans-title"
                      className="ghad-display text-2xl font-extrabold"
                    >
                      Make a plan of it
                    </h2>
                    <p className="mt-1 text-sm text-[var(--gh-ink-soft)]">
                      Each part becomes a real place near {townName} — or the
                      plan says it couldn&apos;t find one.
                    </p>
                    <ul
                      className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                      data-testid="plans"
                    >
                      {plans.map((p) => (
                        <li key={p.id}>
                          <PlanCard plan={p} href={plannerHref(p.say, at)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {finds && (
                  <PendingContent>
                    <Suspense
                      fallback={
                        <RowSkeleton
                          label={`Finding what's on around ${townName}…`}
                          cards={id === "events" ? 3 : 4}
                        />
                      }
                    >
                      <WayFinds
                        way={way}
                        choice={choice}
                        ask={ask}
                        today={today}
                        townName={townName}
                        lightsHref={lightsHref}
                      />
                    </Suspense>
                  </PendingContent>
                )}

                {ideas.length > 0 && (
                  <section aria-labelledby="ideas-title">
                    <h2
                      id="ideas-title"
                      className="ghad-display text-2xl font-extrabold"
                    >
                      {way.id === "cozy" || choice.stay === "in"
                        ? "Ideas for a night in"
                        : "More ideas"}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--gh-ink-soft)]">
                      Passport&apos;s ideas — no listing, no booking, nothing to
                      check. They work anywhere.
                    </p>
                    <ul
                      className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                      data-testid="ideas"
                    >
                      {ideas.map((idea) => (
                        <li key={idea.id}>
                          <IdeaCard
                            idea={idea}
                            {...(idea.plan
                              ? { planHref: plannerHref(idea.plan, at) }
                              : idea.lights
                                ? { lightsHref }
                                : {})}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <nav aria-labelledby="other-ways">
                  <h2
                    id="other-ways"
                    className="ghad-display text-xl font-extrabold"
                  >
                    Another kind of Christmas
                  </h2>
                  <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {WAYS.filter((w) => w.id !== way.id).map((w) => (
                      <li key={w.id}>
                        <WayCard
                          way={w}
                          href={wayHref(w.id, at, lightsTown)}
                          small
                        />
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </PendingProvider>
          </main>
        </PicksProvider>
      </ThemeProvider>
    </>
  );
}

/** The way's questions, as taps. Tapping an answer again clears it. */
function Questions({
  way,
  choice,
  at,
}: {
  readonly way: Way;
  readonly choice: Choice;
  readonly at: string;
}) {
  const questions = questionsFor(way);
  if (questions.length === 0) return null;
  return (
    <div className="space-y-3" data-testid="questions">
      {questions.map((q) => (
        <div
          key={q.id}
          role="group"
          aria-labelledby={`q-${q.id}`}
          className="flex flex-wrap items-center gap-2"
        >
          <p
            id={`q-${q.id}`}
            className="w-full text-sm font-extrabold tracking-[0.06em] text-[#b3242f] uppercase sm:w-auto sm:min-w-44"
          >
            {q.label}
          </p>
          {q.options.map((o) => {
            const on =
              (choice as Record<string, string | undefined>)[q.id] === o.value;
            return (
              <Link
                key={o.value}
                href={choiceHref(way, choice, at, { id: q.id, value: o.value })}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={
                  on
                    ? "inline-flex min-h-11 items-center rounded-full bg-[#0f3b2b] px-4 text-sm font-bold text-white"
                    : "inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-black/10 hover:ring-black/30"
                }
                data-testid={`q-${q.id}-${o.value}`}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Atlas's finds for this way and choice: a few, and the way to all of them. */
async function WayFinds({
  way,
  choice,
  ask,
  today,
  townName,
  lightsHref,
}: {
  readonly way: Way;
  readonly choice: Choice;
  readonly ask: Ask;
  readonly today: string;
  readonly townName: string;
  readonly lightsHref: string;
}) {
  const corpus = await christmasFinds(ask, today);
  const answered = answer(corpus.finds, ask, { today, now: new Date() });
  const shown = strongest(
    answered,
    way.id === "events" ? FINDS.events : FINDS.default,
  );
  const total = countHere(answered);
  const town = townById(ask.at);
  const origin = town
    ? { latitude: town.latitude, longitude: town.longitude }
    : undefined;
  const youngest = ask.ages[0];
  const seeAll = `/christmas/discover?${writeAsk(ask)}`;
  const when = choice.when && choice.when !== "any";

  return (
    <section aria-labelledby="finds-title" data-testid="way-finds">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="finds-title" className="ghad-display text-2xl font-extrabold">
            {way.id === "events" ? "Happening" : "Real things to do"} around{" "}
            {townName}
          </h2>
          <p className="mt-1 text-sm text-[var(--gh-ink-soft)]">
            From Atlas, with the dates and how sure they are on each card.
          </p>
        </div>
        {total > shown.length && (
          <Link
            href={seeAll}
            className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4"
            data-testid="see-all"
          >
            See all {total}
          </Link>
        )}
      </div>
      {corpus.outage && (
        <div className="mt-3">
          <AtlasDown />
        </div>
      )}
      {shown.length > 0 ? (
        <div
          className="-mx-4 mt-3 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6"
          data-testid="way-find-row"
        >
          {shown.map((f) => (
            <FindCard
              key={f.experience.id}
              find={f}
              origin={origin}
              {...(youngest !== undefined ? { youngest } : {})}
              compact
            />
          ))}
        </div>
      ) : (
        !corpus.outage && (
          <p
            className="mt-3 rounded-[22px] bg-white p-5 text-base ring-1 ring-black/5"
            data-testid="way-empty"
          >
            {when
              ? `Atlas has nothing for then near ${townName} yet. Try "Any time", or another place above.`
              : `Atlas has nothing of this kind near ${townName} yet.`}{" "}
            The{" "}
            <Link
              href={lightsHref}
              className="font-semibold underline underline-offset-4"
            >
              lights map
            </Link>{" "}
            and the{" "}
            <Link
              href={seeAll}
              className="font-semibold underline underline-offset-4"
            >
              full directory
            </Link>{" "}
            may have more
            {way.id === "events" ? "" : ", and the ideas below work anywhere"}.
          </p>
        )
      )}
    </section>
  );
}
