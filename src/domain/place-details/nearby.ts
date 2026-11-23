import type { Experience } from "@/domain/experience/types";
import { destinationFor } from "@/domain/experience/destination";
import {
  distanceLabel,
  distanceTo,
  nearYou,
} from "@/domain/discovery/proximity";
import { intentOf } from "@/domain/discovery/intents";
import type { PlaceLink } from "./model";

/** Close enough to pair with, in a straight line. */
export const NEARBY_KM = 15;
const SHOWN = 6;

/**
 * **What else is close by**, from the same pool Discovery shows (already
 * through `forDiscoveryPool`, so nothing over and no stand-in photo).
 *
 * Nearest first, but a pictured place is preferred over an unpictured one at
 * the same distance band: the shelf is there to make someone want to stay
 * another hour. Beds are never offered (Discovery's own rule), and nothing
 * Atlas has not placed is called near — no point, no answer (doctrine §7).
 */
export function nearbyLinks(
  pool: readonly Experience[],
  at: { readonly latitude: number; readonly longitude: number } | undefined,
  selfId: string,
  km = NEARBY_KM,
): PlaceLink[] {
  if (!at) return [];
  const near = nearYou(pool, at, km).filter(
    (e) => e.id !== selfId && e.kind !== "Activity" && intentOf(e) !== "stay",
  );
  const pictured = near.filter((e) => e.heroMedia?.type === "image");
  const rest = near.filter((e) => e.heroMedia?.type !== "image");
  return [...pictured, ...rest].slice(0, SHOWN).flatMap((e) => {
    const href = destinationFor(e);
    if (!href) return [];
    const away = distanceLabel(distanceTo(e, at));
    return [
      {
        href,
        title: e.title,
        ...(e.subtype && e.subtype.toLowerCase() !== "unknown"
          ? { eyebrow: away ? `${e.subtype} · ${away}` : e.subtype }
          : away
            ? { eyebrow: away }
            : {}),
        ...(e.shortDescription ? { line: e.shortDescription } : {}),
        ...(e.heroMedia?.type === "image"
          ? { image: { url: e.heroMedia.src, alt: e.heroMedia.alt ?? e.title } }
          : {}),
      },
    ];
  });
}
