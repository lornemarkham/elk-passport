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
/**
 * Launch QA (2026-11-21, finding 32): the venue's photograph, or the
 * organiser's, is a picture of somewhere else — a Christmas garage sale is not
 * its ranch. Only a picture of **this very thing** (Atlas gives it no label)
 * is shown; with none, the card is compact text.
 */
export function christmasPictures(experience: Experience): CardPicture[] {
  return cardPictures(experience).filter((p) => !p.label);
}

export const hasChristmasPicture = (experience: Experience): boolean =>
  christmasPictures(experience).length > 0;
