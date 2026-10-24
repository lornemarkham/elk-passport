import type { Experience } from "@/domain/experience/types";
import type { CandidatePresentationImage } from "@/lib/data/types";
import { isIllustrative } from "@/domain/discovery/illustrations";

/**
 * **Which picture a card may show, and what it must say about it.**
 *
 * The rules `PossibilityCard` applies in Discovery, as data, so every
 * surface that shows a subject's picture — Saved, an adventure, its guide —
 * shows the same picture with the same label:
 *
 * 1. the subject's own lead image, unlabelled;
 * 2. Atlas's `presentationImage` (ADR 106) — unlabelled only when it is
 *    `exact`, otherwise saying whose picture it is;
 * 3. the venue's picture for an event with none, said to be the venue's.
 *
 * A stand-in photograph of the *kind* of thing (representative, category)
 * gives way to a venue's own and is the last picture tried. The list is in
 * order; a surface shows the first one that loads.
 */
export interface CardPicture {
  readonly src: string;
  readonly alt: string;
  /** Said on the picture. Absent means it is a picture of this very thing. */
  readonly label?: string;
}

export function presentedLabel(image: CandidatePresentationImage): string {
  switch (image.relationship) {
    case "venue":
      return `Venue photo${image.source?.heldBy ? ` · ${image.source.heldBy.name}` : ""}`;
    case "organization":
      return `From ${image.source?.heldBy?.name ?? "the organizer"}`;
    case "representative":
      return "Representative image";
    case "category":
      return `Illustrative photo${image.license?.author ? ` · ${image.license.author}, ${image.license.name}` : ""}`;
    default:
      return "";
  }
}

export function cardPictures(experience: Experience): CardPicture[] {
  const out: CardPicture[] = [];
  const own = experience.heroMedia;
  if (own?.src && own.type === "image")
    out.push({ src: own.src, alt: own.alt ?? "" });
  const offered = experience.presentationImage;
  const venue = experience.contextualMedia;
  const presented: CardPicture | undefined = offered
    ? {
        src: offered.url,
        alt: offered.relationship === "exact" ? "" : offered.attribution,
        ...(offered.relationship === "exact"
          ? {}
          : { label: presentedLabel(offered) }),
      }
    : undefined;
  const venuePicture: CardPicture | undefined = venue?.heroUrl
    ? {
        src: venue.heroUrl,
        alt: `${venue.via.name}, where this happens`,
        label: `Venue photo · ${venue.via.name}`,
      }
    : undefined;
  const standIn = offered ? isIllustrative(offered) : false;
  if (presented && !standIn) out.push(presented);
  if (venuePicture) out.push(venuePicture);
  if (presented && standIn) out.push(presented);
  return out;
}
