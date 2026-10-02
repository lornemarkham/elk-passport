import type { Doing } from "@/lib/making/catalogue";
import type { Keepable } from "@/components/october/save/keeping";

/**
 * **A Doing, as My October stores it — said in exactly one place.**
 *
 * Same discipline as `keepableFilm`: the primary key is `(user_id,
 * entity_id)`, so two callers disagreeing about a name would silently rewrite
 * each other's row.
 *
 * `startsAt` is null and stays null at save time. A Doing has no day until
 * somebody chooses one, and Anticipate gives a dateless thing no urgency of
 * any kind rather than inventing a date for it.
 */
export function keepableDoing(doing: Doing): Keepable {
  return {
    entityId: doing.id,
    entityKind: "Doing",
    name: doing.title,
    startsAt: null,
  };
}
