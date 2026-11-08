import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Plus } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { SavedReview } from "@/components/saved/SavedReview";
import { currentUser } from "@/lib/auth/currentUser";
import { loadMyStuff } from "@/lib/data/loadMyStuff";
import { octoberThingsFor } from "@/lib/october/octoberThings";
import { safeNext } from "@/lib/auth/safeNext";
import { adventureSession } from "@/lib/adventures/server";
import { adventureStatus, nextAdventure } from "@/lib/adventures/present";
import { adventureOverview, todayIn } from "@/lib/adventures/overview";
import { AdventureCard } from "@/components/adventures/AdventureCard";
import { PillLink } from "@/components/adventures/kit";
import {
  AdventuresAndMemories,
  SectionTitle,
  type AdventureEntry,
} from "@/components/my-stuff/AdventuresAndMemories";
import { AddToCollection } from "@/components/my-stuff/AddToCollection";
import { sizedImage } from "@/lib/media/sizedImage";
import { MY_STUFF_LINE } from "@/lib/voice";
import { ThemeProvider } from "@/components/ghad/theme";

export const metadata: Metadata = { title: "My Stuff — Go Have a Day" };

/**
 * **My Stuff** — the owner's brief, _Go Have a Day — the experience
 * overhaul_ (2026-11-08, P3): one clear destination for
 *
 * ```
 * IDEAS        individual saved experiences
 * COLLECTIONS  optional groups of them
 * ADVENTURES   planned days, weekends and trips
 * MEMORIES     completed adventures and their memories
 * ```
 *
 * Saving never needs a collection; collections can be made later. The
 * Adventure Pocket on Discovery is a convenient view of the same ideas
 * (`useIdeas`, `loadMyStuff`): this page is their permanent home, and the
 * two read the same Atlas boards, so there is one source of truth.
 *
 * It keeps everything the Saved page did (ADR 010, ADR 012): _Create an
 * adventure_ is the largest action, choosing ideas leads to a day, an
 * adventure or now a collection, and `?back=` returns to exactly where
 * Discovery was.
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

  const [user, stuff] = await Promise.all([currentUser(), loadMyStuff()]);
  // The intentions already recorded, so Ideas can show what somebody has
  // already decided rather than offering it to them again. Read-only here.
  const october =
    stuff.status === "ok" && user
      ? await octoberThingsFor(user).catch(() => [])
      : [];

  // Adventures this person is planning or has had. Not reachable (no
  // session, or the adventures tables not migrated here) means the sections
  // say so plainly — never "you have none".
  const overview = user
    ? await adventureSession()
        .then((session) => (session ? adventureOverview(session) : null))
        .catch(() => null)
    : null;
  const today = todayIn();
  const next = overview ? nextAdventure(overview.adventures, today) : null;
  const entries: AdventureEntry[] = (overview?.adventures ?? [])
    .slice()
    .sort((a, b) =>
      a.id === next?.id
        ? -1
        : b.id === next?.id
          ? 1
          : (a.startsOn ?? "9999").localeCompare(b.startsOn ?? "9999"),
    )
    .map((a) => ({
      id: a.id,
      title: a.title,
      over:
        adventureStatus(a, { stops: 1, undecided: 0 }, today).stage === "done",
      card: (
        <AdventureCard
          adventure={a}
          today={today}
          {...(overview?.glances[a.id]
            ? { glance: overview.glances[a.id] }
            : {})}
          {...(overview?.covers[a.id] ? { cover: overview.covers[a.id] } : {})}
        />
      ),
    }));

  const ideas = stuff.status === "ok" ? stuff.ideas.length : 0;
  const collections = stuff.status === "ok" ? stuff.collections : [];
  const writable = collections
    .filter((c) => c.role !== "viewer")
    .map((c) => ({ id: c.board.id, name: c.board.name }));
  const jumps = [
    [
      "ideas",
      "Ideas",
      ideas + (stuff.status === "ok" ? stuff.unresolved.length : 0),
    ],
    ["collections", "Collections", collections.length],
    ["adventures", "Adventures", null],
    ["memories", "Memories", null],
  ] as const;

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
                <h1 className="ghad-display text-[2.6rem] leading-[0.95] font-extrabold tracking-[-0.04em] text-[var(--gh-ink)] sm:text-7xl">
                  My Stuff
                </h1>
                <p className="mt-3 max-w-xl text-lg text-[var(--gh-ink-soft)]">
                  {MY_STUFF_LINE}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <PillLink
                  href="/adventures/new"
                  variant="forest"
                  data-testid="create-adventure"
                  className="min-h-14 px-7 text-lg"
                >
                  <Plus className="h-5 w-5" aria-hidden />
                  Create an adventure
                </PillLink>
                <PillLink
                  href="/go"
                  variant="quiet"
                  data-testid="saved-build-a-day"
                  className="min-h-11 px-4 text-base"
                >
                  Or build one day
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </PillLink>
              </div>
            </header>

            {/* **Your next adventure leads** (ADR 012: Saved opens on the
                adventure being made, next one first). The four parts follow
                in the brief's order; this one is also listed under
                Adventures. */}
            {next && (
              <section
                aria-labelledby="next-heading"
                data-testid="saved-adventures"
                className="mt-10"
              >
                <p
                  id="next-heading"
                  className="mb-3 text-xs font-bold tracking-[0.14em] text-[var(--gh-ink-soft)] uppercase"
                >
                  Your next adventure
                </p>
                <AdventureCard
                  adventure={next}
                  today={today}
                  hero
                  {...(overview?.glances[next.id]
                    ? { glance: overview.glances[next.id] }
                    : {})}
                  {...(overview?.covers[next.id]
                    ? { cover: overview.covers[next.id] }
                    : {})}
                />
              </section>
            )}

            {/* **Four parts, one tap each.** Sticky so a long list of ideas
                never hides where the adventures are. */}
            <nav
              aria-label="My Stuff"
              data-testid="my-stuff-sections"
              className="sticky top-0 z-10 -mx-4 mt-8 flex gap-1 overflow-x-auto border-b border-[var(--gh-line)] bg-white/95 px-4 backdrop-blur sm:mx-0 sm:px-0"
            >
              {jumps.map(([id, label, count]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="inline-flex min-h-12 shrink-0 items-center gap-1.5 px-3 text-[15px] font-semibold text-[var(--gh-ink-soft)] hover:text-[var(--gh-ink)]"
                >
                  {label}
                  {count !== null && (
                    <span className="text-sm font-normal">{count}</span>
                  )}
                </a>
              ))}
            </nav>

            <section
              id="ideas"
              aria-labelledby="ideas-heading"
              data-testid="my-stuff-ideas"
              className="mt-8 scroll-mt-20"
            >
              <SectionTitle id="ideas-heading">Ideas</SectionTitle>
              <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
                Everything you&apos;ve saved. Choose a few and Passport turns
                them into a day, a weekend or a trip — or tuck them into a
                collection.
              </p>
              <div className="mt-5">
                {stuff.status === "signed-out" && (
                  <Panel
                    title="Sign in to see what you have saved"
                    description="What you collect stays with your account, on any device."
                  />
                )}
                {stuff.status === "error" && (
                  <Panel
                    title="Couldn't load what you saved"
                    description="Something went wrong reaching Atlas. Your stuff is unchanged — try again in a moment."
                  />
                )}
                {stuff.status === "ok" &&
                  !stuff.ideasBoard &&
                  stuff.ideas.length === 0 && (
                    <Panel
                      title="Nothing saved yet"
                      description="Save anything that looks interesting while you browse. It lands in your Pocket, and here."
                    />
                  )}
                {stuff.status === "ok" &&
                  (stuff.ideasBoard || stuff.ideas.length > 0) && (
                    <SavedReview
                      boardId={stuff.ideasBoard?.id ?? ""}
                      boardName={stuff.ideasBoard?.name ?? "Ideas"}
                      label="saved"
                      experiences={stuff.ideas}
                      unresolved={stuff.unresolved}
                      holders={stuff.holders}
                      collections={writable}
                      october={october}
                      back={back}
                      adventure={adventure}
                    />
                  )}
              </div>
            </section>

            <section
              id="collections"
              aria-labelledby="collections-heading"
              data-testid="my-stuff-collections"
              className="mt-16 scroll-mt-20"
            >
              <SectionTitle id="collections-heading" count={collections.length}>
                Collections
              </SectionTitle>
              <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
                Optional. Group ideas whenever you feel like it — they stay in
                Ideas too.
              </p>
              {collections.length > 0 && (
                <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {collections.map((c) => (
                    <li key={c.board.id}>
                      <Link
                        href={`/boards/${encodeURIComponent(c.board.id)}`}
                        data-testid="collection"
                        className="group flex items-center gap-4 rounded-3xl border border-[var(--gh-line)] p-3 hover:border-[var(--gh-ink)]/30"
                      >
                        {c.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted, sized like every card
                          <img
                            {...sizedImage(c.cover, [160, 320])}
                            sizes="80px"
                            alt=""
                            loading="lazy"
                            className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="h-20 w-20 shrink-0 rounded-2xl bg-[var(--gh-cream)]"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-lg font-bold text-[var(--gh-ink)] group-hover:underline">
                            {c.board.name}
                          </span>
                          <span className="block text-sm text-[var(--gh-ink-soft)]">
                            {c.count} {c.count === 1 ? "thing" : "things"}
                            {c.role === "viewer"
                              ? " · shared with you"
                              : c.role === "editor"
                                ? " · shared, you can add"
                                : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {stuff.status === "ok" && (
                <details
                  className="mt-5 max-w-md rounded-3xl bg-[var(--gh-cream)] p-4"
                  data-testid="new-collection"
                >
                  <summary className="min-h-11 cursor-pointer content-center text-base font-semibold text-[var(--gh-ink)]">
                    New collection
                  </summary>
                  <div className="mt-3">
                    <AddToCollection collections={writable} />
                  </div>
                </details>
              )}
            </section>

            <AdventuresAndMemories entries={entries} signedIn={Boolean(user)} />
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
