import type { Experience } from "@/domain/experience/types";
import type { CandidatePresentationImage } from "@/lib/data/types";

/**
 * Whether a presented picture is of the thing, its venue or its organizer —
 * as against a stand-in photograph of the *kind* of thing. Only a stand-in is
 * illustrative, and only a stand-in may give way to something truer.
 */
export function isIllustrative(
  image: Pick<CandidatePresentationImage, "relationship">,
): boolean {
  return (
    image.relationship === "representative" || image.relationship === "category"
  );
}

/**
 * **One illustrative photograph, once per row.** Atlas picks a category photo
 * per kind of thing, so a row of pumpkin patches carried the same pumpkins
 * four times. The first card keeps it; later ones in the same row lose it and
 * fall back to a venue photograph or the text lead — a different honest
 * treatment, rather than a repeat that reads as stock.
 *
 * Authentic pictures (exact, venue, organization) are never touched: two
 * events at one venue may truly share the venue's photograph.
 */
export function withoutRepeatedIllustrations<T extends Experience>(
  items: readonly T[],
): T[] {
  const seen = new Set<string>();
  return items.map((item) => {
    const image = item.presentationImage;
    if (!image || !isIllustrative(image)) return item;
    if (!seen.has(image.url)) {
      seen.add(image.url);
      return item;
    }
    const { presentationImage: _dropped, ...rest } = item;
    void _dropped;
    return rest as T;
  });
}
