import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clapperboard, Dices } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { ShareLink } from "@/components/christmas/movies/ShareLink";
import styles from "@/components/christmas/christmas.module.css";
import { readAsk, writeAsk } from "@/domain/christmas/discover";
import {
  KINDS,
  NIGHT_IN,
  WATCHING,
  filmFor,
  isKind,
  isWatching,
  shelf,
  threeFor,
  type ChristmasFilm,
  type Kind,
  type Watching,
} from "@/domain/christmas/movies";

export const metadata: Metadata = {
  title: "Christmas movies — Go Have a Christmas",
  description:
    "Family films, comedies, romance, classics and animated Christmas movies, and three picks for tonight's movie night.",
};

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

/**
 * **Christmas movies** (owner brief M1064) — a cozy night in, chosen fast.
 *
 * Movie Night asks who is watching and, if anybody cares, what kind; it
 * offers three films, three more on request, and a film once chosen becomes
 * tonight's plan with a few ideas around it. Every choice is in the address,
 * so the plan is shared as a link and reopened from it — no account.
 *
 * Below it, the shelves the brief names. No film says where it is
 * streaming: Passport has no Canadian availability feed and will not guess
 * (`src/domain/christmas/movies.ts`). A night out goes to the planner, which
 * finds a real cinema through Atlas and says showtimes are the cinema's own.
 */
