import type { Place, PlaceRepresentativeMedia } from "@/lib/data/types";

/**
 * **Which image may stand for the Place, where.** (Atlas ADR 069)
 *
 * Atlas's detail read carries `media`: the images it holds subject evidence
 * for, hero first, one per file. Passport composes from that and nothing
 * else — it does not judge whether an image is trustworthy, and it does not
 * consult `place.imageUrl` when `media` is present, because the scalar can
 * predate the evidence rule while the read cannot.
 *
 * Two places on the page show a large image: the hero, and "Don't leave
 * without…". Before this, both read the same scalar, so Kal Beach showed a
 * shop interior twice. Now the featured image is the *second* representative
 * image, or nothing: one photograph does not get to be the whole page.
 *
 * An Atlas that predates `media` sends none; then, and only then, the
 * scalar is what Atlas chose and is used as before.
 */

export function heroImage(
  place: Place,
  media: PlaceRepresentativeMedia | undefined,
): string | undefined {
  if (media) return media.hero?.url;
  return place.imageUrl;
}

/** The featured image for a second large placement — never the hero's file again. */
export function featuredImage(
  place: Place,
  media: PlaceRepresentativeMedia | undefined,
): string | undefined {
  if (media) {
    const hero = media.hero?.url;
    return media.gallery.find((m) => m.url !== hero)?.url;
  }
  return place.imageUrl;
}
