import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth/currentUser";
import { filmById } from "@/lib/movies/catalogue";
import { reactionsFor } from "@/lib/movies/reactions";
import { octoberThingsFor } from "@/lib/october/octoberThings";
import { factsFor } from "@/domain/october/whyWatch";
import { ANGLES, OCTOBER_PICKS, angleOf } from "@/lib/movies/editorial";
import { Trailer } from "@/components/october/movies/Trailer";
import { SaveToOctober } from "@/components/october/detail/SaveToOctober";
import { keepableFilm } from "@/components/october/movies/keepableFilm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ filmId: string }>;
}): Promise<Metadata> {
  const film = filmById((await params).filmId);
  return { title: film ? `${film.title} — Passport` : "Film — Passport" };
}

const VERDICT_SAYS = {
  loved: "You loved it",
  good: "You thought it was good",
  meh: "You thought it was meh",
} as const;

/**
 * **A film's page: reference, deliberately small.**
 *
 * Everything a person needs to decide is already on the card — the line, how
 * long, how frightening, who can watch. This page exists for the rest: the
 * published certification with its board named, what the film does to people,
 * and where this film stands in *their* October.
 *
 * It is not a movie database page, and it holds no synopsis, cast or crew,
 * because the catalogue holds none and inventing them would be the one thing
 * this whole surface is built not to do.
 *
 * **Reacting happens in My October, not here.** A reaction belongs to the
 * night you watched it, and My October is where a film becomes Lived; this
 * page reports what you already said and links there rather than growing a
 * second way to say it.
 */
export default async function FilmPage({
  params,
}: {
  params: Promise<{ filmId: string }>;
}) {
  const { filmId } = await params;
  const film = filmById(filmId);
  if (!film) notFound();

  const user = await currentUser().catch(() => null);
  const [things, reactions] = user
    ? await Promise.all([
        octoberThingsFor(user).catch(() => []),
        reactionsFor(user).catch(() => []),
      ])
    : [[], []];

  const mine = things.find((t) => t.entityId === film.id);
  const reaction = reactions.find((r) => r.filmId === film.id);
  const facts = factsFor(film);
  const angle = angleOf(film.id);
  const note = OCTOBER_PICKS.find((p) => p.filmId === film.id)?.note;

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-24">
        <Link
          href="/october/movies"
          className="inline-flex min-h-11 items-center text-sm text-[#e9e6da]/45 underline-offset-4 hover:underline"
        >
          ← Movies
        </Link>

        <header className="mt-4">
          <p className="text-xs tracking-wider text-[#d09a4e] uppercase">
            {angle ? ANGLES[angle].label : "Film"}
          </p>
          <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight text-[#f3efe4]">
            {film.title}
          </h1>
          <p className="mt-1 text-sm text-[#e9e6da]/45">
            {facts.year} · {facts.runtime}
            {film.origin ? ` · ${film.origin}` : ""}
            {/* Said only where a board actually rated it. */}
            {facts.certification ? ` · ${facts.certification}` : ""}
          </p>
        </header>

        <Trailer film={film} className="mt-6" />

        <p className="mt-6 text-lg leading-relaxed text-[#e9e6da]/75">
          {facts.line}
        </p>

        {/* October's own paragraph, where it has one. Labelled as October's,
            in October's colour, and never rendered near a real person's
            reaction — see `lib/movies/editorial.ts`. */}
        {note ? (
          <div className="mt-6 border-l-2 border-[#d09a4e]/40 pl-4">
            <p className="text-[10px] tracking-[0.14em] text-[#e9e6da]/30 uppercase">
              October says
            </p>
            <p
              data-testid="detail-note"
              className="mt-1 leading-relaxed text-[#e9e6da]/70"
            >
              {note}
            </p>
          </div>
        ) : null}

        <dl
          data-testid="film-detail-facts"
          className="mt-8 grid gap-4 sm:grid-cols-3"
        >
          <Fact label="How frightening" value={facts.fear} />
          <Fact label="Who's it for" value={facts.audience} />
          <Fact label="Commitment" value={facts.commitment} />
        </dl>

        {/* Authored per film: why it works on people, not a rating. */}
        <section className="mt-8">
          <h2 className="text-[11px] tracking-wider text-[#e9e6da]/35 uppercase">
            What it does
          </h2>
          <ul
            data-testid="film-mechanisms"
            className="mt-2 flex flex-wrap gap-2"
          >
            {facts.mechanisms.map((m) => (
              <li
                key={m}
                className="rounded-full bg-[#e9e6da]/[0.06] px-2.5 py-1 text-xs text-[#e9e6da]/55"
              >
                {m}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 border-t border-[#e9e6da]/10 pt-6">
          {mine?.state === "lived" ? (
            // Already watched. Nothing to keep, and the reaction — if they
            // gave one — is the only thing left worth saying.
            <div data-testid="film-watched">
              <p className="text-sm text-[#d09a4e]">
                Watched
                {mine.livedAt
                  ? ` · ${new Date(mine.livedAt).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                    })}`
                  : ""}
              </p>
              <p className="mt-1 text-sm text-[#e9e6da]/55">
                {reaction ? (
                  <span data-testid="film-reaction-said">
                    {VERDICT_SAYS[reaction.verdict]}
                    {reaction.felt ? ` · felt ${reaction.felt}` : ""}
                    {reaction.gotMe ? ` · ${reaction.gotMe}` : ""}
                  </span>
                ) : (
                  <Link
                    href="/october/mine"
                    className="underline underline-offset-4"
                  >
                    Say what you thought in My October
                  </Link>
                )}
              </p>
            </div>
          ) : (
            <SaveToOctober
              entityId={film.id}
              entityKind="Movie"
              name={keepableFilm(film).name}
              startsAt={null}
              initiallySaved={Boolean(mine)}
              signedIn={Boolean(user)}
              returnTo={`/october/movies/${film.id}`}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function Fact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="text-[11px] tracking-wider text-[#e9e6da]/35 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[#e9e6da]/75">{value}</dd>
    </div>
  );
}
