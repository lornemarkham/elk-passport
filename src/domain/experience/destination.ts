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
 * ready Place  → /places/{id}     the specialised template, where it applies
 * anything else → /passport/{id}  the neutral traveller page, for any kind
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
 * ## Why `detailReady` still gates the Place route, and gates nothing else
 *
 * `/places/[id]` is a richer, Place-shaped template — a map pin, quick facts —
 * and an entity without coordinates renders it badly. So readiness chooses
 * *which* page a Place gets, and no longer decides whether it has one at all.
 * Those were always two different questions; conflating them is what produced
 * a dead card.
 *
 * The neutral page is honest about gaps by design ("No opening hours yet"),
 * so sending a thin entity there shows a real page with real absences rather
 * than nothing.
 */
export function destinationFor(experience: Experience): string | undefined {
  // The specialised template, where the entity can actually fill it.
  if (experience.kind === "Place" && experience.detailReady) {
    return `/places/${experience.id}`;
  }

  // Everything Atlas holds has a traveller page. An entity with no id is the
  // only thing that cannot be opened, and it is not a Thing.
  return experience.id ? `/passport/${experience.id}` : undefined;
}
