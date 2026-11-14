import type { Experience } from "@/domain/experience/types";
import { ZONE } from "@/domain/experience/eventTime";
import { isOver } from "@/domain/discovery/compose";
import { isIllustrative } from "@/domain/discovery/illustrations";

/**
 * **What Discovery's pool leaves behind before it is sent to anybody.**
 *
 * Owner brief M817, verbatim: _"NO IMAGES. SHITTY. SLOW AS FUCK."_ — with
 * expired Halloween activities and unrelated stock photos named as two of the
 * reasons. Measured on production `gohaveaday.com` on 2026-11-13: 6,199
 * candidates and a 10.9 MB document (1.0 MB compressed), of which
 *
 * ```
 * 423   dated things already over (417 Events, 6 Experiences with stated days)
 * 4,616 "category" photographs — a stand-in of the *kind* of thing, often of
 *       somewhere else entirely (a New York pier for "Pine Park")
 * ```
 *
 * The composed sections already hid what was over (`isOver`), but search,
 * answers and the activity rows read the whole pool, and every byte of it was
 * serialised to the browser. Leaving them out here is the cheapest
 * performance change on the page and the most visible content one.
 *
 * ## What it changes, and what it does not
 *
 * - **Over is over.** A dated thing whose last stated day is before today
 *   (in `ZONE`) is not a possibility. A thing with stated days, all past and
 *   not cut at Atlas's horizon, is the same.
 * - **Halloween ends on October 31.** A subject named for it — a haunted
 *   house, a pumpkin patch — with no stated date covering today is held out of
 *   Discovery from November 1 to August 31. It is a reading of the name, not
 *   a fact Atlas states, and it is presentation only: nothing is written back,
 *   the subject's own page still opens, and `Activity` entities (the
 *   activity explorer's taxonomy, which already says when a thing usually is)
 *   are untouched. Seasonality is Atlas's to state (M816); this stops being
 *   needed when it does.
 * - **No stand-in photographs.** `category` and `representative` pictures
 *   (Atlas ADR 106) are removed. The brief says never to use unrelated stock
 *   photos to fill gaps, and a card without a picture already has an honest
 *   treatment (`PossibilityCard`'s text lead). Pictures of the thing, its
 *   venue or its organizer are kept.
 *
 * Accommodation is **not** removed here: "Somewhere to stay" is a real thing
 * to ask for, and the composer keeps it out of everything that was not asked
 * (`compose.ts`, `proximity.ts`).
 */
export function forDiscoveryPool(
  experiences: readonly Experience[],
  now: Date,
): Experience[] {
  const today = zoneDay(now);
  const halloweenSeason = inHalloweenSeason(today);
  const kept: Experience[] = [];
  for (const experience of experiences) {
    if (isOver(experience, today)) continue;
    if (statedDaysOver(experience, today)) continue;
    if (
      !halloweenSeason &&
      experience.kind !== "Activity" &&
      HALLOWEEN.test(experience.title) &&
      // A dated one that is not over states its own season.
      !experience.startTime
    )
      continue;
    kept.push(withoutStandIn(experience));
  }
  return kept;
}

/** Today in `ZONE`, `YYYY-MM-DD` — not the server's day, which is UTC. */
export function zoneDay(now: Date): string {
  // `en-CA` formats a date as `YYYY-MM-DD`.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Named for Halloween, in the words a title uses. */
export const HALLOWEEN =
  /\b(hallowe'?en|halloweekend|haunted|haunts?|spooky|spook\w*|pumpkins?|frights?|trick[- ]or[- ]treat\w*)\b/i;

/** September 1 to October 31: when a pumpkin patch is a possibility. */
function inHalloweenSeason(today: string): boolean {
  const month = Number(today.slice(5, 7));
  return month === 9 || month === 10;
}

function statedDaysOver(experience: Experience, today: string): boolean {
  const availability = experience.availability;
  if (availability?.basis !== "stated-days") return false;
  if (availability.moreDays) return false;
  const days = availability.days ?? [];
  if (days.length === 0) return false;
  return days.every((day) => day < today);
}

function withoutStandIn(experience: Experience): Experience {
  const image = experience.presentationImage;
  if (!image || !isIllustrative(image)) return experience;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { presentationImage, ...rest } = experience;
  return rest as Experience;
}
