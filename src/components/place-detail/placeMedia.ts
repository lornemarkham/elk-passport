import type {
  Place,
  PlaceMediaView,
  PlaceRepresentativeMedia,
} from "@/lib/data/types";

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

/**
 * The featured image **as the page actually shows it** — `featuredImage`
 * when "Don't leave without…" renders (it needs at least one activity), and
 * nothing otherwise. The gallery leaves out what this returns, so an image
 * is never on the page twice, and never left off it because a block that
 * did not render was assumed to have shown it.
 */
export function featuredImageShown(
  place: Place,
  media: PlaceRepresentativeMedia | undefined,
): string | undefined {
  const activities = place.activities?.filter((a) => a.trim()) ?? [];
  if (activities.length === 0) return undefined;
  return featuredImage(place, media);
}

/**
 * **The gallery: every image Atlas can vouch for, except the ones already
 * placed on the page.** (M1, Atlas ADR 069; M11.1)
 *
 * Eligibility is not decided here. Atlas's `media.gallery` is exactly the
 * representative set — images with subject evidence (a curator's approval, a
 * caption naming the subject, the source declaring its subject, the entity's
 * own page, a subject page), one per file, in Atlas's deterministic order
 * (strongest evidence first, then the source's own prominence signal, then
 * URL). Undecided and rejected media never reach this read, so they never
 * reach the gallery; Passport does not reinterpret evidence, and cannot.
 *
 * Two product rules are Passport's own:
 * - an image already placed on the page is left out — the hero, and the
 *   featured "Don't leave without…" image when that block rendered
 *   (`featuredImageShown`). Hardy Falls showed one salmon photograph three
 *   times: hero, featured, and again in the gallery; the gallery is the
 *   *rest* of what Atlas can vouch for, not the whole of it repeated;
 * - fewer than `GALLERY_MIN` remaining images is no gallery at all: one tile
 *   under a heading is not a gallery, and a Place whose only safe images are
 *   already on the page shows no empty shell.
 */
export const GALLERY_MIN = 2;

export function galleryImages(
  media: PlaceRepresentativeMedia | undefined,
  alreadyShown: readonly (string | undefined)[] = [],
): PlaceMediaView[] {
  if (!media) return [];
  const placed = new Set(
    [media.hero?.url, ...alreadyShown].filter((u): u is string => Boolean(u)),
  );
  const rest = media.gallery.filter((m) => !placed.has(m.url));
  return rest.length >= GALLERY_MIN ? rest : [];
}
