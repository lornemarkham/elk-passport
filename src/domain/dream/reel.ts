import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import { substantial } from "@/lib/ai/ask/answer";
import { readWhen } from "@/domain/christmas/when";
import { cardFor, photoOf, type DreamCard } from "./compose";
import { isAccommodation } from "./ingredients";

/**
 * **The opening reel: real places near you, in their own photographs.**
 *
 * Imagery as the experience, not decoration (§2.3): every frame is a place
 * Atlas holds, named on screen with how far it is, and tapping it opens that
 * place. The kinds of place a person would stop scrolling for lead — water,
 * mountains, a show on tonight — one of each kind, so the reel is a range of
 * possible days rather than six cafés.
 */
const STRIKING: readonly (readonly [string, RegExp])[] = [
  ["water", /\b(lake|beach|falls|waterfall|river|canyon)\b/i],
  [
    "view",
    /\b(viewpoint|lookout|mountain|summit|provincial park|regional park)\b/i,
  ],
  ["snow", /\b(ski|nordic|rink|skating|snow)\b/i],
  ["wine", /\b(winery|vineyard|cidery|distillery|orchard|farm)\b/i],
  ["show", /\b(theatre|festival|market|concert|music)\b/i],
  ["culture", /\b(museum|gallery|heritage|observatory|garden)\b/i],
  ["trail", /\b(trail|forest|nature)\b/i],
];

export function reelFor(input: {
  readonly pool: readonly Experience[];
  readonly townId: string;
  readonly today: string;
  readonly limit?: number;
}): DreamCard[] {
  const town = townById(input.townId) ?? townById("vernon")!;
  const origin = { latitude: town.latitude, longitude: town.longitude };
  const near = input.pool.filter((e) => {
    const c = e.geography?.coordinates;
    if (!c || typeof c[0] !== "number" || typeof c[1] !== "number")
      return false;
    if (!photoOf(e) || photoOf(e)?.label) return false; // its own picture only
    if (isAccommodation(e) || !substantial(e)) return false;
    if (e.kind === "Event" && e.startTime) {
      const phase = readWhen(e, input.today).phase;
      if (phase !== "now" && phase !== "upcoming") return false;
    }
    const dLat = (c[1] - origin.latitude) * 111;
    const dLng =
      (c[0] - origin.longitude) *
      111 *
      Math.cos((origin.latitude * Math.PI) / 180);
    return Math.hypot(dLat, dLng) <= 40;
  });
  const out: Experience[] = [];
  for (const [, pattern] of STRIKING) {
    const one = near.find(
      (e) => pattern.test(`${e.subtype ?? ""} ${e.title}`) && !out.includes(e),
    );
    if (one) out.push(one);
    if (out.length >= (input.limit ?? 6)) break;
  }
  return out.map((e) => cardFor(e, origin, input.today, input.today));
}
