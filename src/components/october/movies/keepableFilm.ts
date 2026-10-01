import type { Film } from "@/lib/movies/catalogue";
import type { Keepable } from "@/components/october/save/keeping";

/**
 * **A film, as My October stores it — said in exactly one place.**
 *
 * Movie Night has kept films since 2026-09-22 as
 * `{ entityId: film.id, entityKind: "Movie", name: "Title (Year)" }`, and the
 * browse surface and the detail page now keep them too. Three callers writing
 * the same row is three chances for the name to drift, and a row whose name
 * disagrees with another row for the same film is not a cosmetic problem: the
 * primary key is `(user_id, entity_id)`, so the second save silently rewrites
 * the first one's name and My October changes under somebody who did nothing.
 *
 * `startsAt` is null and stays null. A film has no date until a person plans
 * one, and a timestamp here would be Anticipate's only lie — see
 * `domain/october/anticipation.ts`, which gives a dateless thing no urgency
 * of any kind.
 */
export function keepableFilm(film: Film): Keepable {
  return {
    entityId: film.id,
    entityKind: "Movie",
    name: `${film.title} (${film.year})`,
    startsAt: null,
  };
}
