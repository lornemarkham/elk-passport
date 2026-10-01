import Link from "next/link";
import type { Film } from "@/lib/movies/catalogue";
import { ANGLES, angleOf } from "@/lib/movies/editorial";
import { cardFactsFor } from "@/domain/october/whyWatch";
import { KeepOnCard } from "@/components/october/save/KeepOnCard";
import { keepableFilm } from "./keepableFilm";
import { Trailer } from "./Trailer";
import type { Verdict } from "@/lib/movies/types";

/**
 * What a person said about a film, in their own words' place on the card.
 *
 * Deliberately **not** October's typography: October's angle is ember,
 * uppercase and letter-spaced; this is plain sentence case in a neutral tone
 * and starts with "You". Editorial and experience are two different kinds of
 * claim and a person must never have to work out which one they are reading.
 */
const YOU_SAID: Record<Verdict, string> = {
  loved: "You loved this",
  good: "You thought this was good",
  meh: "You thought this was meh",
};

/**
 * **One film, as a thing to decide about — without leaving the page.**
 *
 * The first version of this card was a title, a year, a sentence and three
 * chips, which is a search result with better typography. The card now does
 * the work the detail page used to: the trailer plays in place, the badge says
 * which angle October reaches for it from, and the save is right there. The
 * detail page still exists, and is now genuinely optional.
 *
 * Built on the overlay-link shape October's cards use, because the whole card
 * navigates and both the trailer and the save mark have to be siblings of that
 * link rather than buttons inside it.
 */
export function FilmCard({
  film,
  saved,
  signedIn,
  returnTo,
  youSaid,
}: {
  readonly film: Film;
  readonly saved: boolean;
  readonly signedIn: boolean;
  readonly returnTo: string;
  /** This person's own verdict, where they have given one. Never anybody else's. */
  readonly youSaid?: Verdict;
}) {
  const facts = cardFactsFor(film);
  const angle = angleOf(film.id);

  return (
    <div
      data-testid="film-card"
      data-film-id={film.id}
      className="group relative flex h-full flex-col rounded-xl border border-[#e9e6da]/10 bg-[#e9e6da]/[0.03] p-3 transition-colors hover:border-[#d09a4e]/40 hover:bg-[#e9e6da]/[0.06]"
    >
      <Link
        href={`/october/movies/${film.id}`}
        data-testid="film-card-link"
        className="absolute inset-0 rounded-xl focus-visible:ring-1 focus-visible:ring-[#d09a4e] focus-visible:outline-none"
      >
        <span className="sr-only">{film.title}</span>
      </Link>

      <Trailer film={film} />

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {angle ? (
            <p
              data-testid="film-angle"
              className="text-[10px] font-medium tracking-[0.14em] text-[#d09a4e]/80 uppercase"
            >
              {ANGLES[angle].label}
            </p>
          ) : null}
          <h3 className="font-heading mt-0.5 text-base leading-tight text-[#f3efe4]">
            {film.title}
          </h3>
          <p className="mt-0.5 text-xs text-[#e9e6da]/40">
            {film.year}
            {/* Said only where it is worth saying — see `Film.origin`. */}
            {film.origin ? ` · ${film.origin}` : ""}
          </p>
        </div>
        <KeepOnCard
          thing={keepableFilm(film)}
          initiallySaved={saved}
          signedIn={signedIn}
          returnTo={returnTo}
        />
      </div>

      {/* The reason, authored by somebody who watched it. */}
      <p className="mt-2 text-sm leading-relaxed text-[#e9e6da]/60">
        {film.line}
      </p>

      {youSaid ? (
        <p data-testid="you-said" className="mt-2 text-xs text-[#9ab0a8]">
          {YOU_SAID[youSaid]}
        </p>
      ) : null}

      <ul
        data-testid="film-facts"
        className="mt-3 flex flex-wrap gap-x-2 gap-y-1 pt-0"
      >
        {facts.map((fact) => (
          <li
            key={fact}
            className="rounded-full bg-[#e9e6da]/[0.06] px-2 py-0.5 text-[11px] text-[#e9e6da]/55"
          >
            {fact}
          </li>
        ))}
      </ul>
    </div>
  );
}
