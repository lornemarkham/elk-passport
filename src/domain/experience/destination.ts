import type { Experience } from "./types";

/**
 * Where a card goes when it is tapped — derived, never authored.
 *
 * ## The rule
 *
 * **A card representing a specific Thing navigates to that Thing.** There is
 * no third outcome. A card is not allowed to quietly become "open the list"
 * because Passport has no specialised template for that entity kind — that
 * substitution loses the one piece of information the person expressed by
 * tapping, which is *which* thing they meant.
 *
 * ```
 * Place          → /places/{id}    Atlas's Place read answers for every Place
 * anything else  → /passport/{id}  the neutral traveller page, for any kind
 * ```
 *
 * ## Why this used to return undefined for most of the corpus
 *
 * The previous rule had a branch for ready Places, a branch for dated Events,
 * and a fallback to a containing Place. Everything else fell through to
 * `undefined` — which measured as **88% of the corpus**: 1,504 of 1,508
 * Organizations, every one of 376 Activities, and 155 of 252 Places. Black
 * Mountain Haunted House is an Organization with no containing Place, so it
 * was one of them.
 *
 * The missing destination was never missing. `/passport/[id]` describes
 * itself as the traveller page *for any entity kind* and `composition.ts` has
 * shipped an Organization running order all along; it was simply never routed
 * to by anything but Events. Widening this is not a new contract, it is the
 * existing one being used.
 *
 * ## Every Place goes to the Place page, ready or not
 *
 * This used to send only a *detail-ready* Place to `/places/{id}` and every
 * other Place to `/passport/{id}`, on the theory that the Place template
 * renders a thin entity badly. But `/passport/{id}` asks Atlas only for
 * Organization, Experience and Event compositions, so a Place that was not
 * ready reached no read that could answer it and rendered **"There's nothing
 * at this address"**. On production on 2026-10-11 that was 450 of the 627
 * Places Discovery offered (Caravan Farm Theatre among them; 8 of 8 sampled
 * 404'd), while `/places/{id}` rendered 25 of 25 sampled, because Atlas's
 * `GET /places/:id/detail` answers for any Place. A thin Place page is a page.
 * A 404 is not.
 *
 * Which Atlas read answers which kind is `COMPOSED_READS` below, and the test
 * holds this function to it on real Atlas ids.
 */
export function destinationFor(experience: Experience): string | undefined {
  // Everything Atlas holds has a traveller page. An entity with no id is the
  // only thing that cannot be opened, and it is not a Thing.
  return experience.id
    ? subjectHref(experience.kind, experience.id)
    : undefined;
}

/**
 * The page for a subject Passport knows only by kind and id, such as the
 * `partOf` a candidate names. The same rule as `destinationFor`.
 */
export function subjectHref(kind: string, id: string): string {
  // The Place page, because it is the one whose Atlas read answers for a
  // Place. `detailReady` decides nothing here: see above.
  return kind === "Place" ? `/places/${id}` : `/passport/${id}`;
}

/**
 * **The composed reads `/passport/[id]` asks Atlas**, by the kind each one
 * answers (`GET /{read}/:id/detail`), in the order a miss falls through them.
 *
 * Atlas has no composed read for an Activity. `/passport/[id]` renders one
 * from its Discovery candidate instead.
 */
export const COMPOSED_READS = {
  Organization: "organizations",
  Experience: "experiences",
  Event: "events",
} as const;
