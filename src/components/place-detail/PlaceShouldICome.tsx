import { Compass } from "lucide-react";
import { computeFitSignals, toPhraseList } from "./content";
import type { PlaceSectionProps } from "./types";

/**
 * Phase 7.6 — rebuilt as a feature block, not a Q&A entry. One strong,
 * confident statement, visually distinct from every other section on the
 * page (no `SectionShell` heading-and-divider here, deliberately — this
 * is the section the whole page's rhythm is built around: quiet
 * sections before and after it, one loud one here). Still template-
 * composed from real `place.activities`/`place.facilities` — see
 * `content.ts`'s `computeFitSignals` for the evidence rules, unchanged
 * from Phase 7.5, only the presentation and the tone of the caution
 * sentence changed (confident, never hedged — "not the pick for..." not
 * "this probably isn't it").
 *
 * Returns `null` — the whole section, not a placeholder — when there's no
 * real evidence to recommend from. Phase 7.6's explicit product direction:
 * never expose Atlas's uncertainty to a traveler. If confidence is low,
 * this omits itself entirely rather than saying so.
 */
export function PlaceShouldICome({ place }: PlaceSectionProps) {
  const signals = computeFitSignals(place.activities, place.facilities);
  const { easyMatches, wildernessMatches, developedMatches } = signals;

  let goodFit: string | undefined;
  let caution: string | undefined;

  if (easyMatches.length > 0) {
    goodFit = `If you're looking for an easy day with ${toPhraseList(easyMatches.slice(0, 3))}, ${place.name} is a solid pick.`;
    if (wildernessMatches.length === 0) {
      caution =
        developedMatches.length > 0
          ? "Not the pick for solitude or a rugged wilderness day — this is a developed, easy-access spot."
          : "Not the pick for solitude or a rugged wilderness day.";
    }
  } else if (wildernessMatches.length > 0) {
    goodFit = `If you're looking for a quieter, more rugged day with ${toPhraseList(wildernessMatches.slice(0, 3))}, ${place.name} is worth the trip.`;
    if (developedMatches.length === 0) {
      caution =
        "Not the pick for easy, family-friendly amenities close at hand.";
    }
  } else {
    const activities = place.activities?.filter((a) => a.trim()) ?? [];
    if (activities.length > 0) {
      goodFit = `${place.name} offers ${toPhraseList(activities.slice(0, 3))}.`;
    }
  }

  if (!goodFit) return null;

  return (
    <section className="from-primary/10 flex flex-col gap-3 rounded-2xl bg-gradient-to-br to-transparent px-6 py-8 sm:px-10 sm:py-10">
      <Compass className="text-primary h-6 w-6" aria-hidden />
      <p className="text-foreground max-w-2xl text-2xl leading-snug font-semibold tracking-tight sm:text-3xl">
        {goodFit}
      </p>
      {caution && (
        <p className="text-muted-foreground max-w-xl text-sm">{caution}</p>
      )}
    </section>
  );
}