export default async function ChristmasMoviesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const at = readAsk(params).at;
  const place = writeAsk(at ? { at } : {});
  const who: Watching | undefined = isWatching(one(params.who))
    ? (one(params.who) as Watching)
    : undefined;
  const kind: Kind | undefined = isKind(one(params.kind))
    ? (one(params.kind) as Kind)
    : undefined;
  const round = Math.max(0, Math.min(99, Number(one(params.r)) || 0));
  const chosen = filmFor(one(params.film));
  const href = (q: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams(place);
    for (const [k, v] of Object.entries(q))
      if (v !== undefined && v !== "") u.set(k, String(v));
    const s = u.toString();
    return `/christmas/movies${s ? `?${s}` : ""}#movie-night`;
  };
  const three = who ? threeFor(who, kind, round) : null;
  const nightOut = `/christmas/itinerary?${new URLSearchParams({
    say: "dinner and a movie",
    ...(at ? { at } : {}),
  }).toString()}`;

  return (
    <ThemeProvider className="block">
      <main className={`${styles.page} min-h-screen pb-28`}>
        <header className={styles.night}>
          <div className="mx-auto max-w-4xl px-4 pt-4 pb-6 sm:px-6 sm:pt-8">
            <Link
              href={`/christmas${place ? `?${place}` : ""}`}
              className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-bold text-white/90 hover:text-white"
              data-testid="back-to-christmas"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              All of Christmas
            </Link>
            <p className="mt-2 text-xs font-bold tracking-[0.18em] text-[#ffd98a] uppercase">
              A cozy night in
            </p>
            <h1 className="ghad-display mt-1 text-[2.4rem] leading-[0.95] font-extrabold tracking-[-0.04em] sm:text-6xl">
              Christmas movies
            </h1>
            <p className="mt-2 max-w-xl text-base text-white/90">
              Blankets, cocoa and the right film. Tell us who&apos;s watching
              and we&apos;ll pick three.
            </p>
          </div>
          <div className={styles.lights} aria-hidden />
        </header>

        <div className="mx-auto max-w-4xl space-y-10 px-4 pt-6 sm:px-6">
          <section
            id="movie-night"
            className="scroll-mt-20 rounded-[26px] bg-white p-5 ring-1 ring-black/5 sm:p-6"
            data-testid="movie-night"
          >
            {chosen ? (
              <Tonight
                film={chosen}
                again={href({ who, kind, r: round })}
                nightOut={nightOut}
              />
            ) : (
              <>
                <h2 className="ghad-display flex items-center gap-2 text-2xl font-extrabold">
                  <Clapperboard
                    className="h-6 w-6 text-[#b3242f]"
                    aria-hidden
                  />
                  Movie night
                </h2>
                <p className="mt-1 text-base font-semibold">
                  Who&apos;s watching?
                </p>
                <div
                  className="mt-2 flex flex-wrap gap-2"
                  data-testid="who"
                  role="group"
                  aria-label="Who's watching"
                >
                  {WATCHING.map((w) => (
                    <Chip
                      key={w.id}
                      href={href({ who: w.id, kind })}
                      on={who === w.id}
                      testId={`who-${w.id}`}
                    >
                      {w.label}
                    </Chip>
                  ))}
                </div>
                {who && (
                  <>
                    <p className="mt-4 text-base font-semibold">
                      Any kind in mind?{" "}
                      <span className="font-normal text-[var(--gh-ink-soft)]">
                        Optional
                      </span>
                    </p>
                    <div
                      className="mt-2 flex flex-wrap gap-2"
                      role="group"
                      aria-label="Kind of film"
                    >
                      <Chip href={href({ who })} on={!kind} testId="kind-any">
                        Any
                      </Chip>
                      {KINDS.map((k) => (
                        <Chip
                          key={k.id}
                          href={href({ who, kind: k.id })}
                          on={kind === k.id}
                          testId={`kind-${k.id}`}
                        >
                          {k.emoji} {k.label}
                        </Chip>
                      ))}
                    </div>
                  </>
                )}
                {three && (
                  <div className="mt-5" data-testid="three">
                    {three.films.length === 0 ? (
                      <p className="text-base">
                        Nothing on our list is that kind for this crowd — try
                        Any.
                      </p>
                    ) : (
                      <ul className="grid gap-3 sm:grid-cols-3">
                        {three.films.map((f) => (
                          <li key={f.id}>
                            <FilmCard
                              film={f}
                              choose={href({ who, kind, r: round, film: f.id })}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    {three.of > 3 && (
                      <Link
                        href={href({ who, kind, r: round + 1 })}
                        className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-bold ring-1 ring-black/15 hover:ring-black/40"
                        data-testid="three-more"
                      >
                        <Dices className="h-5 w-5" aria-hidden />
                        Three more
                      </Link>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {KINDS.map((k) => (
            <section
              key={k.id}
              aria-labelledby={`shelf-${k.id}`}
              data-testid={`shelf-${k.id}`}
            >
              <h2
                id={`shelf-${k.id}`}
                className="ghad-display text-2xl leading-tight font-extrabold"
              >
                <span aria-hidden>{k.emoji}</span> {k.label}
              </h2>
              <p className="text-base text-[var(--gh-ink-soft)]">{k.line}</p>
              <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
                {shelf(k.id).map((f) => (
                  <li key={f.id} className="w-[15.5rem] shrink-0 snap-start">
                    <FilmCard
                      film={f}
                      choose={href({ who: who ?? "grownups", film: f.id })}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p
            className="max-w-3xl text-sm text-[var(--gh-ink-soft)]"
            data-testid="no-streaming"
          >
            Where to watch: we don&apos;t list what&apos;s streaming in Canada —
            it changes every season and we won&apos;t guess. Check the apps you
            already have, borrow it from the library, or{" "}
            <Link
              href={nightOut}
              className="font-semibold underline underline-offset-4"
            >
              make it a night out at the cinema
            </Link>
            . Ratings are the US MPA&apos;s where it rated the film; runtimes
            are about.
          </p>
        </div>
      </main>
    </ThemeProvider>
  );
}

function Chip({
  href,
  on,
  testId,
  children,
}: {
  readonly href: string;
  readonly on: boolean;
  readonly testId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      data-testid={testId}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${
        on
          ? "bg-[#0f3b2b] text-white"
          : "bg-[#f6f1e6] text-[#082319] ring-1 ring-black/10 hover:ring-black/30"
      }`}
    >
      {children}
    </Link>
  );
}

function facts(f: ChristmasFilm): string {
  return [
    String(f.year),
    `about ${f.runtimeMinutes} min`,
    f.certification ? `${f.certification.code}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function FilmCard({
  film,
  choose,
}: {
  readonly film: ChristmasFilm;
  readonly choose: string;
}) {
  return (
    <article
      className="flex h-full flex-col rounded-[20px] bg-[#fffaf0] p-4 ring-1 ring-black/10"
      data-testid="film"
      data-film={film.id}
    >
      <h3 className="text-lg leading-tight font-extrabold">{film.title}</h3>
      <p className="mt-0.5 text-sm text-[var(--gh-ink-soft)]">{facts(film)}</p>
      <p className="mt-2 flex-1 text-base">{film.line}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={choose}
          className="inline-flex min-h-11 items-center rounded-full bg-[#b3242f] px-4 text-sm font-bold text-white hover:brightness-110"
          data-testid="choose-film"
        >
          Watch this tonight
        </Link>
        <a
          href={
            film.trailerId
              ? `https://www.youtube.com/watch?v=${film.trailerId}`
              : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${film.title} ${film.year} trailer`)}`
          }
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline underline-offset-4"
        >
          {film.trailerId ? "Trailer" : "Find the trailer"}
        </a>
      </div>
    </article>
  );
}

function Tonight({
  film,
  again,
  nightOut,
}: {
  readonly film: ChristmasFilm;
  readonly again: string;
  readonly nightOut: string;
}) {
  return (
    <div data-testid="tonight" data-film={film.id}>
      <p className="text-xs font-bold tracking-[0.16em] text-[#b3242f] uppercase">
        Tonight&apos;s movie night
      </p>
      <h2 className="ghad-display mt-1 text-3xl leading-tight font-extrabold">
        {film.title}
      </h2>
      <p className="text-sm text-[var(--gh-ink-soft)]">{facts(film)}</p>
      <p className="mt-2 text-base">{film.line}</p>
      <h3 className="mt-4 font-extrabold">Around it — ideas, not listings</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-base">
        {NIGHT_IN.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-[var(--gh-ink-soft)]">
        Where to watch: check the apps you already have, or the library. We
        don&apos;t list Canadian streaming.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ShareLink
          title={`Movie night: ${film.title}`}
          text={`Movie night tonight — ${film.title} (${film.year}). You in?`}
          testId="share-movie-night"
        />
        <Link
          href={again}
          className="inline-flex min-h-12 items-center rounded-full px-5 font-bold ring-1 ring-black/15 hover:ring-black/40"
          data-testid="pick-another"
        >
          Pick another
        </Link>
        <Link
          href={nightOut}
          className="inline-flex min-h-12 items-center px-2 font-semibold underline underline-offset-4"
        >
          Make it a night out instead
        </Link>
      </div>
    </div>
  );
}
