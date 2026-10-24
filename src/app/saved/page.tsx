import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Plus } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { SavedReview } from "@/components/saved/SavedReview";
import { currentUser } from "@/lib/auth/currentUser";
import { loadSaved } from "@/lib/data/loadSaved";
import { octoberThingsFor } from "@/lib/october/octoberThings";
import { safeNext } from "@/lib/auth/safeNext";
import { adventureSession } from "@/lib/adventures/server";
import type { AdventureSummary } from "@/lib/adventures/store";
import { nextAdventure } from "@/lib/adventures/present";
import { adventureOverview, todayIn } from "@/lib/adventures/overview";
import { AdventureCard } from "@/components/adventures/AdventureCard";
import { Eyebrow, PillLink, SectionHeading } from "@/components/adventures/kit";
import { ThemeProvider } from "@/components/ghad/theme";

export const metadata: Metadata = { title: "Saved — Passport" };

/**
 * **The other half of discovering.**
 *
 * Collecting a handful of possibilities and looking at them together is one
 * journey, and it used to be two products: Discovery, then a board
 * administration area with a sharing panel above the things somebody had just
 * saved. The owner's route from one to the other and back took five screens
 * and passed two different pages called *My Places*.
 *
 * **And the home of someone's possibilities** (ADR 012): it opens on the
 * adventures they are making — the next one first, big — and then the places
 * they have saved, which are the raw material for the next. *Create an
 * adventure* is the largest thing on the page, because it is the point.
 *
 * This is the round trip. `?back=` carries the exploration so *Back to
 * discovering* is one tap to exactly where they were, validated by the same
 * `safeNext` the sign-in handoff uses.
 */
