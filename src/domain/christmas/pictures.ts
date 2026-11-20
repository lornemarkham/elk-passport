import type { Experience } from "@/domain/experience/types";
import { cardPictures, type CardPicture } from "@/lib/media/cardPicture";

/**
 * **Which pictures a Christmas card may show.** Discovery's own rules
 * (`cardPictures`: the thing's picture, Atlas's, the venue's — each labelled)
 * minus anything Atlas says only _stands in_ for the kind of thing: a
 * "representative" or "illustrative" photograph of some other market or some
 * other string of lights is a misleading picture on a card that names this one
 * (doctrine §12, 2026-11-13). With none left a card is text-first; it never
 * grows an empty picture box.
 */
const STAND_IN = /^(illustrative photo|representative image)/i;

export function christmasPictures(experience: Experience): CardPicture[] {
  return cardPictures(experience).filter(
    (p) => !p.label || !STAND_IN.test(p.label),
  );
}

export const hasChristmasPicture = (experience: Experience): boolean =>
  christmasPictures(experience).length > 0;
