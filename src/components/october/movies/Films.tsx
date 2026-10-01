"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CATALOGUE,
  FEAR_ORDER,
  suitableFor,
  type Audience,
  type Fear,
  type Film,
} from "@/lib/movies/catalogue";
import { ANGLES, ANGLE_ORDER, angleOf } from "@/lib/movies/editorial";
import type { Verdict } from "@/lib/movies/types";
import { FilmCard } from "./FilmCard";

/**
 * **The catalogue as a set of edited shelves, not a search result.**
 *
 * The first version of this page put 28 films in one grid, sorted by nothing
 * in particular, and the honest reaction to it was *why would I use this
 * instead of a good search?* — which had no answer, because a flat list of
 * correct titles is precisely what a search returns.
 *
 * What a search cannot do is have a point of view. So the films arrive in
 * shelves that are October's opinions — **What the hell is this**, *You
 * probably missed this*, *Canadian nightmare* — and the strange shelves come
 * first, because the canon is the thing a person could already find alone.
 *
 * Filtering collapses the shelves into one grid on purpose: once somebody has
 * said *kids, cozy*, they are answering a question rather than browsing, and
 * editorial headings between four results would be decoration.
 */
const AUDIENCES: readonly { id: Audience; label: string }[] = [
  { id: "kids", label: "Kids" },
  { id: "teens", label: "Teens" },
  { id: "adults", label: "Adults" },
];

const FEAR_LABELS: Record<Fear, string> = {
  cozy: "Cozy",
  spooky: "Spooky",
  creepy: "Creepy",
  nightmare: "Nightmare",
};

export function Films({
  kept,
  signedIn,
  reactions,
}: {
  /** Film ids already in this person's October, read once on the server. */
  readonly kept: ReadonlySet<string>;
  readonly signedIn: boolean;
  /**
   * What **this person** already said about films, as `[filmId, verdict]`.
   * Their own rows and nobody else's — `passport_movie_reactions` is private
   * by row-level security, and this page shows a person their own history
   * rather than anybody's opinion of a film.
   */
  readonly reactions?: readonly (readonly [string, Verdict])[];
}) {
  const said = useMemo(() => new Map(reactions ?? []), [reactions]);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [fear, setFear] = useState<Fear | null>(null);
  const narrowing = audience !== null || fear !== null;

  const films: readonly Film[] = useMemo(() => {
    // `suitableFor` is the catalogue's own ceiling rule — kids means every
    // film a child may watch, not only the ones authored `kids`. Passport
    // holds no second copy of that logic.
    const pool = audience ? suitableFor(audience) : CATALOGUE;
    return fear ? pool.filter((f) => f.fear === fear) : pool;
  }, [audience, fear]);

  const card = (film: Film) => (
    <li key={film.id} className="flex">
      <FilmCard
        film={film}
        saved={kept.has(film.id)}
        signedIn={signedIn}
        returnTo="/october/movies"
        youSaid={said.get(film.id)}
      />
    </li>
  );

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-24">
        <header>
          <p className="text-sm font-medium text-[#d09a4e]">October 2026</p>
          <h1 className="font-heading mt-1 text-4xl font-semibold tracking-tight text-[#f3efe4]">
            Movies
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[#e9e6da]/50">
            {CATALOGUE.length} films, each one watched and written about by
            somebody. The famous ones are here. They are not the reason to stay.
          </p>
          <Link
            href="/october/movies/night"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-[#d09a4e] underline-offset-4 hover:underline"
          >
            Can&apos;t decide?
            <span className="text-[#d09a4e]/50">
              — let October ask three questions
            </span>
          </Link>
        </header>

        <div className="mt-8 flex flex-col gap-3">
          <Filter
            legend="Who's watching"
            testId="filter-audience"
            options={AUDIENCES.map((a) => ({ id: a.id, label: a.label }))}
            active={audience}
            onPick={(id) => setAudience(id as Audience | null)}
          />
          <Filter
            legend="How frightening"
            testId="filter-fear"
            options={FEAR_ORDER.map((f) => ({ id: f, label: FEAR_LABELS[f] }))}
            active={fear}
            onPick={(id) => setFear(id as Fear | null)}
          />
        </div>

        <p
          data-testid="film-count"
          className="mt-6 text-xs tracking-wider text-[#e9e6da]/35 uppercase"
        >
          {films.length === 1 ? "1 film" : `${films.length} films`}
        </p>

        {films.length === 0 ? (
          // Honest, and specific about which combination is empty — there is
          // no Nightmare film here a child may watch, and saying so beats a
          // shrug.
          <p
            data-testid="films-empty"
            className="mt-4 text-sm text-[#e9e6da]/50"
          >
            Nothing in the catalogue matches that. Try a different pairing —
            there is no Nightmare film here that kids can watch.
          </p>
        ) : narrowing ? (
          <ul
            data-testid="film-grid"
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {films.map(card)}
          </ul>
        ) : (
          <div className="mt-4 flex flex-col gap-12">
            {ANGLE_ORDER.map((angle) => {
              const shelf = films.filter((f) => angleOf(f.id) === angle);
              if (shelf.length === 0) return null;
              const voice = ANGLES[angle];
              return (
                <section key={angle} data-testid="shelf" data-angle={angle}>
                  <h2 className="font-heading text-xl text-[#f3efe4]">
                    {voice.heading}
                  </h2>
                  <p className="mt-0.5 text-sm text-[#e9e6da]/45">
                    {voice.line}
                  </p>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {shelf.map(card)}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <Link
          href="/october/mine"
          className="mt-12 inline-flex min-h-11 items-center text-sm text-[#e9e6da]/45 underline-offset-4 hover:underline"
        >
          My October
        </Link>
      </div>
    </main>
  );
}

/** One row of narrowing. Pressing the active option clears it. */
function Filter({
  legend,
  testId,
  options,
  active,
  onPick,
}: {
  readonly legend: string;
  readonly testId: string;
  readonly options: readonly { id: string; label: string }[];
  readonly active: string | null;
  readonly onPick: (id: string | null) => void;
}) {
  return (
    <fieldset
      data-testid={testId}
      className="flex flex-wrap items-center gap-2"
    >
      <legend className="sr-only">{legend}</legend>
      <span className="mr-1 text-[11px] tracking-wider text-[#e9e6da]/35 uppercase">
        {legend}
      </span>
      {options.map((option) => {
        const on = active === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? null : option.id)}
            className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${
              on
                ? "border-[#d09a4e]/50 bg-[#d09a4e]/10 text-[#d09a4e]"
                : "border-[#e9e6da]/12 text-[#e9e6da]/55 hover:border-[#e9e6da]/25 hover:text-[#e9e6da]/80"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