export default async function SavedPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const asked = query?.["back"];
  const adventure =
    typeof query?.["adventure"] === "string" &&
    /^[A-Za-z0-9_-]{8,64}$/.test(query["adventure"])
      ? query["adventure"]
      : undefined;
  const back = safeNext(typeof asked === "string" ? asked : null, "/discovery");

  const [user, saved] = await Promise.all([currentUser(), loadSaved()]);
  // The intentions already recorded, so Saved can show what somebody has
  // already decided rather than offering it to them again. Read-only here:
  // nothing about opening this page changes anybody's October.
  const october =
    saved.status === "ok" && user
      ? await octoberThingsFor(user).catch(() => [])
      : [];

  // Adventures this person is planning, to come back to. Not reachable (no
  // session, or the adventures tables not migrated here) means the section
  // is not shown — never "you have none".
  const overview = user
    ? await adventureSession()
        .then((session) => (session ? adventureOverview(session) : null))
        .catch(() => null)
    : null;
  const today = todayIn();
  const next = overview ? nextAdventure(overview.adventures, today) : null;
  const others = overview
    ? overview.adventures.filter((a) => a.id !== next?.id)
    : [];
  const card = (a: AdventureSummary, hero = false) => (
    <AdventureCard
      key={a.id}
      adventure={a}
      today={today}
      hero={hero}
      {...(overview?.glances[a.id] ? { glance: overview.glances[a.id] } : {})}
      {...(overview?.covers[a.id] ? { cover: overview.covers[a.id] } : {})}
    />
  );

  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <ThemeProvider className="block">
        <main className="min-h-screen bg-white">
          <div className="mx-auto max-w-6xl px-4 pt-5 pb-16 sm:px-6 sm:pt-10">
            <Link
              href={back}
              data-testid="back-to-discovering"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--gh-ink-soft)] hover:text-[var(--gh-ink)]"
            >
              <Compass className="h-4 w-4" aria-hidden />
              Back to discovering
            </Link>

            <header className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>Saved</Eyebrow>
                <h1 className="ghad-display mt-2 text-[2.6rem] leading-[0.95] font-extrabold tracking-[-0.04em] text-[var(--gh-ink)] sm:text-7xl">
                  Where to next?
                </h1>
                <p className="mt-3 max-w-xl text-lg text-[var(--gh-ink-soft)]">
                  Your adventures, and every place you&apos;ve saved — the raw
                  material for a hell of a day.
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

            {overview && next && (
              <section
                aria-labelledby="next-heading"
                data-testid="saved-adventures"
                className="mt-10"
              >
                <Eyebrow className="mb-3">
                  <span id="next-heading">Your next adventure</span>
                </Eyebrow>
                {card(next, true)}
                {others.length > 0 && (
                  <div className="mt-12">
                    <SectionHeading
                      id="adventures-heading"
                      title="Your adventures"
                      action={
                        <PillLink href="/adventures" variant="quiet">
                          See them all
                        </PillLink>
                      }
                    />
                    <ul
                      aria-labelledby="adventures-heading"
                      className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      {others.slice(0, 6).map((a) => (
                        <li key={a.id}>{card(a)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
            {overview && !next && overview.adventures.length > 0 && (
              <section
                aria-labelledby="adventures-heading"
                data-testid="saved-adventures"
                className="mt-10"
              >
                <SectionHeading id="adventures-heading" title="Your adventures">
                  All done — time to dream up the next one.
                </SectionHeading>
                <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {overview.adventures.slice(0, 6).map((a) => (
                    <li key={a.id}>{card(a)}</li>
                  ))}
                </ul>
              </section>
            )}
            {overview && overview.adventures.length === 0 && (
              <section
                data-testid="saved-no-adventures"
                className="mt-10 rounded-[28px] bg-[var(--gh-forest)] px-6 py-10 text-white sm:px-10"
              >
                <Eyebrow className="text-[var(--gh-sun)]!">
                  Your first adventure
                </Eyebrow>
                <p className="ghad-display mt-2 max-w-2xl text-3xl leading-tight font-extrabold tracking-[-0.03em] sm:text-5xl">
                  Tell Passport where and when. It sketches the whole day.
                </p>
                <p className="mt-3 max-w-xl text-lg text-white/85">
                  Real places from Atlas, in an order that works — then change
                  anything in your own words.
                </p>
                <PillLink
                  href="/adventures/new"
                  variant="light"
                  className="mt-6 min-h-14 px-7 text-lg"
                >
                  Start one
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </PillLink>
              </section>
            )}

            <section aria-labelledby="places-heading" className="mt-14">
              <SectionHeading
                id="places-heading"
                eyebrow="My places"
                title="Places you've saved"
              >
                Choose a few and Passport turns them into a day, a weekend or a
                trip.
              </SectionHeading>
              <div className="mt-5">
                {saved.status === "signed-out" && (
                  <Panel
                    title="Sign in to see what you have saved"
                    description="What you collect stays with your account, on any device."
                  />
                )}
                {saved.status === "error" && (
                  <Panel
                    title="Couldn't load what you saved"
                    description="Something went wrong reaching Atlas. Your collection is unchanged — try again in a moment."
                  />
                )}
                {saved.status === "not-found" && (
                  <Panel
                    title="Couldn't open your collection"
                    description="Nothing has been lost. Try again in a moment."
                  />
                )}
                {saved.status === "nothing-yet" && (
                  <Panel
                    title="Nothing saved yet"
                    description="Save anything that looks interesting while you browse, and it will be here to plan with."
                  />
                )}

                {saved.status === "ok" && (
                  <SavedReview
                    boardId={saved.board.id}
                    boardName={saved.board.name}
                    experiences={saved.experiences}
                    unresolved={saved.unresolved}
                    october={october}
                    back={back}
                    readOnly={saved.role === "viewer"}
                    adventure={adventure}
                  />
                )}
              </div>
            </section>
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}

function Panel({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="rounded-3xl bg-[var(--gh-cream)] px-6 py-12 text-center">
      <p className="ghad-display text-2xl font-extrabold text-[var(--gh-ink)]">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-md text-base text-[var(--gh-ink-soft)]">
        {description}
      </p>
    </div>
  );
}
