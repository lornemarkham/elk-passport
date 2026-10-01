import Link from "next/link";
import { filmById } from "@/lib/movies/catalogue";
import { ANGLES, OCTOBER_PICKS, angleOf } from "@/lib/movies/editorial";
import { cardFactsFor } from "@/domain/october/whyWatch";
import { KeepOnCard } from "@/components/october/save/KeepOnCard";
import { keepableFilm } from "./keepableFilm";
import { Trailer } from "./Trailer";

/**
 * **Five films on the front page, so October has taste before you ask it to.**
 *
 * The catalogue page was a wall of 44 correct titles, which is what a search
 * engine gives you and is therefore worth nothing. What a search cannot give
 * you is somebody saying *this one* — and meaning it about a Canadian
 * children's film from 1985 where a boy's hair falls out from fright.
 *
 * So the picks come to the person rather than waiting behind a link: a
 * trailer they can play in place, the angle October chose it from, a paragraph
 * in October's own voice, and a save. No navigation required to want it.
 *
 * ## The shape this is proving
 *
 * ```
 * HOOK → VISUAL → WHY OCTOBER PICKED IT → SAVE
 * ```
 *
 * Nothing here is specific to films except the catalogue it reads. The same
 * four beats are what a haunt or a farm would need, and the reason the trailer,
 * the badge and the note are three separate pieces is so that Discover can
 * eventually borrow the pattern without borrowing the movie.
 */
export function OctoberPicks({
  kept,
  signedIn,
  returnTo = "/october",
}: {
  readonly kept: ReadonlySet<string>;
  readonly signedIn: boolean;
  readonly returnTo?: string;
}) {
  const picks = OCTOBER_PICKS.map((pick) => ({
    pick,
    film: filmById(pick.filmId),
  })).filter(
    (
      p,
    ): p is {
      pick: (typeof OCTOBER_PICKS)[number];
      film: NonNullable<ReturnType<typeof filmById>>;
    } => Boolean(p.film),
  );
  if (picks.length === 0) return null;

  const [lead, ...rest] = picks;

  return (
    <section data-testid="october-picks">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <h2 className="font-heading text-2xl text-[#f3efe4]">
            October Picks
          </h2>
          <p className="mt-0.5 text-sm text-[#e9e6da]/45">
            Not the ones you would find by searching.
          </p>
        </div>
        <Link
          href="/october/movies"
          data-testid="see-all-movies"
          className="min-h-11 text-sm text-[#d09a4e] underline-offset-4 hover:underline"
        >
          See all movies →
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <PickCard
            film={lead!.film}
            note={lead!.pick.note}
            saved={kept.has(lead!.film.id)}
            signedIn={signedIn}
            returnTo={returnTo}
            lead
          />
        </div>
        {rest.map(({ pick, film }) => (
          <PickCard
            key={film.id}
            film={film}
            note={pick.note}
            saved={kept.has(film.id)}
            signedIn={signedIn}
            returnTo={returnTo}
          />
        ))}
      </div>
    </section>
  );
}

function PickCard({
  film,
  note,
  saved,
  signedIn,
  returnTo,
  lead = false,
}: {
  readonly film: NonNullable<ReturnType<typeof filmById>>;
  readonly note: string;
  readonly saved: boolean;
  readonly signedIn: boolean;
  readonly returnTo: string;
  readonly lead?: boolean;
}) {
  const angle = angleOf(film.id);
  const facts = cardFactsFor(film);

  return (
    <div
      data-testid="pick-card"
      data-film-id={film.id}
      className={`group relative flex gap-4 rounded-xl border border-[#e9e6da]/10 bg-[#e9e6da]/[0.03] p-4 transition-colors hover:border-[#d09a4e]/40 ${
        lead ? "flex-col sm:flex-row sm:items-start" : "flex-col"
      }`}
    >
      <Link
        href={`/october/movies/${film.id}`}
        className="absolute inset-0 rounded-xl focus-visible:ring-1 focus-visible:ring-[#d09a4e] focus-visible:outline-none"
      >
        <span className="sr-only">{film.title}</span>
      </Link>

      <Trailer film={film} className={lead ? "sm:w-2/5 sm:shrink-0" : ""} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {angle ? (
              <p
                data-testid="pick-angle"
                className="text-[11px] font-medium tracking-[0.14em] text-[#d09a4e] uppercase"
              >
                {ANGLES[angle].label}
              </p>
            ) : null}
            <h3
              className={`font-heading mt-0.5 leading-tight text-[#f3efe4] ${
                lead ? "text-2xl" : "text-lg"
              }`}
            >
              {film.title}
            </h3>
            <p className="mt-0.5 text-xs text-[#e9e6da]/40">
              {film.year}
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

        {/* October talking. Marked as October, in October's own colour, so it
            is never mistaken for something another person said. */}
        <p className="mt-3 text-[10px] tracking-[0.14em] text-[#e9e6da]/30 uppercase">
          October says
        </p>
        <p
          data-testid="pick-note"
          className={`mt-1 leading-relaxed text-[#e9e6da]/70 ${
            lead ? "text-base" : "text-sm"
          }`}
        >
          {note}
        </p>

        <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-1">
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
    </div>
  );
}
